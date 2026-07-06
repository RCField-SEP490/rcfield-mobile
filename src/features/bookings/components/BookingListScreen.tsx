import { useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  Car,
  ChevronRight,
  HelpCircle,
  CreditCard,
  Gamepad2,
  AlertTriangle,
  RotateCcw,
  BadgeAlert,
  Search,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyBookings, type BookingListItem, type BookingStatus } from '@/features/bookings/api/booking.api';
import { Text } from '@/shared/ui/Text';
import { cn } from '@/shared/lib/utils';

type FilterTab = 'upcoming' | 'active' | 'completed' | 'cancelled';

const TAB_CONFIG: Array<{ key: FilterTab; label: string }> = [
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'active', label: 'Đang chơi' },
  { key: 'completed', label: 'Đã chơi' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  PENDING: { label: 'Chờ thanh toán', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', icon: Clock },
  CONFIRMED: { label: 'Đã xác nhận', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', icon: Calendar },
  NO_SHOW: { label: 'Vắng mặt', bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400', icon: HelpCircle },
  COMPLETED: { label: 'Hoàn thành', bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400', icon: Gamepad2 },
  CANCELLED: { label: 'Đã hủy', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', icon: RotateCcw },
  
  // Trạng thái lồng ghép Session thực tế
  CHECKED_IN: { label: 'Đang check-in', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', icon: Clock },
  ACTIVE: { label: 'Đang chơi', bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-500', icon: Gamepad2 },
  EXTENDING: { label: 'Đang gia hạn', bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-500', icon: SparklesIcon },
  CHECKING_OUT: { label: 'Đang checkout', bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', icon: Clock },
};

function SparklesIcon(props: any) {
  return <Gamepad2 {...props} />;
}

export function BookingListScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load tối đa 50 đơn gần đây của khách hàng để phân loại
      const result = await getMyBookings({ limit: 50 });
      setBookings(result.data);
    } catch (error) {
      console.error('Failed to load bookings list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Phân loại bookings theo các Tab trạng thái tương ứng
  const filteredBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((b) => {
      const slotStart = new Date(b.slotStart);
      const isPast = slotStart < now;
      const sessStatus = b.session?.status;
      const hasActiveSession = sessStatus && ['ACTIVE', 'EXTENDING', 'CHECKED_IN', 'CHECKING_OUT'].includes(sessStatus);

      switch (activeTab) {
        case 'upcoming':
          // Đơn PENDING hoặc CONFIRMED chưa chơi
          return (b.status === 'PENDING' || b.status === 'CONFIRMED') && !isPast && !hasActiveSession;
        case 'active':
          // Đơn có session đang hoạt động thực tế tại sân
          return hasActiveSession && b.status !== 'CANCELLED';
        case 'completed':
          // Đơn đã kết thúc hoặc vắng mặt
          return b.status === 'COMPLETED' || b.status === 'NO_SHOW' || (isPast && b.status !== 'CANCELLED' && !hasActiveSession);
        case 'cancelled':
          // Đơn đã hủy
          return b.status === 'CANCELLED';
        default:
          return false;
      }
    });
  }, [bookings, activeTab]);

  const handleCardPress = (id: string) => {
    // Expo Router navigation to dynamic path app/booking/[id].tsx
    router.push(`/booking/${id}` as any);
  };

  const renderBookingItem = ({ item }: { item: BookingListItem }) => {
    // Ưu tiên ghi đè hiển thị trạng thái bằng trạng thái của Session thực tế
    const sessStatus = item.session?.status;
    const isSessionActive = sessStatus && ['ACTIVE', 'EXTENDING', 'CHECKED_IN', 'CHECKING_OUT'].includes(sessStatus);
    const displayStatus = isSessionActive ? sessStatus : item.status;
    const status = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.PENDING;
    const StatusIcon = status.icon;

    const slotStart = new Date(item.slotStart);
    const slotEnd = new Date(item.slotEnd);
    const dateLabel = slotStart.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const timeLabel = `${slotStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    const shortId = item.id.substring(0, 8).toUpperCase();
    
    // Fallback lấy tiền từ snapshot.total_charged của entity
    const totalAmount = item.totalAmount ?? (item as any).total_amount ?? (item as any).snapshot?.total_charged ?? 0;
    const formattedAmount = Number(totalAmount).toLocaleString('vi-VN') + 'đ';

    return (
      <Pressable
        className="mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]/60 active:bg-[#0f172a]/90 shadow-xl"
        onPress={() => handleCardPress(item.id)}
      >
        {/* Glow nhỏ trên đầu card chỉ trạng thái hoạt động */}
        {isSessionActive && (
          <View className="absolute top-0 right-0 left-0 h-[2px] bg-orange-500" />
        )}
        
        <View className="p-5 space-y-3">
          {/* Top Row: Mã Booking & Trạng thái */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-slate-400 text-xs font-bold font-mono">#{shortId}</Text>
              <View className={cn("px-2 py-0.5 rounded-full border flex-row items-center gap-1", status.bg)}>
                <StatusIcon color={status.text === 'text-orange-500' ? '#f97316' : status.text === 'text-emerald-500' ? '#10b981' : status.text === 'text-amber-500' || status.text === 'text-amber-400' ? '#f59e0b' : status.text === 'text-blue-400' ? '#60a5fa' : '#ef4444'} size={10} />
                <Text className={cn("text-[9px] font-black uppercase tracking-wide", status.text)}>
                  {status.label}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <Text className="text-white text-sm" weight="700">
                {formattedAmount}
              </Text>
            </View>
          </View>

          {/* Middle: Chi nhánh và Giờ giấc */}
          <View className="space-y-2">
            <Text className="text-white text-[15px]" weight="600">
              {item.cafe?.name ?? 'RCField Platform Branch'}
            </Text>
            <View className="flex-row flex-wrap items-center gap-y-1 gap-x-3.5">
              <View className="flex-row items-center gap-1">
                <Calendar color="#94a3b8" size={13} />
                <Text className="text-slate-400 text-xs font-semibold">{dateLabel}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock color="#94a3b8" size={13} />
                <Text className="text-slate-400 text-xs font-semibold">{timeLabel}</Text>
              </View>
              <View className={cn("px-2 py-0.5 rounded-md border", item.playMode === 'RENTAL' ? 'bg-orange-500/5 border-orange-500/10' : 'bg-blue-500/5 border-blue-500/10')}>
                <Text className={cn("text-[9px] font-bold uppercase", item.playMode === 'RENTAL' ? 'text-orange-500' : 'text-blue-400')}>
                  {item.playMode === 'RENTAL' ? 'Thuê xe' : 'Xe riêng'}
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom: Warning cho đơn Pending */}
          {item.status === 'PENDING' && item.paymentExpiresAt && (
            <View className="flex-row items-center gap-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 p-2">
              <AlertTriangle color="#f59e0b" size={12} />
              <Text className="text-amber-500 text-[10px] font-semibold flex-1">
                Hạn thanh toán: {new Date(item.paymentExpiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {new Date(item.paymentExpiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background Lights */}
      <View className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none" />
      <View className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-[#6366f1]/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <View className="px-5 pt-3 pb-4">
        <Text className="text-white text-3xl" variant="title" weight="700">
          Lịch sử đặt sân
        </Text>
        <Text className="mt-1 text-[13px] text-slate-400 font-semibold">
          Quản lý và xem tiến trình các lượt chơi của bạn.
        </Text>
      </View>

      {/* Tab Filter */}
      <View className="px-5 mb-5 flex-row gap-2">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              className={cn(
                "flex-grow py-2.5 rounded-xl border items-center justify-center transition-all",
                isActive
                  ? "bg-[#ea580c] border-[#ea580c] shadow-md shadow-orange-500/10"
                  : "bg-[#0f172a]/60 border-slate-800"
              )}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                className={cn("text-[12px] font-bold", isActive ? "text-white" : "text-slate-400")}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bookings List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#ea580c" size="large" />
          <Text className="mt-3 text-slate-400 text-xs font-semibold">Đang tải lịch sử đặt sân...</Text>
        </View>
      ) : filteredBookings.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchBookings(true)}
              tintColor="#ea580c"
              colors={['#ea580c']}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center px-8 py-20 mt-10">
              <View className="size-16 rounded-full bg-slate-900 border border-slate-800 justify-center items-center mb-4">
                <HelpCircle color="#475569" size={28} />
              </View>
              <Text className="text-white text-base font-bold text-center">
                Không tìm thấy lịch đặt nào
              </Text>
              <Text className="mt-1.5 text-slate-400 text-xs text-center leading-4 font-semibold max-w-xs">
                Bạn không có đơn đặt nào trong danh mục này hoặc bộ lọc đang chọn.
              </Text>
              <Pressable
                className="mt-6 px-5 py-2.5 rounded-xl bg-[#ea580c] active:bg-[#f97316] shadow-md"
                onPress={() => router.push('/booking/create')}
              >
                <Text className="text-white text-xs font-bold">Đặt lịch ngay</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchBookings(true)}
              tintColor="#ea580c"
              colors={['#ea580c']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
