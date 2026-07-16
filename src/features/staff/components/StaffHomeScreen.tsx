import { useRouter } from 'expo-router';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarClock,
  ClipboardCheck,
  Coffee,
  LogIn,
  PlayCircle,
  QrCode,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { staffApi, type TodayBookingItem, type TodayFnbOrderItem } from '@/features/staff/api/staff.api';
import { useAuthStore } from '@/shared/store/auth-store';
import { Text } from '@/shared/ui/Text';
import { requestMainTab } from '@/shared/ui/main-tab-events';

function formatTime(iso?: string) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function getSessionId(booking: TodayBookingItem) {
  const session = booking.sessions?.[0];
  return session?.sessionId ?? session?.id ?? null;
}

export function StaffHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const assignedCafeId = useAuthStore((state) => state.assignedCafeId);

  const [bookings, setBookings] = useState<TodayBookingItem[]>([]);
  const [fnbOrders, setFnbOrders] = useState<TodayFnbOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [todayBookings, todayFnbOrders] = await Promise.all([
        staffApi.getTodayBookings(),
        staffApi.getFnbOrders(),
      ]);
      setBookings(todayBookings);
      setFnbOrders(todayFnbOrders);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu trực ca.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const activeSessions = bookings.filter((booking) =>
      booking.sessions?.some((session) =>
        ['ACTIVE', 'EXTENDING', 'CHECKED_IN', 'CHECKING_OUT'].includes(session.status || '')
      )
    ).length;
    const checkInReady = bookings.filter(
      (booking) => booking.status === 'CONFIRMED' && !getSessionId(booking)
    ).length;
    const pendingFnb = fnbOrders.filter((order) =>
      order.status === 'PENDING' || order.status === 'CONFIRMED'
    ).length;

    return {
      activeSessions,
      checkInReady,
      pendingFnb,
      totalBookings: bookings.length,
    };
  }, [bookings, fnbOrders]);

  const handleCheckIn = async (booking: TodayBookingItem) => {
    const sessionId = getSessionId(booking);
    if (sessionId) {
      router.push(`/staff/session/${sessionId}` as any);
      return;
    }

    if (booking.status !== 'CONFIRMED') {
      Alert.alert('Không thể check-in', 'Chỉ lịch đã xác nhận mới được bắt đầu check-in.');
      return;
    }

    setCheckingInId(booking.bookingId);
    try {
      const session = await staffApi.checkIn(booking.bookingId);
      const newSessionId = session?.sessionId ?? session?.id;
      Alert.alert('Đã bắt đầu check-in', `Phiên ${shortId(newSessionId || booking.bookingId)} đã được tạo.`);
      await loadData(true);
      if (newSessionId) {
        router.push(`/staff/session/${newSessionId}` as any);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể bắt đầu check-in.';
      Alert.alert('Lỗi check-in', message);
    } finally {
      setCheckingInId(null);
    }
  };

  const handleScanSubmit = () => {
    const normalized = scanCode.trim().toUpperCase();
    if (!normalized) return;

    const matched = bookings.find(
      (booking) =>
        booking.shortCode?.toUpperCase() === normalized ||
        booking.bookingId.toUpperCase() === normalized ||
        shortId(booking.bookingId) === normalized
    );

    if (!matched) {
      Alert.alert('Không tìm thấy', `Không có lịch hôm nay khớp mã "${scanCode}".`);
      return;
    }

    void handleCheckIn(matched);
  };

  if (!assignedCafeId) {
    return (
      <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19] px-5" edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
            <QrCode color="#f59e0b" size={28} />
          </View>
          <Text className="text-center text-[17px] text-slate-900 dark:text-white" weight="700">
            Chưa được gán chi nhánh
          </Text>
          <Text className="mt-2 text-center text-[12px] leading-5 text-slate-500 dark:text-slate-400">
            Tài khoản staff cần được provider phân công vào một RC Cafe trước khi trực ca.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-5 py-6 pb-20"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor="#f97316"
              colors={['#f97316']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 flex-row items-center justify-between">
            <View>
              <Text className="text-[12px] uppercase tracking-wider text-slate-500 dark:text-slate-400" weight="700">
                Trực ca mobile
              </Text>
              <Text className="mt-1 text-[22px] text-slate-900 dark:text-white" weight="700">
                {user?.fullName ?? 'Nhân viên'}
              </Text>
            </View>
            <Pressable
              onPress={() => loadData(true)}
              className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] active:bg-slate-100 dark:active:bg-slate-900"
            >
              <RotateCcw color="#f97316" size={18} />
            </Pressable>
          </View>

          <View className="mb-5 flex-row flex-wrap gap-3">
            <StatCard label="Lịch hôm nay" value={stats.totalBookings} Icon={CalendarClock} />
            <StatCard label="Sẵn sàng check-in" value={stats.checkInReady} Icon={ClipboardCheck} />
            <StatCard label="Đang chạy" value={stats.activeSessions} Icon={PlayCircle} />
            <StatCard label="F&B chờ" value={stats.pendingFnb} Icon={Coffee} />
          </View>

          <View className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/70 p-4 shadow-sm">
            <View className="mb-3 flex-row items-center gap-2">
              <QrCode color="#f97316" size={18} />
              <Text className="text-[14px] text-slate-900 dark:text-white" weight="700">
                Check-in bằng mã đặt lịch
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={scanCode}
                onChangeText={setScanCode}
                autoCapitalize="characters"
                placeholder="Nhập shortcode hoặc booking ID"
                placeholderTextColor="#94a3b8"
                className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b0f19] px-3 text-[13px] text-slate-900 dark:text-white"
              />
              <Pressable
                onPress={handleScanSubmit}
                className="h-11 items-center justify-center rounded-xl bg-[#ea580c] px-4 active:bg-[#f97316]"
              >
                <Text className="text-[12px] text-white" weight="700">
                  Mở
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[13px] uppercase tracking-wider text-slate-500 dark:text-slate-400" weight="700">
              Lịch gần nhất
            </Text>
            <Pressable onPress={() => requestMainTab(1)}>
              <Text className="text-[12px] text-[#f97316] font-bold">
                Xem tất cả
              </Text>
            </Pressable>
          </View>

          <View className="gap-3">
            {bookings.slice(0, 5).map((booking) => (
              <BookingRow
                key={booking.bookingId}
                booking={booking}
                checkingIn={checkingInId === booking.bookingId}
                onPress={() => handleCheckIn(booking)}
              />
            ))}
            {bookings.length === 0 && (
              <View className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/40 p-5">
                <Text className="text-center text-[13px] text-slate-800 dark:text-slate-300" weight="700">
                  Hôm nay chưa có lịch
                </Text>
                <Text className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
                  Khi có khách đặt sân hoặc walk-in, lịch sẽ hiển thị tại đây.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <View className="w-[47%] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
        <Icon color="#f97316" size={18} />
      </View>
      <Text className="text-[20px] text-slate-900 dark:text-white" weight="700">
        {value}
      </Text>
      <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}

function BookingRow({
  booking,
  checkingIn,
  onPress,
}: {
  booking: TodayBookingItem;
  checkingIn: boolean;
  onPress: () => void;
}) {
  const sessionId = getSessionId(booking);
  const customer = booking.participantDetails?.[0]?.name || booking.plannedParticipants?.[0] || 'Khách hàng';

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 active:bg-slate-50 dark:active:bg-slate-900 shadow-sm"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[14px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
            {customer}
          </Text>
          <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
            #{booking.shortCode || shortId(booking.bookingId)} • {booking.trackName || booking.trackType}
          </Text>
          <Text className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {formatTime(booking.slotStart)} - {formatTime(booking.slotEnd)} • {booking.playMode}
          </Text>
        </View>
        <View className="items-end">
          <View className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
            <Text className="text-[9px] uppercase text-emerald-600 dark:text-emerald-400" weight="700">
              {sessionId ? 'Đã check-in' : booking.status}
            </Text>
          </View>
          <View className="mt-3 flex-row items-center gap-1">
            {checkingIn ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <LogIn color="#f97316" size={14} />
            )}
            <Text className="text-[11px] text-[#f97316]" weight="700">
              {sessionId ? 'Mở phiên' : 'Check-in'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}


