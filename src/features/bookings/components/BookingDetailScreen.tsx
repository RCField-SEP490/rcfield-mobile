import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Phone,
  Compass,
  ArrowRightLeft,
  Coins,
  Camera,
  User,
  ExternalLink,
  CreditCard,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  View,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bookingWizardApi } from '@/features/bookings/api/booking-wizard.api';
import { Text } from '@/shared/ui/Text';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/store/auth-store';

interface BookingDetailScreenProps {
  bookingId: string;
}

export function BookingDetailScreen({ bookingId }: BookingDetailScreenProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingAdditionalPayment, setSubmittingAdditionalPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // States cho Hủy Đặt Lịch
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const loadBookingDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingWizardApi.getBooking(bookingId);
      setBooking(data);
    } catch (error) {
      console.error('Failed to load booking detail:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chi tiết lượt đặt sân.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBookingDetail();
  }, [loadBookingDetail]);

  // Hủy Lịch Đặt
  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do hủy đặt lịch.');
      return;
    }

    setCancelling(true);
    try {
      await bookingWizardApi.cancelBooking(bookingId, cancelReason.trim());
      setCancelModalVisible(false);
      setCancelReason('');
      Alert.alert('Thành công', 'Đã hủy đặt lịch thành công.');
      loadBookingDetail();
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Hủy đặt lịch thất bại. Vui lòng thử lại.';
      Alert.alert('Lỗi', errMsg);
    } finally {
      setCancelling(false);
    }
  };

  // Thanh toán lại VNPay
  const handlePayment = async () => {
    setSubmittingPayment(true);
    try {
      // Host IP LAN được phân tách từ URL API của Mobile
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.4:3000/api/v1';
      let hostAndPort = '192.168.1.4:3000';
      try {
        const urlObj = new URL(apiUrl);
        hostAndPort = urlObj.host;
      } catch {
        const match = apiUrl.match(/https?:\/\/([^\/]+)/);
        if (match) hostAndPort = match[1];
      }

      const returnUrl = `http://${hostAndPort}/api/v1/bookings/vnpay-return`;
      const res = await bookingWizardApi.createCheckout(bookingId, returnUrl);

      if (res.payment_url) {
        // Mở trình duyệt in-app
        const result = await WebBrowser.openBrowserAsync(res.payment_url);
        // Khi người dùng đóng trình duyệt, reload lại data
        loadBookingDetail();
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy URL thanh toán VNPay.');
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Khởi tạo thanh toán VNPay thất bại.';
      Alert.alert('Lỗi thanh toán', errMsg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Thanh toán phí phát sinh VNPay
  const handlePaymentAdditional = async () => {
    if (submittingAdditionalPayment) return;
    setSubmittingAdditionalPayment(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.4:3000/api/v1';
      let hostAndPort = '192.168.1.4:3000';
      try {
        const urlObj = new URL(apiUrl);
        hostAndPort = urlObj.host;
      } catch {
        const match = apiUrl.match(/https?:\/\/([^\/]+)/);
        if (match) hostAndPort = match[1];
      }

      const returnUrl = `http://${hostAndPort}/api/v1/bookings/vnpay-return`;
      const res = await bookingWizardApi.createCheckoutAdditionalPayment(bookingId, returnUrl);

      if (res.payment_url) {
        const result = await WebBrowser.openBrowserAsync(res.payment_url);
        loadBookingDetail();
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy URL thanh toán VNPay.');
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Khởi tạo thanh toán VNPay thất bại.';
      Alert.alert('Lỗi thanh toán', errMsg);
    } finally {
      setSubmittingAdditionalPayment(false);
    }
  };

  // Tính toán phí hoàn trả dự kiến khi hủy (Refund Estimation)
  const refundEstimation = useMemo(() => {
    if (!booking) return null;
    const now = new Date();
    const slotStart = new Date(booking.slotStart);
    const diffHours = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    const slotFee = Number(booking.paymentComponents?.find((c: any) => c.type === 'SLOT_FEE')?.amount || 0);
    const rentalFee = Number(booking.paymentComponents?.find((c: any) => c.type === 'RENTAL_FEE')?.amount || 0);
    const deposit = Number(booking.paymentComponents?.find((c: any) => c.type === 'SECURITY_DEPOSIT')?.amount || 0);
    const fnb = Number(booking.paymentComponents?.find((c: any) => c.type === 'FNB_PREORDER')?.amount || 0);

    let refundSlotFee = 0;
    let policyText = '';

    if (diffHours >= 24) {
      refundSlotFee = slotFee; // Hoàn 100% tiền sân
      policyText = 'Hủy trước 24h: Hoàn trả 100% phí sân';
    } else if (diffHours >= 12) {
      refundSlotFee = slotFee * 0.5; // Hoàn 50% tiền sân
      policyText = 'Hủy từ 12h - 24h: Hoàn trả 50% phí sân';
    } else {
      refundSlotFee = 0; // Hoàn 0% tiền sân
      policyText = 'Hủy dưới 12h: Không hoàn phí sân';
    }

    // Các phí xe, cọc xe, fnb được hoàn lại 100%
    const totalRefund = refundSlotFee + rentalFee + deposit + fnb;

    return {
      refundSlotFee,
      rentalFee,
      deposit,
      fnb,
      totalRefund,
      policyText,
      diffHours,
    };
  }, [booking]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0f19] justify-center items-center">
        <ActivityIndicator color="#ea580c" size="large" />
        <Text className="mt-3 text-slate-400 text-xs font-semibold">Đang tải chi tiết đặt sân...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0f19] px-5 justify-center items-center">
        <AlertCircle color="#ef4444" size={48} />
        <Text className="text-white text-lg font-bold mt-4">Không tìm thấy đơn đặt sân</Text>
        <Pressable
          className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 active:bg-slate-700"
          onPress={() => router.back()}
        >
          <Text className="text-white text-xs font-bold">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const slotStart = new Date(booking.slotStart);
  const slotEnd = new Date(booking.slotEnd);
  const dateLabel = slotStart.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeLabel = `${slotStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  const shortId = booking.id.substring(0, 8).toUpperCase();

  // ── Tính toán các khoản hóa đơn theo logic của Web ──
  const snapshot = booking.snapshot as any;
  const snapshotSlotFee = Number(snapshot?.slot_fee_total ?? snapshot?.slot_fee ?? 0);
  const snapshotRentalFee = Number(
    snapshot?.vehicles?.reduce((sum: number, v: any) => sum + Number(v.rental_fee ?? 0), 0) ??
    snapshot?.rental_fee ?? 0
  );
  const snapshotDeposit = Number(
    snapshot?.vehicles?.reduce((sum: number, v: any) => sum + Number(v.security_deposit ?? 0), 0) ??
    snapshot?.deposit_amount ?? 0
  );
  const snapshotFnbPreorder = Number(snapshot?.fnb_total ?? snapshot?.fnb_preorder_fee ?? 0);

  const slotFee = Number(booking.paymentComponents?.find((c: any) => c.type === 'SLOT_FEE')?.amount ?? snapshotSlotFee);
  const rentalFee = Number(booking.paymentComponents?.find((c: any) => c.type === 'RENTAL_FEE')?.amount ?? snapshotRentalFee);
  const discountAmount = Number(booking.discountAmount ?? 0);
  const depositComponent = booking.paymentComponents?.find((c: any) => c.type === 'SECURITY_DEPOSIT');
  const depositAmount = Number(depositComponent?.amount ?? snapshotDeposit);
  const fnbPreorderFee = Number(
    booking.paymentComponents?.find(
      (c: any) =>
        (c.type === 'FB_PREORDER' || c.type === 'FNB_PREORDER') &&
        (c.status === 'HELD' || c.status === 'REFUNDED')
    )?.amount ?? snapshotFnbPreorder
  );

  const totalPrepaid = slotFee + rentalFee + fnbPreorderFee + depositAmount - discountAmount;

  // Session thực tế
  const session = booking.session;
  const isSessionActive = session && ['ACTIVE', 'EXTENDING', 'CHECKED_IN', 'CHECKING_OUT'].includes(session.status);

  // Quyết toán cuối phiên (Counter Bill & Reconciliation)
  const onsiteComponents = booking.paymentComponents?.filter((c: any) =>
    !['SLOT_FEE', 'RENTAL_FEE', 'SECURITY_DEPOSIT'].includes(c.type) &&
    !((c.type === 'FNB_PREORDER' || c.type === 'FB_PREORDER') && (c.status === 'HELD' || c.status === 'REFUNDED'))
  ) || [];

  const damageComponent = onsiteComponents.find((c: any) => c.type === 'DAMAGE_CHARGE');
  const damageCharge = Number(damageComponent?.amount ?? 0);

  const depositConsumedByDamage = Math.min(depositAmount, damageCharge);
  const depositRefundAmount = depositAmount - depositConsumedByDamage;
  const damageExceedingDeposit = Math.max(0, damageCharge - depositAmount);

  const counterComponents = onsiteComponents.filter((c: any) => c.type !== 'DAMAGE_CHARGE');
  const totalCounterServiceBill = counterComponents.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalCounterBill = totalCounterServiceBill + damageExceedingDeposit;

  const isPaid = !booking.paymentComponents?.some((c: any) => c.status === 'PENDING');

  const transactions = booking.paymentTransactions ?? [];
  const gatewayLabel = (gateway: string) =>
    gateway === 'DIRECT' ? 'Tiền mặt' : gateway === 'MOCK' ? 'DEV Mock' : 'VNPay Online';

  const prepaidTx = transactions.find((t: any) => t.type === 'PAYMENT' && t.gateway !== 'DIRECT' && t.status === 'SUCCESS');
  const counterTx = transactions.find((t: any) => t.type === 'PAYMENT' && t.gateway === 'DIRECT' && t.status === 'SUCCESS');
  const additionalVnpayTx = transactions.filter(
    (t: any) => t.type === 'PAYMENT' && t.gateway !== 'DIRECT' && t.status === 'SUCCESS'
  ).length > 1
    ? transactions.filter((t: any) => t.type === 'PAYMENT' && t.gateway !== 'DIRECT' && t.status === 'SUCCESS').at(-1)
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background lights */}
      <View className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none" />
      <View className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-[#6366f1]/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center justify-between border-b border-slate-800/80">
        <Pressable
          className="size-9 rounded-xl bg-slate-900 border border-slate-800 justify-center items-center active:bg-slate-800"
          onPress={() => router.back()}
        >
          <ArrowLeft color="#ffffff" size={18} />
        </Pressable>
        <Text className="text-white text-base" weight="700">Chi tiết đặt sân</Text>
        <View className="size-9" />
      </View>

      <ScrollView contentContainerClassName="px-5 py-5 pb-12" showsVerticalScrollIndicator={false}>
        {/* Mã QR Code Check-in (Ẩn nếu đã checkout hoặc bị hủy) */}
        {booking.status !== 'CANCELLED' && booking.status !== 'NO_SHOW' && (!session || session.status !== 'COMPLETED') && (
          <View className="items-center mb-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-6 shadow-2xl">
            <View className="bg-white p-3 rounded-2xl shadow-lg mb-4">
              {booking.checkInCode ? (
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${booking.checkInCode}` }}
                  className="size-48 rounded-xl"
                />
              ) : (
                <View className="size-48 justify-center items-center bg-slate-100 rounded-xl">
                  <ActivityIndicator color="#ea580c" />
                </View>
              )}
            </View>
            <Text className="text-slate-400 text-xs font-bold tracking-widest uppercase">Mã check-in của bạn</Text>
            <Text className="text-white text-xl font-mono mt-1" weight="700">
              {booking.checkInCode ?? 'CHƯA CÓ MÃ'}
            </Text>
            <Text className="text-slate-400 text-[11px] text-center font-medium mt-2 leading-4">
              Đưa mã QR này cho nhân viên tại quầy để check-in nhận làn đua và nhận xe thuê của bạn.
            </Text>
          </View>
        )}

        {/* Trạng thái / Cảnh báo thanh toán */}
        {booking.status === 'PENDING' && (
          <View className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex-row items-start gap-3 shadow-lg">
            <AlertTriangle color="#f59e0b" size={20} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-amber-500 text-[14px]" weight="700">Đơn đặt sân chưa thanh toán</Text>
              <Text className="text-slate-400 text-xs leading-4 mt-1 font-semibold">
                Lượt đặt của bạn sẽ bị hủy nếu không thanh toán trước thời hạn. Vui lòng hoàn tất thanh toán VNPay ngay.
              </Text>
              <Pressable
                className="mt-3 h-9 flex-row items-center justify-center rounded-xl bg-amber-500 active:bg-amber-600 gap-1.5 shadow-md"
                onPress={handlePayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <CreditCard color="#ffffff" size={14} />
                    <Text className="text-white text-xs font-bold">Thanh toán VNPay</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Timeline đứng tiến trình (Booking Lifecycle) */}
        <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
          <Text className="text-[12px] font-bold text-white uppercase tracking-wider mb-4">
            Tiến trình lượt chơi
          </Text>

          <View className="space-y-4">
            {/* Step 1 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className="size-6 rounded-full bg-emerald-500 border border-emerald-400 justify-center items-center">
                  <CheckCircle2 color="#ffffff" size={13} />
                </View>
                <View className="w-[1.5px] h-8 bg-emerald-500/50 mt-1" />
              </View>
              <View className="flex-grow pt-0.5">
                <Text className="text-white text-sm" weight="600">Khởi tạo & Đặt sân thành công</Text>
                <Text className="text-slate-400 text-xs mt-0.5 font-semibold">Đã tạo đơn đặt lịch chơi lúc {new Date(booking.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {new Date(booking.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</Text>
              </View>
            </View>

            {/* Step 2 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", booking.status !== 'PENDING' ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-800')}>
                  {booking.status !== 'PENDING' ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className="text-slate-400 text-[10px] font-black font-mono">2</Text>
                  )}
                </View>
                <View className={cn("w-[1.5px] h-8 mt-1", booking.status !== 'PENDING' ? 'bg-emerald-500/50' : 'bg-slate-800')} />
              </View>
              <View className="flex-grow pt-0.5">
                <Text className="text-white text-sm" weight="600">Thanh toán hóa đơn</Text>
                <Text className="text-slate-400 text-xs mt-0.5 font-semibold">
                  {booking.status === 'PENDING' ? 'Đang chờ xử lý thanh toán...' : 'Đã thanh toán thành công qua cổng VNPay'}
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", session ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-800')}>
                  {session ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className="text-slate-400 text-[10px] font-black font-mono">3</Text>
                  )}
                </View>
                <View className={cn("w-[1.5px] h-8 mt-1", session ? 'bg-emerald-500/50' : 'bg-slate-800')} />
              </View>
              <View className="flex-grow pt-0.5">
                <Text className="text-white text-sm" weight="600">Bàn giao & Check-in tại sân</Text>
                <Text className="text-slate-400 text-xs mt-0.5 font-semibold">
                  {session?.actualStartAt
                    ? `Nhân viên check-in đã bàn giao xe lúc ${new Date(session.actualStartAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Đưa mã check-in cho nhân viên tại quầy để bàn giao xe và check-in'}
                </Text>
              </View>
            </View>

            {/* Step 4 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", isSessionActive ? 'bg-orange-500 border-orange-400' : session?.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-800')}>
                  {session?.status === 'COMPLETED' ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className={cn("text-[10px] font-black font-mono", isSessionActive ? 'text-white' : 'text-slate-400')}>4</Text>
                  )}
                </View>
              </View>
              <View className="flex-grow pt-0.5">
                <Text className="text-white text-sm" weight="600">Trạng thái chơi & Kết thúc</Text>
                <Text className="text-slate-400 text-xs mt-0.5 font-semibold">
                  {session?.status === 'COMPLETED'
                    ? 'Đã hoàn thành phiên chơi và checkout xe đua.'
                    : isSessionActive
                    ? 'Ca chơi đang hoạt động trên track.'
                    : 'Chưa bắt đầu ca chơi.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Thông tin Chi nhánh */}
        <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
          <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2">
            <MapPin color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
              Chi nhánh & Làn đua
            </Text>
          </View>
          <Text className="text-white text-[15px]" weight="600">{booking.cafe?.name ?? 'RCField Platform Branch'}</Text>
          <Text className="text-slate-400 text-xs leading-4 font-semibold mt-1">{booking.cafe?.address ?? 'Địa chỉ chi nhánh chưa được cấu hình.'}</Text>
        </View>

        {/* Thông tin Lượt đua */}
        <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
          <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2">
            <Calendar color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
              Thông tin chi tiết lịch chạy
            </Text>
          </View>
          <View className="space-y-2.5">
            <View className="flex-row justify-between">
              <Text className="text-slate-400 text-xs font-semibold">Ngày chơi</Text>
              <Text className="text-white text-xs font-bold">{dateLabel}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-400 text-xs font-semibold">Khung giờ</Text>
              <Text className="text-white text-xs font-bold">{timeLabel}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-400 text-xs font-semibold">Chế độ chơi</Text>
              <Text className="text-white text-xs font-bold">
                {booking.playMode === 'RENTAL' ? 'Thuê xe của chi nhánh' : 'Mang xe riêng (BYOC)'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-400 text-xs font-semibold">Số lượng người chơi</Text>
              <Text className="text-white text-xs font-bold">{booking.participants?.length || 1} người</Text>
            </View>
          </View>
        </View>

        {/* Danh sách người tham gia (Companions) */}
        {booking.participants && booking.participants.length > 0 && (
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2">
              <User color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
                Danh sách người chơi
              </Text>
            </View>
            <View className="space-y-3">
              {booking.participants.map((p: any, idx: number) => (
                <View key={p.id || idx} className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="size-7 rounded-full bg-slate-900 border border-slate-800 justify-center items-center">
                      <Text className="text-slate-400 text-[10px] font-bold">{idx + 1}</Text>
                    </View>
                    <View>
                      <Text className="text-white text-xs font-bold">
                        {p.resolvedName ?? p.guestName ?? 'Người chơi phụ'}
                      </Text>
                      <Text className="text-slate-400 text-[10px] font-medium">
                        {p.resolvedPhone ?? p.guestPhone ?? 'Chưa cập nhật SĐT'}
                      </Text>
                    </View>
                  </View>
                  <View className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    <Text className="text-slate-400 text-[9px] font-bold uppercase">
                      {p.userId === booking.customerId ? 'Người đặt' : 'Người đi cùng'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Danh sách xe thuê (Rental Vehicles) */}
        {booking.vehicles && booking.vehicles.length > 0 && (
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2">
              <Car color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
                Danh sách xe thuê
              </Text>
            </View>
            <View className="space-y-3">
              {booking.vehicles.map((v: any, idx: number) => (
                <View key={v.id || idx} className="flex-row items-center gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  {v.coverImageUrl ? (
                    <Image source={{ uri: v.coverImageUrl }} className="size-11 rounded-lg bg-slate-900" />
                  ) : (
                    <View className="size-11 rounded-lg bg-slate-900 border border-slate-800 justify-center items-center">
                      <Car color="#475569" size={18} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-white text-xs font-bold">{v.catalogName ?? 'Xe đua RC'}</Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      <Text className="text-[10px] text-slate-400 font-semibold font-mono">Bảng số: {v.identifier ?? 'N/A'}</Text>
                      <View className="w-[1px] h-2 bg-slate-800" />
                      <Text className="text-[10px] text-slate-400 font-semibold">Màu: {v.color ?? 'N/A'}</Text>
                    </View>
                  </View>
                  <View className={cn("px-2 py-0.5 rounded border", v.tier === 'PREMIUM' ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-slate-900 border-slate-800')}>
                    <Text className={cn("text-[9px] font-bold uppercase", v.tier === 'PREMIUM' ? 'text-yellow-500' : 'text-slate-400')}>
                      {v.tier ?? 'STANDARD'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trình đối chiếu hình ảnh Check-in/Check-out (Handover Photos) */}
        {session && (session.status === 'COMPLETED' || session.status === 'CHECKING_OUT') && (
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2">
              <Camera color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
                Đối chiếu bàn giao xe (Side-by-Side)
              </Text>
            </View>

            <View className="space-y-4">
              <View className="flex-row gap-3">
                {/* Check-in Photo */}
                <View className="flex-1 space-y-1.5">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider text-center">Ảnh bàn giao Check-in</Text>
                  {session.checkInPhotoUrl ? (
                    <Image source={{ uri: session.checkInPhotoUrl }} className="w-full h-24 rounded-xl bg-slate-900 object-cover border border-slate-800" />
                  ) : (
                    <View className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800/80 justify-center items-center">
                      <Camera color="#475569" size={20} />
                      <Text className="text-slate-500 text-[9px] font-bold mt-1">Chưa cập nhật</Text>
                    </View>
                  )}
                </View>

                {/* Check-out Photo */}
                <View className="flex-1 space-y-1.5">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider text-center">Ảnh bàn giao Check-out</Text>
                  {session.checkOutPhotoUrl ? (
                    <Image source={{ uri: session.checkOutPhotoUrl }} className="w-full h-24 rounded-xl bg-slate-900 object-cover border border-slate-800" />
                  ) : (
                    <View className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800/80 justify-center items-center">
                      <Camera color="#475569" size={20} />
                      <Text className="text-slate-500 text-[9px] font-bold mt-1">Chưa cập nhật</Text>
                    </View>
                  )}
                </View>
              </View>
              {session.damageNotes && (
                <View className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5">
                  <Text className="text-red-400 text-[10px] font-bold uppercase tracking-wide">Ghi chú hư hại từ nhân viên:</Text>
                  <Text className="text-slate-300 text-xs font-semibold leading-4 mt-0.5">{session.damageNotes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Section: Thanh toán & Quyết toán (Billing & Settlement) */}
        <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
          <View className="flex-row items-center gap-2 mb-4 border-b border-slate-800/80 pb-2.5">
            <CreditCard color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
              Thanh toán & Quyết toán
            </Text>
          </View>

          {/* Block 1: Trả trước qua cổng VNPAY */}
          <View className="space-y-3">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 color="#10b981" size={15} />
              <Text className="text-[#10b981] text-xs font-bold uppercase tracking-wide">
                {booking.status === 'PENDING'
                  ? 'Sẽ thanh toán qua VNPAY'
                  : prepaidTx
                  ? `Đã trả qua ${gatewayLabel(prepaidTx.gateway)}`
                  : 'Đã trả qua VNPAY'}
              </Text>
            </View>

            <View className="pl-5 space-y-2">
              {slotFee > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs font-semibold">Phí lịch sân</Text>
                  <Text className="text-white text-xs font-bold">{slotFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {rentalFee > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs font-semibold">Phí thuê xe</Text>
                  <Text className="text-white text-xs font-bold">{rentalFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {fnbPreorderFee > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs font-semibold">F&B đặt trước</Text>
                  <Text className="text-white text-xs font-bold">{fnbPreorderFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {depositAmount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs font-semibold">Tiền cọc xe giữ</Text>
                  <Text className="text-white text-xs font-bold">{depositAmount.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {discountAmount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-400 text-xs font-semibold">Mã giảm giá</Text>
                  <Text className="text-emerald-400 text-xs font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              
              {/* Dòng gạch chân mờ và Tổng đã trả */}
              <View className="w-full h-[1px] bg-slate-800/60 my-1" />
              <View className="flex-row justify-between">
                <Text className="text-slate-200 text-xs font-bold">Tổng đã trả</Text>
                <Text className="text-white text-xs font-bold">{totalPrepaid.toLocaleString('vi-VN')}đ</Text>
              </View>
            </View>
          </View>

          {/* Block 2: Quyết toán cuối phiên chơi (Active hoặc Completed) */}
          {(isSessionActive || booking.status === 'COMPLETED') && (depositAmount > 0 || totalCounterBill > 0) && (
            <View className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
              <View className="flex-row items-center gap-2">
                <Clock color="#94a3b8" size={15} />
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">
                  {isSessionActive ? 'Khi kết thúc phiên (ước tính)' : 'Quyết toán tại quầy'}
                </Text>
              </View>

              <View className="pl-5 space-y-2">
                {depositRefundAmount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-400 text-xs font-semibold">Hoàn cọc xe</Text>
                    <Text className="text-emerald-400 text-xs font-bold">+{depositRefundAmount.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
                {depositConsumedByDamage > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-400 text-xs font-semibold">Khấu trừ cọc hư hỏng</Text>
                    <Text className="text-rose-400 text-xs font-bold">-{depositConsumedByDamage.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
                {counterComponents.map((c: any, idx: number) => {
                  let label = c.label || 'Phí phát sinh';
                  if (c.type === 'EXTENSION_FEE') label = 'Phí gia hạn giờ';
                  if (c.type === 'FB_PREORDER' || c.type === 'FNB_PREORDER') label = 'F&B gọi thêm tại quầy';
                  return (
                    <View key={c.id || idx} className="flex-row justify-between">
                      <Text className="text-slate-400 text-xs font-semibold">{label}</Text>
                      <Text className="text-rose-400 text-xs font-bold">+{Number(c.amount).toLocaleString('vi-VN')}đ</Text>
                    </View>
                  );
                })}
                {damageExceedingDeposit > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-400 text-xs font-semibold">Hư hỏng vượt cọc</Text>
                    <Text className="text-rose-400 text-xs font-bold">+{damageExceedingDeposit.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Block 3: Trạng thái quyết toán nợ phát sinh */}
          {totalCounterBill > 0 && (
            <View className="mt-5 pt-4 border-t border-slate-800/80">
              {!isPaid ? (
                <View className="space-y-3">
                  <View className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 flex-row items-center gap-2">
                    <AlertTriangle color="#f59e0b" size={16} />
                    <Text className="text-amber-500 text-xs font-semibold flex-1">
                      Còn <Text className="font-bold text-amber-400">{totalCounterBill.toLocaleString('vi-VN')}đ</Text> phí phát sinh chưa thanh toán.
                    </Text>
                  </View>
                  <Pressable
                    className="h-10 flex-row items-center justify-center rounded-xl bg-orange-500 active:bg-orange-600 gap-1.5 shadow-md"
                    onPress={handlePaymentAdditional}
                    disabled={submittingAdditionalPayment}
                  >
                    {submittingAdditionalPayment ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <CreditCard color="#ffffff" size={14} />
                        <Text className="text-white text-xs font-bold">Thanh toán VNPay phí phát sinh</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 flex-row items-center justify-center gap-2">
                  <CheckCircle2 color="#10b981" size={16} />
                  <Text className="text-emerald-400 text-xs font-bold">
                    Đã thanh toán đầy đủ
                    {(counterTx || additionalVnpayTx) && (
                      <Text className="font-semibold text-[11px] text-[#10b981]">
                        {` · ${gatewayLabel((counterTx ?? additionalVnpayTx)!.gateway)}`}
                      </Text>
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Nút hủy đặt lịch */}
        {(booking.status === 'CONFIRMED' || booking.status === 'PENDING') && (
          <Pressable
            className="w-full h-11 flex-row items-center justify-center rounded-xl border border-red-900/20 bg-red-950/15 active:bg-red-950/30 gap-2 shadow-sm"
            onPress={() => setCancelModalVisible(true)}
          >
            <RotateCcw color="#ef4444" size={16} />
            <Text className="text-red-400 text-xs font-bold">Hủy đặt lịch chơi</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Modal Hủy Đặt Lịch */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cancelModalVisible}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#0f172a] rounded-t-3xl border-t border-slate-800 p-6 space-y-4">
            <View className="flex-row justify-between items-center border-b border-slate-800 pb-3">
              <Text className="text-white text-base" weight="700">Xác nhận hủy đặt lịch</Text>
              <Pressable onPress={() => setCancelModalVisible(false)}>
                <Text className="text-slate-400 text-xs font-bold">Đóng</Text>
              </Pressable>
            </View>

            {refundEstimation && (
              <View className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 space-y-2">
                <Text className="text-amber-500 text-xs font-bold uppercase tracking-wider">
                  ⚠️ Chính sách hoàn phí chi tiết:
                </Text>
                <Text className="text-slate-300 text-xs leading-4 font-semibold">
                  • {refundEstimation.policyText}{'\n'}
                  • Phí thuê xe & dịch vụ F&B: Hoàn 100%
                </Text>
                <View className="w-full h-[1px] bg-slate-800/80 my-1" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-400 text-xs font-bold">Tổng tiền hoàn dự kiến:</Text>
                  <Text className="text-emerald-400 text-sm font-black">
                    {refundEstimation.totalRefund.toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              </View>
            )}

            <View className="space-y-1.5">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nhập lý do hủy đặt lịch</Text>
              <TextInput
                className="w-full min-h-[70px] rounded-xl border border-slate-800 bg-slate-950 p-3 text-white text-xs font-medium leading-4"
                multiline={true}
                placeholder="Nhập lý do hủy lịch chơi của bạn..."
                placeholderTextColor="#475569"
                value={cancelReason}
                onChangeText={setCancelReason}
              />
            </View>

            <Pressable
              className="h-11 flex-row items-center justify-center rounded-xl bg-red-600 active:bg-red-700 gap-2 mt-2 shadow-md"
              onPress={handleCancelBooking}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <RotateCcw color="#ffffff" size={15} />
                  <Text className="text-white text-xs font-bold">Xác nhận hủy đơn</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
