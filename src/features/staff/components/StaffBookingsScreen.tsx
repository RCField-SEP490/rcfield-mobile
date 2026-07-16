import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Car, Clock, LogIn, UserRound, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'nativewind';

import {
  staffApi,
  type StaffBookingStatus,
  type TodayBookingItem,
} from '@/features/staff/api/staff.api';
import { Text } from '@/shared/ui/Text';

type FilterKey = 'ALL' | StaffBookingStatus | 'CHECKED_IN';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'CHECKED_IN', label: 'Đã check-in' },
  { key: 'PENDING', label: 'Chờ TT' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getSessionId(booking: TodayBookingItem) {
  const session = booking.sessions?.[0];
  return session?.sessionId ?? session?.id ?? null;
}

function getCustomerName(booking: TodayBookingItem) {
  return booking.participantDetails?.[0]?.name || booking.plannedParticipants?.[0] || 'Khách hàng';
}

export function StaffBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<TodayBookingItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const loadBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await staffApi.getTodayBookings();
      setBookings(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải lịch hôm nay.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()
    );

    if (activeFilter === 'ALL') return sorted;
    if (activeFilter === 'CHECKED_IN') return sorted.filter((booking) => !!getSessionId(booking));
    return sorted.filter((booking) => booking.status === activeFilter && !getSessionId(booking));
  }, [activeFilter, bookings]);

  const handleOpenBooking = (booking: TodayBookingItem) => {
    const sessionId = getSessionId(booking);
    if (sessionId) {
      router.push(`/staff/session/${sessionId}` as any);
    }
  };

  const handleCheckIn = async (booking: TodayBookingItem) => {
    const sessionId = getSessionId(booking);
    if (sessionId) {
      router.push(`/staff/session/${sessionId}` as any);
      return;
    }

    if (booking.status !== 'CONFIRMED') {
      Alert.alert('Không thể check-in', 'Lịch này chưa ở trạng thái đã xác nhận.');
      return;
    }

    setCheckingInId(booking.bookingId);
    try {
      const session = await staffApi.checkIn(booking.bookingId);
      const newSessionId = session?.sessionId ?? session?.id;
      await loadBookings(true);
      if (newSessionId) {
        router.push(`/staff/session/${newSessionId}` as any);
      } else {
        Alert.alert('Đã check-in', 'Phiên đã được tạo.');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể check-in lịch này.';
      Alert.alert('Lỗi check-in', message);
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <View className="border-b border-slate-200 dark:border-slate-900 px-5 py-4">
        <Text className="text-[12px] uppercase tracking-wider text-slate-500 dark:text-slate-400" weight="700">
          Staff
        </Text>
        <Text className="mt-1 text-[22px] text-slate-900 dark:text-white" weight="700">
          Lịch hôm nay
        </Text>
      </View>

      <View className="py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5"
        >
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                className={`rounded-xl border px-3 py-2 ${
                  active
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60'
                }`}
              >
                <Text className={`text-[11px] ${active ? 'text-[#f97316]' : 'text-slate-500 dark:text-slate-400'}`} weight="700">
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.bookingId}
          contentContainerClassName="px-5 pb-24 pt-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadBookings(true)}
              colors={['#f97316']}
              tintColor="#f97316"
            />
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              checkingIn={checkingInId === item.bookingId}
              onOpen={() => handleOpenBooking(item)}
              onCheckIn={() => handleCheckIn(item)}
            />
          )}
          ListEmptyComponent={
            <View className="mt-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/40 p-6">
              <Text className="text-center text-[14px] text-slate-800 dark:text-slate-300" weight="700">
                Không có lịch phù hợp
              </Text>
              <Text className="mt-1 text-center text-[11px] text-slate-500">
                Thử đổi bộ lọc hoặc kéo xuống để tải lại dữ liệu.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function BookingCard({
  booking,
  checkingIn,
  onCheckIn,
  onOpen,
}: {
  booking: TodayBookingItem;
  checkingIn: boolean;
  onCheckIn: () => void;
  onOpen: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const start = formatDateTime(booking.slotStart);
  const end = formatDateTime(booking.slotEnd);
  const sessionId = getSessionId(booking);
  const customerName = getCustomerName(booking);
  const canCheckIn = booking.status === 'CONFIRMED' || !!sessionId;

  return (
    <Pressable
      onPress={sessionId ? onOpen : undefined}
      className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 active:bg-slate-50 dark:active:bg-slate-900 shadow-sm"
    >
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[15px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
            {customerName}
          </Text>
          <Text className="mt-1 text-[11px] text-slate-500">
            #{booking.shortCode || booking.bookingId.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-2 py-1">
          <Text className="text-[9px] uppercase text-slate-600 dark:text-slate-300" weight="700">
            {sessionId ? 'CHECKED_IN' : booking.status}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <InfoRow Icon={CalendarDays} text={`${start.date} • ${start.time} - ${end.time}`} colorScheme={colorScheme} />
        <InfoRow Icon={Car} text={`${booking.playMode} • ${booking.trackName || booking.trackType || 'Track'}`} colorScheme={colorScheme} />
        <InfoRow Icon={UserRound} text={`${booking.plannedParticipants?.length || 1} người chơi`} colorScheme={colorScheme} />
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
        <Text className="text-[12px] text-[#f97316]" weight="700">
          {Number(booking.totalAmount || 0).toLocaleString('vi-VN')}đ
        </Text>
        <Pressable
          disabled={!canCheckIn || checkingIn}
          onPress={onCheckIn}
          className={`flex-row items-center gap-1 rounded-xl px-3 py-2 ${
            canCheckIn ? 'bg-[#ea580c] active:bg-[#f97316]' : 'bg-slate-200 dark:bg-slate-800 opacity-50'
          }`}
        >
          {checkingIn ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : sessionId ? (
            <Clock color="#ffffff" size={14} />
          ) : (
            <LogIn color="#ffffff" size={14} />
          )}
          <Text className="text-[11px] text-white" weight="700">
            {sessionId ? 'Mở phiên' : 'Check-in'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function InfoRow({ Icon, text, colorScheme }: { Icon: LucideIcon; text: string; colorScheme: string | null | undefined }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon color={colorScheme === 'dark' ? '#94a3b8' : '#64748b'} size={13} />
      <Text className="flex-1 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
