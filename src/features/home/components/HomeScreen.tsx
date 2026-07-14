import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MapPin,
  CalendarDays,
  Package as PackageIcon,
  Car,
  ArrowRight,
  Star,
  Clock,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Search,
  CreditCard,
  Gamepad2,
} from 'lucide-react-native';

import { useAuthStore } from '@/shared/store/auth-store';
import { Text } from '@/shared/ui/Text';
import { requestMainTab } from '@/shared/ui/main-tab-events';
import { getMyBookings, type BookingListItem } from '@/features/bookings/api/booking.api';
import { getMyPackages, type MyPackageResponse } from '@/features/packages/api/package.api';
import { getCafes } from '@/features/explore/api/explore.api';
import { NotificationBellButton } from '@/features/notifications/components/NotificationBellButton';
import type { Cafe } from '@/features/explore/types/explore.types';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(-2)
    .toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatTimeRange(startIso: string, endIso: string) {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const sh = String(start.getHours()).padStart(2, '0');
    const sm = String(start.getMinutes()).padStart(2, '0');
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const y = start.getFullYear();
    return `${sh}:${sm} - ${eh}:${em} • Ngày ${d}/${m}/${y}`;
  } catch {
    return 'Chưa xác định thời gian';
  }
}

function formatExpiryDate(isoString: string) {
  try {
    const d = new Date(isoString);
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${date}/${month}/${year}`;
  } catch {
    return 'Chưa rõ';
  }
}

const REVIEWS = [
  {
    id: '1',
    name: 'Hoàng Minh Tuấn',
    role: 'RC Enthusiast • Hà Nội',
    content: 'Trước đây tôi phải nhắn tin Facebook để đặt lịch, nhiều khi chờ cả tiếng không thấy rep. Giờ đặt xong là có lịch ngay, còn biết chính xác xe nào mình sẽ dùng.',
    avatar: 'HT',
  },
  {
    id: '2',
    name: 'Ngọc Linh',
    role: 'BYOC Player • TP. HCM',
    content: 'Tôi hay mang xe riêng đi chơi, tính năng BYOC rất tiện. Đặt chỗ trước, đến nơi check-in là chạy luôn không cần chờ nhân viên sắp xếp.',
    avatar: 'NL',
  },
  {
    id: '3',
    name: 'Minh Khoa',
    role: 'Chạy tuần 2 lần • Đà Nẵng',
    content: 'Phần kiểm tra xe 4 góc lúc đầu nghĩ phức tạp nhưng thực ra rất nhanh. Và lần đầu tiên tôi không lo ngại khi trả xe vì mọi thứ đã được ghi nhận rõ ràng.',
    avatar: 'MK',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Tìm sân phù hợp',
    desc: 'Lọc thành phố, track, xem ảnh & bản đồ.',
    Icon: Search,
    color: '#f97316',
  },
  {
    num: '02',
    title: 'Chọn giờ & đặt xe',
    desc: 'Chọn khung giờ trống, thuê xe hoặc mang xe riêng.',
    Icon: CalendarDays,
    color: '#10b981',
  },
  {
    num: '03',
    title: 'Thanh toán & nhận lịch',
    desc: 'Thanh toán cọc online, nhận mã check-in tức thì.',
    Icon: CreditCard,
    color: '#3b82f6',
  },
  {
    num: '04',
    title: 'Check-in & chạy',
    desc: 'Quét mã check-in tại quầy, kiểm tra xe và đua ngay.',
    Icon: Gamepad2,
    color: '#8b5cf6',
  },
];

export function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [upcomingBooking, setUpcomingBooking] = useState<BookingListItem | null>(null);
  const [activePackages, setActivePackages] = useState<MyPackageResponse[]>([]);
  const [featuredCafes, setFeaturedCafes] = useState<Cafe[]>([]);

  const displayName = user?.fullName ?? user?.email ?? 'Khách hàng';
  const greeting = useMemo(() => getGreeting(), []);
  const isCustomer = user?.role === 'customer';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!isCustomer) {
        const cafesResult = await getCafes();
        setUpcomingBooking(null);
        setActivePackages([]);
        setFeaturedCafes(cafesResult.slice(0, 5));
        return;
      }

      const [bookingsResult, packagesResult, cafesResult] = await Promise.all([
        getMyBookings({ limit: 10 }),
        getMyPackages('ACTIVE'),
        getCafes(),
      ]);

      const now = new Date();
      const upcoming = bookingsResult.data
        .filter((b) => (b.status === 'CONFIRMED' || b.status === 'PENDING') && new Date(b.slotStart) > now)
        .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime())[0] || null;
      setUpcomingBooking(upcoming);
      setActivePackages(packagesResult);
      setFeaturedCafes(cafesResult.slice(0, 5));
    } catch (err) {
      console.error('[HomeScreen] Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigateToExplore = () => {
    requestMainTab(1);
  };

  const handleNavigateToBookings = () => {
    requestMainTab(2);
  };

  const handleSelectCafe = (cafeId: string) => {
    router.push({
      pathname: '/explore-map',
      params: { cafeId },
    } as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background Glows */}
      <View className="absolute -top-20 -right-20 w-85 h-85 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none" />
      <View className="absolute bottom-10 -left-20 w-85 h-85 rounded-full bg-[#3b82f6]/5 blur-3xl pointer-events-none" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="flex-grow px-5 py-6 pb-16"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadData}
              colors={['#f97316']}
              tintColor="#f97316"
            />
          }
        >
          {/* Header Section */}
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-3.5">
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  className="h-11 w-11 rounded-full border border-[#f97316]/30 shadow-md"
                />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#ea580c]/10 border border-[#ea580c]/30">
                  <Text className="text-[13px] font-bold text-[#f97316]">
                    {getInitials(displayName)}
                  </Text>
                </View>
              )}
              <View>
                <Text className="text-[11px] text-slate-400 font-semibold">{greeting},</Text>
                <Text className="text-[16px] text-white" weight="700">
                  {displayName}
                </Text>
              </View>
            </View>
            <NotificationBellButton size="md" />
          </View>

          {/* Hero Promo Banner (Bổ sung mới theo Web) */}
          <Pressable
            onPress={handleNavigateToExplore}
            className="mb-6 rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-5 shadow-lg overflow-hidden"
          >
            {/* Background overlay glow */}
            <View className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-[#f97316]/5 blur-xl pointer-events-none" />

            <View className="flex-row gap-4">
              {/* Cột trái: Nội dung chữ */}
              <View className="flex-1 pr-1">
                <View className="rounded-lg bg-[#ea580c]/10 border border-[#ea580c]/20 px-2 py-0.5 self-start mb-2.5">
                  <Text className="text-[8px] text-[#f97316] font-bold uppercase tracking-wider">
                    Nền tảng đặt lịch RC tại Việt Nam
                  </Text>
                </View>

                <Text className="text-[17px] text-white leading-6.5" weight="700">
                  Chạy RC <Text className="text-[#f97316]">đúng sân</Text>,{'\n'}đúng giờ, không lo cọc.
                </Text>
                
                <Text className="text-[10px] text-slate-400 mt-2 leading-4 font-semibold">
                  Tìm RC Cafe gần bạn, thuê xe và thanh toán cọc online trong vài phút.
                </Text>

                <View className="flex-row items-center gap-1.5 mt-3.5">
                  <Text className="text-[11px] text-[#f97316]" weight="700">
                    Khám phá ngay
                  </Text>
                  <ArrowRight color="#f97316" size={12} />
                </View>
              </View>

              {/* Cột phải: Hình ảnh minh hoạ xe RC đỏ giống Web */}
              <View className="justify-center items-center">
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?q=80&w=250&auto=format&fit=crop' }}
                  className="h-24 w-24 rounded-2xl border border-slate-800"
                  style={{ transform: [{ rotate: '-6deg' }] }}
                />
              </View>
            </View>

            {/* Stats chân banner */}
            <View className="h-[1px] bg-slate-800/80 my-4" />
            <View className="flex-row justify-between items-center px-1">
              <View className="items-center">
                <Text className="text-[13px] text-white" weight="700">50+</Text>
                <Text className="text-[9px] text-slate-500 font-semibold mt-0.5">RC Cafe</Text>
              </View>
              <View className="items-center">
                <Text className="text-[13px] text-white" weight="700">12k+</Text>
                <Text className="text-[9px] text-slate-500 font-semibold mt-0.5">Phiên chơi</Text>
              </View>
              <View className="items-center">
                <Text className="text-[13px] text-white" weight="700">4.8★</Text>
                <Text className="text-[9px] text-slate-500 font-semibold mt-0.5">Đánh giá TB</Text>
              </View>
            </View>
          </Pressable>

          {/* Quick Actions Grid */}
          <View className="flex-row gap-3 mb-6">
            <Pressable
              onPress={handleNavigateToExplore}
              className="flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-[#0f172a]/50 py-3.5 shadow-sm active:bg-slate-900/50"
            >
              <View className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/10 border border-orange-500/20">
                <MapPin color="#ea580c" size={20} />
              </View>
              <Text className="text-[12px] text-slate-200" weight="700">
                Tìm sân
              </Text>
            </Pressable>

            <Pressable
              onPress={handleNavigateToBookings}
              className="flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-[#0f172a]/50 py-3.5 shadow-sm active:bg-slate-900/50"
            >
              <View className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 border border-emerald-500/20">
                <CalendarDays color="#10b981" size={20} />
              </View>
              <Text className="text-[12px] text-slate-200" weight="700">
                Lịch đặt
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/customer/packages' as any)}
              className="flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-[#0f172a]/50 py-3.5 shadow-sm active:bg-slate-900/50"
            >
              <View className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20">
                <PackageIcon color="#8b5cf6" size={20} />
              </View>
              <Text className="text-[12px] text-slate-200" weight="700">
                Gói chơi
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                React['startTransition'](() => {
                  Alert.alert('Đội xe', 'Tính năng Xe của tôi (BYOC) đang được nâng cấp.');
                })
              }
              className="flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-[#0f172a]/50 py-3.5 shadow-sm active:bg-slate-900/50"
            >
              <View className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600/10 border border-sky-500/20">
                <Car color="#0ea5e9" size={20} />
              </View>
              <Text className="text-[12px] text-slate-200" weight="700">
                Đội xe
              </Text>
            </Pressable>
          </View>

          {/* Upcoming Booking / Payment Alert */}
          <View className="mb-6">
            <Text className="text-[13px] text-slate-400 uppercase tracking-wider mb-2.5 font-bold">
              Lịch đặt sắp tới
            </Text>

            {upcomingBooking ? (
              upcomingBooking.status === 'PENDING' ? (
                <View className="rounded-2xl border border-amber-900/40 bg-amber-950/15 p-4 flex-row gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle color="#f59e0b" size={20} />
                  </View>
                  <View className="flex-1 pr-2 justify-between">
                    <View>
                      <Text className="text-[14px] text-amber-500" weight="700">
                        Chờ thanh toán
                      </Text>
                      <Text className="text-[11px] text-amber-500/80 mt-0.5 leading-4 font-semibold">
                        Lịch đặt của bạn sẽ bị hủy nếu không thanh toán trước khi hết hạn.
                      </Text>
                      <Text className="text-[12px] text-slate-200 mt-2 font-bold">
                        {formatTimeRange(upcomingBooking.slotStart, upcomingBooking.slotEnd)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleNavigateToBookings}
                      className="mt-3 bg-amber-500 rounded-lg py-1.5 px-3 self-start active:bg-amber-600"
                    >
                      <Text className="text-[11px] text-[#0f172a] font-bold">Thanh toán ngay</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="rounded-2xl border border-emerald-950 bg-emerald-950/10 p-4 flex-row gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Clock color="#10b981" size={20} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-[14px] text-emerald-400 font-bold">
                        Sắp diễn ra
                      </Text>
                      <View className="rounded bg-emerald-500/20 px-1.5 py-0.5">
                        <Text className="text-[9px] text-emerald-400 font-bold">
                          {upcomingBooking.playMode}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[12px] text-slate-300 mt-1">
                      Thời gian:
                    </Text>
                    <Text className="text-[13px] text-white mt-0.5 font-bold">
                      {formatTimeRange(upcomingBooking.slotStart, upcomingBooking.slotEnd)}
                    </Text>
                    <Pressable
                      onPress={handleNavigateToBookings}
                      className="mt-3 flex-row items-center gap-1 active:opacity-75"
                    >
                      <Text className="text-[12px] text-emerald-400 font-bold">Xem vé check-in</Text>
                      <ArrowRight color="#10b981" size={13} />
                    </Pressable>
                  </View>
                </View>
              )
            ) : (
              <View className="rounded-2xl border border-dashed border-slate-800 bg-[#0f172a]/30 p-5 items-center">
                <Text className="text-[13px] text-slate-300 font-bold">Chưa có lịch đặt sân nào</Text>
                <Text className="mt-1 text-[11px] text-slate-400 text-center leading-4 font-semibold">
                  Tìm sân đua gần bạn và lên lịch chạy ngay hôm nay!
                </Text>
                <Pressable
                  onPress={handleNavigateToExplore}
                  className="mt-3.5 flex-row h-8.5 items-center justify-center rounded-xl bg-[#ea580c] active:bg-[#f97316] px-4 gap-1 shadow-sm"
                >
                  <Text className="text-[11px] text-white" weight="700">
                    Khám phá sân đua
                  </Text>
                  <ArrowRight color="#ffffff" size={12} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Active Packages (Gói hội viên đang dùng) */}
          <View className="mb-6">
            <Text className="text-[13px] text-slate-400 uppercase tracking-wider mb-2.5 font-bold">
              Gói hội viên đang dùng
            </Text>

            {activePackages.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3.5"
                className="py-1"
              >
                {activePackages.map((pkg) => {
                  const usedPercent = pkg.slots_total > 0 ? ((pkg.slots_total - pkg.slots_remaining) / pkg.slots_total) * 100 : 0;
                  return (
                    <Pressable
                      key={pkg.id}
                      onPress={() => router.push('/customer/packages' as any)}
                      className="w-64 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4 shadow-sm active:bg-slate-900/60"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-2">
                          <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
                            {pkg.package_name}
                          </Text>
                          <Text className="text-[10px] text-slate-400 mt-0.5" numberOfLines={1}>
                            {pkg.cafe_name}
                          </Text>
                        </View>
                        <View className="rounded bg-orange-500/10 px-1.5 py-0.5 border border-orange-500/20">
                          <Text className="text-[9px] text-[#f97316] font-bold">Active</Text>
                        </View>
                      </View>

                      <View className="mt-4">
                        <View className="flex-row justify-between items-baseline mb-1">
                          <Text className="text-[10px] text-slate-400 font-semibold">Tình trạng sử dụng</Text>
                          <Text className="text-[12px] text-white" weight="700">
                            {pkg.slots_remaining} / {pkg.slots_total} slots
                          </Text>
                        </View>
                        <View className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <View
                            className="h-full rounded-full bg-[#f97316]"
                            style={{ width: `${100 - usedPercent}%` }}
                          />
                        </View>
                      </View>

                      <View className="mt-4 flex-row items-center gap-1">
                        <Clock color="#94a3b8" size={11} />
                        <Text className="text-[10px] text-slate-400 font-semibold">
                          Hạn dùng: {formatExpiryDate(pkg.expires_at)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View className="rounded-2xl border border-dashed border-slate-800 bg-[#0f172a]/30 p-5 items-center">
                <Text className="text-[13px] text-slate-300 font-bold">Bạn chưa sở hữu gói hội viên nào</Text>
                <Text className="mt-1 text-[11px] text-slate-400 text-center leading-4 font-semibold">
                  Mua gói hội viên ngay để tiết kiệm chi phí và nhận nhiều ưu đãi slots chơi.
                </Text>
              </View>
            )}
          </View>

          {/* Quy trình 4 bước (Bổ sung mới theo Web) */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1.5 mb-2.5">
              <Sparkles color="#f97316" size={15} />
              <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
                Quy trình đặt sân
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3.5"
              className="py-1"
            >
              {STEPS.map((step, idx) => {
                const IconComponent = step.Icon;
                return (
                  <View
                    key={idx}
                    className="w-52 rounded-2xl border border-slate-800 bg-[#0f172a]/40 p-4 shadow-sm"
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-lg border"
                        style={{
                          backgroundColor: `${step.color}10`,
                          borderColor: `${step.color}30`,
                        }}
                      >
                        <IconComponent color={step.color} size={16} />
                      </View>
                      <Text className="text-[14px] text-slate-600" weight="700">
                        {step.num}
                      </Text>
                    </View>
                    <Text className="text-[12px] text-white" weight="700">
                      {step.title}
                    </Text>
                    <Text className="text-[10px] text-slate-400 mt-1 leading-4.5 font-semibold">
                      {step.desc}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Người chơi nói gì (Testimonial - Bổ sung mới theo Web) */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1.5 mb-2.5">
              <MessageSquare color="#f97316" size={15} />
              <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
                Người chơi nói gì
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3.5"
              className="py-1"
            >
              {REVIEWS.map((rev) => (
                <View
                  key={rev.id}
                  className="w-64 rounded-2xl border border-slate-800 bg-[#0f172a]/40 p-4 shadow-sm"
                >
                  {/* Sao đánh giá */}
                  <View className="flex-row gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} color="#f59e0b" fill="#f59e0b" size={11} />
                    ))}
                  </View>

                  <Text className="text-[11px] text-slate-300 italic leading-4.5 font-semibold">
                    &quot;{rev.content}&quot;
                  </Text>

                  {/* Divider */}
                  <View className="h-[1px] bg-slate-800/60 my-3" />

                  {/* Info reviewer */}
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-[#ea580c]/10 border border-[#ea580c]/30">
                      <Text className="text-[9px] font-bold text-[#f97316]">{rev.avatar}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] text-white" weight="700" numberOfLines={1}>
                        {rev.name}
                      </Text>
                      <Text className="text-[9px] text-slate-500 font-semibold" numberOfLines={1}>
                        {rev.role}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Featured Cafes (Sân RC nổi bật - Giữ nguyên vị trí ưu tiên hiện tại) */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2.5">
              <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
                Sân RC nổi bật
              </Text>
              <Pressable onPress={handleNavigateToExplore} className="flex-row items-center gap-0.5 active:opacity-75">
                <Text className="text-[11px] text-[#f97316]" weight="700">
                  Xem thêm
                </Text>
                <ArrowRight color="#f97316" size={11} />
              </Pressable>
            </View>

            {featuredCafes.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3.5"
                className="py-1"
              >
                {featuredCafes.map((cafe) => (
                  <Pressable
                    key={cafe.id}
                    onPress={() => handleSelectCafe(cafe.id)}
                    className="w-48 overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]/60 shadow-sm active:bg-slate-900/60"
                  >
                    <Image source={{ uri: cafe.image }} className="h-28 w-full object-cover bg-slate-900" />
                    <View className="p-3">
                      <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
                        {cafe.name}
                      </Text>
                      <Text className="text-[10px] text-slate-400 mt-0.5" numberOfLines={1}>
                        {cafe.district}, {cafe.city}
                      </Text>
                      
                      <View className="flex-row justify-between items-center mt-3">
                        <View className="flex-row items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          <Star color="#f59e0b" fill="#f59e0b" size={10} />
                          <Text className="text-[9px] text-amber-500 font-bold">5.0</Text>
                        </View>
                        <Text className="text-[12px] text-[#f97316]" weight="700">
                          {cafe.priceRange.split(' ')[0]}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/30 p-5 items-center">
                <Text className="text-[12px] text-slate-400 font-semibold">Chưa có chi nhánh nổi bật</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
