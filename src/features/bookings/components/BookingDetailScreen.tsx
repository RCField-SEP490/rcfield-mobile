import { useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Camera,
  User,
  CreditCard,
  Star,
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
  KeyboardAvoidingView,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { bookingWizardApi } from '@/features/bookings/api/booking-wizard.api';
import { getDisplayBookingStatus, isCheckInWindowExpired } from '@/features/bookings/lib/check-in-window';
import { wsClient } from '@/shared/lib/websocket';
import { Text } from '@/shared/ui/Text';
import { cn } from '@/shared/lib/utils';
import { getVnpayReturnUrl } from '@/shared/lib/vnpay-return-url';
import { openVnpayPaymentSession } from '@/shared/lib/vnpay-browser';
import { ImageZoomModal } from '@/shared/ui/ImageZoomModal';

interface BookingDetailScreenProps {
  bookingId: string;
}

const INSPECTION_PHOTO_LABELS: Record<string, string> = {
  FRONT: 'Phía trước',
  BACK: 'Phía sau',
  LEFT: 'Bên trái',
  RIGHT: 'Bên phải',
  TOP: 'Từ trên',
  BOTTOM: 'Phía dưới',
  DETAIL: 'Cận cảnh',
};

export const PART_TYPE_NAMES: Record<string, string> = {
  TIRE_WHEEL: 'Bánh xe / Lốp',
  WHEEL_TIRE: 'Bánh xe / Lốp',
  MOTOR: 'Động cơ (Motor)',
  BATTERY: 'Pin / Ắc quy',
  SERVO: 'Bộ bẻ lái (Servo)',
  ESC: 'Bộ điều tốc (ESC)',
  CHASSIS: 'Khung gầm (Chassis)',
  BODY_SHELL: 'Vỏ xe (Body Shell)',
  SUSPENSION: 'Phuộc / Giảm xóc',
  TRANSMISSION: 'Hộp số / Truyền động',
  REMOTE_CONTROL: 'Tay điều khiển (Remote)',
  OTHER: 'Hạng mục khác',
};

export function getPartTypeName(partType?: string, customPartName?: string | null): string {
  if (customPartName && customPartName.trim()) return customPartName;
  if (!partType) return 'Hạng mục hư hỏng';
  return PART_TYPE_NAMES[partType.toUpperCase()] || partType;
}

function getInspectionPhotoLabel(angle?: string, index = 0) {
  return INSPECTION_PHOTO_LABELS[angle || ''] || `Ảnh ${index + 1}`;
}

export function BookingDetailScreen({ bookingId }: BookingDetailScreenProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingAdditionalPayment, setSubmittingAdditionalPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // States cho Hủy Đặt Lịch
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const checkInPhotos = useMemo(() => {
    if (!sessionDetail?.inspections) return [];
    const insp = sessionDetail.inspections.find((i: any) => i.type === 'CHECK_IN');
    return insp?.photos || [];
  }, [sessionDetail]);

  const checkOutPhotos = useMemo(() => {
    if (!sessionDetail?.inspections) return [];
    const insp = sessionDetail.inspections.find((i: any) => i.type === 'CHECK_OUT');
    return insp?.photos || [];
  }, [sessionDetail]);

  const renderPhotoGrid = (photos: any[], label: string) => {
    const isByoc = booking?.playMode === 'BYOC';

    return (
      <View className="flex-1 space-y-2">
        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider text-center mb-1">
          {label}
        </Text>
        {photos.length > 0 ? (
          isByoc ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Phóng to ${label}`}
              onPress={() => setPreviewPhoto({ url: photos[0].url, title: `${label} · ${getInspectionPhotoLabel(photos[0].angle)}` })}
              className="w-full aspect-square rounded-lg bg-slate-900 border border-slate-800 overflow-hidden relative"
            >
              <Image
                source={{ uri: photos[0].url }}
                className="w-full h-full object-cover"
              />
              <View className="absolute bottom-1 left-1 bg-black/70 px-1 py-0.5 rounded">
                <Text className="text-[7.5px] text-slate-300 uppercase font-black tracking-wide">
                  {getInspectionPhotoLabel(photos[0].angle)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View className="flex-row flex-wrap gap-1.5 justify-start">
              {photos.map((p: any, idx: number) => (
                <Pressable
                  key={idx}
                  accessibilityRole="button"
                  accessibilityLabel={`Phóng to ${label} ${idx + 1}`}
                  onPress={() => setPreviewPhoto({ url: p.url, title: `${label} · ${getInspectionPhotoLabel(p.angle, idx)}` })}
                  className="w-[48%] aspect-square rounded-lg bg-slate-900 border border-slate-800 overflow-hidden relative"
                >
                  <Image
                    source={{ uri: p.url }}
                    className="w-full h-full object-cover"
                  />
                  <View className="absolute bottom-1 left-1 bg-black/70 px-1 py-0.5 rounded">
                    <Text className="text-[7.5px] text-slate-300 uppercase font-black tracking-wide">
                      {getInspectionPhotoLabel(p.angle, idx)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <View className="w-full aspect-square rounded-xl bg-slate-950 border border-slate-850 justify-center items-center gap-1.5 p-4">
            <Camera color="#475569" size={24} />
            <Text className="text-slate-500 text-[9px] font-bold">Chưa cập nhật ảnh</Text>
          </View>
        )}
      </View>
    );
  };

  const loadBookingDetail = useCallback(async () => {
    try {
      const data = await bookingWizardApi.getBooking(bookingId);
      setBooking(data);
      if (data?.session?.id) {
        try {
          const sessData = await bookingWizardApi.getSessionDetail(data.session.id);
          setSessionDetail(sessData);
        } catch (sessErr) {
          console.error('[BookingDetailScreen] Failed to load session detail:', sessErr);
        }
      } else {
        setSessionDetail(null);
      }
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

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event, data) => {
      if (
        [
          'SESSION_CHECKIN_INSPECTION',
          'SESSION_CHECKOUT_INSPECTION',
          'CUSTOMER_CHECKIN_CONFIRMED',
          'CUSTOMER_CHECKOUT_CONFIRMED',
          'CUSTOMER_PAYMENT_CONFIRMED',
          'SESSION_EXTENSION_PROPOSED',
          'SESSION_FNB_ORDER_ADDED',
          'BOOKING_REVIEW_REQUEST',
        ].includes(event)
      ) {
        console.log(`[BookingDetailScreen] WebSocket event '${event}' received, reloading...`);
        loadBookingDetail();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadBookingDetail]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[BookingDetailScreen] App status is active, reloading booking detail...');
        loadBookingDetail();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
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
      const returnUrl = getVnpayReturnUrl();
      const res = await bookingWizardApi.createCheckout(bookingId, returnUrl);

      if (res.payment_url) {
        await openVnpayPaymentSession(res.payment_url);
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
      const returnUrl = getVnpayReturnUrl();
      const res = await bookingWizardApi.createCheckoutAdditionalPayment(bookingId, returnUrl);

      if (res.payment_url) {
        await openVnpayPaymentSession(res.payment_url);
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

    const slotFee = Number(booking.payment_components?.find((c: any) => c.type === 'SLOT_FEE')?.amount || 0);
    const rentalFee = Number(booking.payment_components?.find((c: any) => c.type === 'RENTAL_FEE')?.amount || 0);
    const deposit = Number(booking.payment_components?.find((c: any) => c.type === 'SECURITY_DEPOSIT')?.amount || 0);
    const fnb = Number(booking.payment_components?.find((c: any) => c.type === 'FNB_PREORDER')?.amount || 0);

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

  const damageLineItems = useMemo(() => {
    if (booking?.damage_breakdown?.lineItems?.length) {
      return booking.damage_breakdown.lineItems;
    }
    if (sessionDetail?.damageClaim?.damageLineItems?.length) {
      return sessionDetail.damageClaim.damageLineItems;
    }
    const checkoutInsp = sessionDetail?.inspections?.find(
      (i: any) => i.type === 'CHECK_OUT' && i.damageLineItems?.length
    );
    if (checkoutInsp?.damageLineItems?.length) {
      return checkoutInsp.damageLineItems;
    }
    return [];
  }, [booking, sessionDetail]);

  if (loading) {
    return (
      <SafeAreaView className="flex-grow flex-1 bg-[#f8fafc] dark:bg-[#0b0f19] justify-center items-center">
        <ActivityIndicator color="#ea580c" size="large" />
        <Text className="mt-3 text-slate-500 dark:text-slate-400 text-xs font-semibold">Đang tải chi tiết đặt sân...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-grow flex-1 bg-[#f8fafc] dark:bg-[#0b0f19] px-5 justify-center items-center">
        <AlertCircle color="#ef4444" size={48} />
        <Text className="text-slate-900 dark:text-white text-lg font-bold mt-4">Không tìm thấy đơn đặt sân</Text>
        <Pressable
          className="mt-6 px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:bg-slate-200 dark:active:bg-slate-700"
          onPress={() => router.back()}
        >
          <Text className="text-slate-900 dark:text-white text-xs font-bold">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const slotStart = new Date(booking.slotStart);
  const slotEnd = new Date(booking.slotEnd);
  const dateLabel = slotStart.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeLabel = `${slotStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

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

  const slotFee = Number(booking.payment_components?.find((c: any) => c.type === 'SLOT_FEE')?.amount ?? snapshotSlotFee);
  const rentalFee = Number(booking.payment_components?.find((c: any) => c.type === 'RENTAL_FEE')?.amount ?? snapshotRentalFee);
  const discountAmount = Number(booking.discountAmount ?? 0);
  const depositComponent = booking.payment_components?.find((c: any) => c.type === 'SECURITY_DEPOSIT');
  const depositAmount = Number(depositComponent?.amount ?? snapshotDeposit);
  const fnbPreorderFee = Number(
    booking.payment_components?.find(
      (c: any) =>
        (c.type === 'FB_PREORDER' || c.type === 'FNB_PREORDER') &&
        (c.status === 'HELD' || c.status === 'REFUNDED')
    )?.amount ?? snapshotFnbPreorder
  );

  const totalPrepaid = slotFee + rentalFee + fnbPreorderFee + depositAmount - discountAmount;

  // Session thực tế
  const session = booking.session;
  const checkInExpired = isCheckInWindowExpired(booking.status, booking.slotStart, session);
  const displayBookingStatus = getDisplayBookingStatus(booking.status, booking.slotStart, session);
  const isSessionActive =
    !checkInExpired && session && ['ACTIVE', 'EXTENDING', 'CHECKED_IN', 'CHECKING_OUT'].includes(session.status);
  const pendingInspection = sessionDetail?.inspections?.find(
    (inspection: any) => inspection.customerConfirmed !== true && inspection.type === 'CHECK_OUT'
  );
  const pendingExtension =
    sessionDetail?.extensionProposal?.status === 'PENDING' ? sessionDetail.extensionProposal : null;

  const handleOpenInspectionReview = () => {
    if (!session?.id || !pendingInspection?.inspectionId) return;
    router.push({
      pathname: '/customer/inspections/[sessionId]',
      params: {
        sessionId: session.id,
        inspectionId: pendingInspection.inspectionId,
      },
    } as any);
  };

  const handleOpenExtensionResponse = () => {
    if (!session?.id || !pendingExtension) return;
    router.push({
      pathname: '/customer/extension/[sessionId]',
      params: { sessionId: session.id },
    } as any);
  };

  const handleOpenReview = () => {
    router.push({
      pathname: '/customer/review/[bookingId]',
      params: { bookingId },
    } as any);
  };

  // Quyết toán cuối phiên (Counter Bill & Reconciliation)
  const onsiteComponents = booking.payment_components?.filter((c: any) =>
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

  const isPaid = !booking.payment_components?.some((c: any) => c.status === 'PENDING');

  const transactions = booking.payment_transactions ?? [];
  const gatewayLabel = (gateway: string) =>
    gateway === 'DIRECT' ? 'Tiền mặt' : gateway === 'MOCK' ? 'DEV Mock' : 'VNPay Online';

  const prepaidTx = transactions.find((t: any) => t.type === 'PAYMENT' && t.gateway !== 'DIRECT' && t.status === 'SUCCESS');
  const counterTx = transactions.find((t: any) => t.type === 'PAYMENT' && t.gateway === 'DIRECT' && t.status === 'SUCCESS');
  const successfulVnpayTxs = transactions.filter(
    (t: any) => t.type === 'PAYMENT' && t.gateway !== 'DIRECT' && t.status === 'SUCCESS'
  );
  const additionalVnpayTx = successfulVnpayTxs.length > 1 ? successfulVnpayTxs[successfulVnpayTxs.length - 1] : undefined;

  return (
    <SafeAreaView className="flex-grow flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background lights */}
      <View className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none opacity-30 dark:opacity-100" />
      <View className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-[#6366f1]/5 blur-3xl pointer-events-none opacity-30 dark:opacity-100" />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0b0f19]">
        <Pressable
          className="size-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 justify-center items-center active:bg-slate-100 dark:active:bg-slate-800"
          onPress={() => router.back()}
        >
          <ArrowLeft color={colorScheme === 'dark' ? '#ffffff' : '#475569'} size={18} />
        </Pressable>
        <Text className="text-slate-900 dark:text-white text-base" weight="700">Chi tiết đặt sân</Text>
        <View className="size-9" />
      </View>

      <ScrollView contentContainerClassName="px-5 py-5 pb-12" showsVerticalScrollIndicator={false}>

        {/* Mã QR Code Check-in — dùng endpoint BE /bookings/:id/qr (Ẩn nếu đã checkout hoặc bị hủy) */}
        {displayBookingStatus !== 'CANCELLED' && displayBookingStatus !== 'NO_SHOW' && (!session || session.status !== 'COMPLETED') && (
          <View className="items-center mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-6 shadow-xl">
            <View className="bg-white p-3 rounded-2xl shadow-lg mb-4">
              <Image
                source={{
                  uri: `${process.env.EXPO_PUBLIC_API_URL}/bookings/${bookingId}/qr`,
                  headers: { 'Cache-Control': 'no-cache' },
                }}
                className="size-48 rounded-xl"
                onError={() => console.warn('[BookingQR] QR image load failed for', bookingId)}
              />
            </View>
            <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Mã check-in của bạn</Text>
            <Text className="text-slate-900 dark:text-white text-xl font-mono mt-1" weight="700">
              {bookingId.slice(0, 8).toUpperCase()}
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-[11px] text-center font-medium mt-2 leading-4">
              Đưa mã QR này cho nhân viên tại quầy để check-in nhận làn đua và nhận xe thuê của bạn.
            </Text>
          </View>
        )}

        {checkInExpired ? (
          <View className="mb-6 flex-row items-start gap-3 rounded-2xl border border-slate-500/20 bg-slate-500/10 p-4">
            <AlertCircle color="#94a3b8" size={20} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-[14px] text-slate-700 dark:text-slate-200" weight="700">Đơn đã quá giờ check-in</Text>
              <Text className="mt-1 text-[12px] leading-4 text-slate-500">
                Bạn đã quá thời hạn check-in 30 phút. Đơn được xem là không đến và không thể mở phiên chơi.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Trạng thái / Cảnh báo thanh toán */}
        {booking.status === 'PENDING' && (
          <View className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex-row items-start gap-3 shadow-lg">
            <AlertTriangle color="#f59e0b" size={20} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-amber-500 text-[14px]" weight="700">Đơn đặt sân chưa thanh toán</Text>
              <Text className="text-slate-500 dark:text-slate-400 text-xs leading-4 mt-1 font-semibold">
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

        {pendingInspection ? (
          <View className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 shadow-lg">
            <View className="flex-row items-start gap-3">
              <AlertTriangle color="#f97316" size={20} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-orange-400 text-[14px]" weight="700">
                  Cần xác nhận biên bản trả xe
                </Text>
                <Text className="mt-1 text-xs leading-4 text-slate-700 dark:text-slate-300 font-semibold">
                  Nhân viên đã gửi biên bản checkout. Bạn cần xem và đồng ý để phiên chơi hoàn tất.
                </Text>
              </View>
            </View>
            <Pressable
              className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-[#ea580c] active:bg-[#f97316] gap-1.5 shadow-md"
              onPress={handleOpenInspectionReview}
            >
              <CheckCircle2 color="#ffffff" size={15} />
              <Text className="text-white text-xs font-bold">
                Xem và xác nhận biên bản
              </Text>
            </Pressable>
          </View>
        ) : null}

        {pendingExtension ? (
          <View className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-lg">
            <View className="flex-row items-start gap-3">
              <Clock color="#34d399" size={20} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-emerald-300 text-[14px]" weight="700">
                  Nhân viên đề xuất gia hạn +{pendingExtension.extraMinutes} phút
                </Text>
                <Text className="mt-1 text-xs leading-4 text-slate-700 dark:text-slate-300 font-semibold">
                  Phí phát sinh {Number(pendingExtension.additionalFee || 0).toLocaleString('vi-VN')}đ. Bạn cần phản hồi để staff cập nhật giờ chơi.
                </Text>
              </View>
            </View>
            <Pressable
              className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-emerald-600 active:bg-emerald-500 gap-1.5 shadow-md"
              onPress={handleOpenExtensionResponse}
            >
              <CheckCircle2 color="#ffffff" size={15} />
              <Text className="text-white text-xs font-bold">
                Xem yêu cầu gia hạn
              </Text>
            </Pressable>
          </View>
        ) : null}

        {(booking.status === 'COMPLETED' || session?.status === 'COMPLETED') ? (
          <View className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-lg">
            <View className="flex-row items-start gap-3">
              <Star color="#f59e0b" size={20} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-amber-300 text-[14px]" weight="700">
                  Đánh giá trải nghiệm sau phiên
                </Text>
                <Text className="mt-1 text-xs leading-4 text-slate-700 dark:text-slate-300 font-semibold">
                  Gửi đánh giá về sân, xe và nhân viên sau khi checkout hoàn tất.
                </Text>
              </View>
            </View>
            <Pressable
              className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-amber-500 active:bg-amber-400 gap-1.5 shadow-md"
              onPress={handleOpenReview}
            >
              <Star color="#ffffff" fill="#ffffff" size={15} />
              <Text className="text-white text-xs font-bold">
                Đánh giá ngay
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Timeline đứng tiến trình (Booking Lifecycle) */}
        <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
          <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
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
              <View className="flex-1 pt-0.5">
                <Text className="text-slate-900 dark:text-white text-sm" weight="600">Khởi tạo & Đặt sân thành công</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-semibold">Đã tạo đơn đặt lịch chơi lúc {new Date(booking.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {new Date(booking.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</Text>
              </View>
            </View>

            {/* Step 2 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", booking.status !== 'PENDING' ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800')}>
                  {booking.status !== 'PENDING' ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-black font-mono">2</Text>
                  )}
                </View>
                <View className={cn("w-[1.5px] h-8 mt-1", booking.status !== 'PENDING' ? 'bg-emerald-500/50' : 'bg-slate-200 dark:bg-slate-800')} />
              </View>
              <View className="flex-1 pt-0.5">
                <Text className="text-slate-900 dark:text-white text-sm" weight="600">Thanh toán hóa đơn</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-semibold">
                  {booking.status === 'PENDING' ? 'Đang chờ xử lý thanh toán...' : 'Đã thanh toán thành công qua cổng VNPay'}
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", session ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800')}>
                  {session ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-black font-mono">3</Text>
                  )}
                </View>
                <View className={cn("w-[1.5px] h-8 mt-1", session ? 'bg-emerald-500/50' : 'bg-slate-200 dark:bg-slate-800')} />
              </View>
              <View className="flex-1 pt-0.5">
                <Text className="text-slate-900 dark:text-white text-sm" weight="600">Bàn giao & Check-in tại sân</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-semibold">
                  {session?.actualStartAt
                    ? `Nhân viên check-in đã bàn giao xe lúc ${new Date(session.actualStartAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Đưa mã check-in cho nhân viên tại quầy\nđể bàn giao xe và check-in'}
                </Text>
              </View>
            </View>

            {/* Step 4 */}
            <View className="flex-row gap-3">
              <View className="items-center">
                <View className={cn("size-6 rounded-full justify-center items-center border", isSessionActive ? 'bg-orange-500 border-orange-400' : session?.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800')}>
                  {session?.status === 'COMPLETED' ? (
                    <CheckCircle2 color="#ffffff" size={13} />
                  ) : (
                    <Text className={cn("text-[10px] font-black font-mono", isSessionActive ? 'text-white' : 'text-slate-500 dark:text-slate-400')}>4</Text>
                  )}
                </View>
              </View>
              <View className="flex-1 pt-0.5">
                <Text className="text-slate-900 dark:text-white text-sm" weight="600">Trạng thái chơi & Kết thúc</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-semibold">
                  {checkInExpired
                    ? 'Đã quá thời hạn check-in, phiên không được mở.'
                    : session?.status === 'COMPLETED'
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
        <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
          <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
            <MapPin color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Chi nhánh & Làn đua
            </Text>
          </View>
          <Text className="text-slate-900 dark:text-white text-[15px]" weight="600">{booking.cafe?.name ?? 'RCField Branch'}</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-xs leading-4 font-semibold mt-1">{booking.cafe?.address ?? 'Địa chỉ chi nhánh chưa được cấu hình.'}</Text>
        </View>

        {/* Thông tin Lượt đua */}
        <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
          <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
            <Calendar color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Thông tin chi tiết lịch chạy
            </Text>
          </View>
          <View className="space-y-2.5">
            <View className="flex-row justify-between">
              <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Ngày chơi</Text>
              <Text className="text-slate-900 dark:text-white text-xs font-bold">{dateLabel}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Khung giờ</Text>
              <Text className="text-slate-900 dark:text-white text-xs font-bold">{timeLabel}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Chế độ chơi</Text>
              <Text className="text-slate-900 dark:text-white text-xs font-bold">
                {booking.playMode === 'RENTAL' ? 'Thuê xe của chi nhánh' : 'Mang xe riêng (BYOC)'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Số lượng người chơi</Text>
              <Text className="text-slate-900 dark:text-white text-xs font-bold">{booking.participants?.length || 1} người</Text>
            </View>
          </View>
        </View>

        {/* Danh sách người tham gia (Companions) */}
        {booking.participants && booking.participants.length > 0 && (
          <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <User color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Danh sách người chơi
              </Text>
            </View>
            <View className="space-y-3">
              {booking.participants.map((p: any, idx: number) => (
                <View key={p.id || idx} className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="size-7 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 justify-center items-center">
                      <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-bold">{idx + 1}</Text>
                    </View>
                    <View>
                      <Text className="text-slate-900 dark:text-white text-xs font-bold">
                        {p.resolvedName ?? p.guestName ?? 'Người chơi phụ'}
                      </Text>
                      <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                        {p.resolvedPhone ?? p.guestPhone ?? 'Chưa cập nhật SĐT'}
                      </Text>
                    </View>
                  </View>
                  <View className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase">
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
          <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <Car color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Danh sách xe thuê
              </Text>
            </View>
            <View className="space-y-3">
              {booking.vehicles.map((v: any, idx: number) => (
                <View key={v.id || idx} className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-900">
                  {v.coverImageUrl ? (
                    <Image source={{ uri: v.coverImageUrl }} className="size-11 rounded-lg bg-slate-100 dark:bg-slate-900" />
                  ) : (
                    <View className="size-11 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 justify-center items-center">
                      <Car color="#475569" size={18} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-slate-900 dark:text-white text-xs font-bold">{v.catalogName ?? 'Xe đua RC'}</Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      <Text className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold font-mono">Bảng số: {v.identifier ?? 'N/A'}</Text>
                      <View className="w-[1px] h-2 bg-slate-200 dark:bg-slate-800" />
                      <Text className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold">Màu: {v.color ?? 'N/A'}</Text>
                    </View>
                  </View>
                  <View className={cn("px-2 py-0.5 rounded border", v.tier === 'PREMIUM' ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800')}>
                    <Text className={cn("text-[9px] font-bold uppercase", v.tier === 'PREMIUM' ? 'text-yellow-500' : 'text-slate-500 dark:text-slate-400')}>
                      {v.tier ?? 'STANDARD'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trình đối chiếu hình ảnh Check-in/Check-out (Handover Photos) */}
        {session && (session.status === 'ACTIVE' || session.status === 'COMPLETED' || session.status === 'CHECKING_OUT') && (
          <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
            <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <Camera color="#f97316" size={16} />
              <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Đối chiếu bàn giao xe (Side-by-Side)
              </Text>
            </View>

            <View className="space-y-4">
              <View className="flex-row gap-4">
                {/* Check-in Photos Grid */}
                {renderPhotoGrid(checkInPhotos, 'Ảnh bàn giao Check-in')}

                {/* Check-out Photos Grid */}
                {renderPhotoGrid(checkOutPhotos, 'Ảnh bàn giao Check-out')}
              </View>
              {sessionDetail?.damageNotes && (
                <View className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5">
                  <Text className="text-red-400 text-[10px] font-bold uppercase tracking-wide">Ghi chú hư hại từ nhân viên:</Text>
                  <Text className="text-slate-700 dark:text-slate-300 text-xs font-semibold leading-4 mt-0.5">{sessionDetail.damageNotes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Section: Thanh toán & Quyết toán (Billing & Settlement) */}
        <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-5 shadow-xl mb-6">
          <View className="flex-row items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
            <CreditCard color="#f97316" size={16} />
            <Text className="text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
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
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Phí lịch sân</Text>
                  <Text className="text-slate-900 dark:text-white text-xs font-bold">{slotFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {rentalFee > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Phí thuê xe</Text>
                  <Text className="text-slate-900 dark:text-white text-xs font-bold">{rentalFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {fnbPreorderFee > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">F&B đặt trước</Text>
                  <Text className="text-slate-900 dark:text-white text-xs font-bold">{fnbPreorderFee.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {depositAmount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Tiền cọc xe giữ</Text>
                  <Text className="text-slate-900 dark:text-white text-xs font-bold">{depositAmount.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}
              {discountAmount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Mã giảm giá</Text>
                  <Text className="text-emerald-500 text-xs font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</Text>
                </View>
              )}

              {/* Dòng gạch chân mờ và Tổng đã trả */}
              <View className="w-full h-[1px] bg-slate-200 dark:bg-slate-800/60 my-1" />
              <View className="flex-row justify-between">
                <Text className="text-slate-700 dark:text-slate-200 text-xs font-bold">Tổng đã trả</Text>
                <Text className="text-slate-900 dark:text-white text-xs font-bold">{totalPrepaid.toLocaleString('vi-VN')}đ</Text>
              </View>
            </View>
          </View>

          {/* Block 2: Quyết toán cuối phiên chơi (Active, Awaiting payment hoặc Completed) */}
          {(isSessionActive || booking.status === 'COMPLETED' || booking.status === 'AWAITING_PAYMENT') && (depositAmount > 0 || totalCounterBill > 0 || damageCharge > 0) && (
            <View className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
              <View className="flex-row items-center gap-2">
                <Clock color="#94a3b8" size={15} />
                <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
                  {isSessionActive ? 'Khi kết thúc phiên (ước tính)' : 'Quyết toán tại quầy'}
                </Text>
              </View>

              <View className="pl-5 space-y-2">
                {depositRefundAmount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Hoàn cọc xe</Text>
                    <Text className="text-emerald-400 text-xs font-bold">+{depositRefundAmount.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
                {depositConsumedByDamage > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Khấu trừ cọc hư hỏng</Text>
                    <Text className="text-rose-400 text-xs font-bold">-{depositConsumedByDamage.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
                {counterComponents.map((c: any, idx: number) => {
                  let label = c.label || 'Phí phát sinh';
                  if (c.type === 'EXTENSION_FEE') {
                    const extraMins = c.extraMinutes || sessionDetail?.extensionProposal?.extraMinutes || c.durationMinutes || sessionDetail?.extensionProposal?.extra_minutes;
                    label = extraMins ? `Phí gia hạn giờ (+${extraMins} phút)` : 'Phí gia hạn giờ';
                  }
                  if (c.type === 'FB_PREORDER' || c.type === 'FNB_PREORDER') label = 'F&B gọi thêm tại quầy';
                  return (
                    <View key={c.id || idx} className="flex-row justify-between">
                      <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{label}</Text>
                      <Text className="text-rose-400 text-xs font-bold">+{Number(c.amount).toLocaleString('vi-VN')}đ</Text>
                    </View>
                  );
                })}
                {damageExceedingDeposit > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Hư hỏng vượt cọc</Text>
                    <Text className="text-rose-400 text-xs font-bold">+{damageExceedingDeposit.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
              </View>

              {/* Thẻ Chi Tiết Đền Bù Hư Hỏng Xe (Giống Hình 1 trên Web) */}
              {damageCharge > 0 && (
                <View className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                      Phí đền bù hư hỏng xe
                    </Text>
                    <Text className="text-rose-600 dark:text-rose-400 text-xs font-bold">
                      +{damageCharge.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                  {damageLineItems.length > 0 ? (
                    <View className="space-y-2 pt-1">
                      {damageLineItems.map((item: any, idx: number) => {
                        const name = getPartTypeName(item.partType, item.customPartName);
                        const partsPrice = Number(item.partsPrice || 0);
                        const laborPrice = Number(item.laborPrice || 0);
                        const lineTotal = Number(item.subtotal ?? item.lineTotal ?? (partsPrice + laborPrice));
                        return (
                          <View key={item.id || idx} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                            <View className="flex-row justify-between items-center">
                              <Text className="text-rose-900 dark:text-rose-200 text-xs font-bold flex-1 pr-2">
                                {name}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-3 mt-1">
                              {partsPrice > 0 && (
                                <Text className="text-rose-600/80 dark:text-rose-300/70 text-[10.5px] font-semibold">
                                  Linh kiện: {partsPrice.toLocaleString('vi-VN')}đ
                                </Text>
                              )}
                              {laborPrice > 0 && (
                                <Text className="text-rose-600/80 dark:text-rose-300/70 text-[10.5px] font-semibold">
                                  Công: {laborPrice.toLocaleString('vi-VN')}đ
                                </Text>
                              )}
                              {partsPrice === 0 && laborPrice === 0 && lineTotal > 0 && (
                                <Text className="text-rose-600/80 dark:text-rose-300/70 text-[10.5px] font-semibold">
                                  Chi phí: {lineTotal.toLocaleString('vi-VN')}đ
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="text-rose-600/80 dark:text-rose-300/70 text-[11px] font-medium pt-1">
                      Ghi nhận hư hại từ nhân viên trực ca
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Block 3: Trạng thái quyết toán nợ phát sinh */}
          {totalCounterBill > 0 && (
            <View className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80">
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
        {(displayBookingStatus === 'CONFIRMED' || displayBookingStatus === 'PENDING') && (
          <Pressable
            className="w-full h-11 flex-row items-center justify-center rounded-xl border border-red-200 dark:border-red-900/20 bg-red-50 dark:bg-red-950/15 active:bg-red-100 dark:active:bg-red-950/30 gap-2 shadow-sm"
            onPress={() => setCancelModalVisible(true)}
          >
            <RotateCcw color="#ef4444" size={16} />
            <Text className="text-red-500 dark:text-red-400 text-xs font-bold">Hủy đặt lịch chơi</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={cancelModalVisible}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View className="bg-white dark:bg-[#0f172a] rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-6 pb-10 space-y-4">
              <View className="flex-row justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                <Text className="text-slate-900 dark:text-white text-base" weight="700">Xác nhận hủy đặt lịch</Text>
                <Pressable onPress={() => setCancelModalVisible(false)}>
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold">Đóng</Text>
                </Pressable>
              </View>

              {refundEstimation && (
                <View className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 space-y-2 mt-6">
                  <Text className="text-amber-500 text-xs font-bold uppercase tracking-wider">
                    ⚠️ Chính sách hoàn phí chi tiết:
                  </Text>
                  <Text className="text-slate-700 dark:text-slate-300 text-xs leading-4 font-semibold">
                    • {refundEstimation.policyText}{'\n'}
                    • Phí thuê xe & dịch vụ F&B: Hoàn 100%
                  </Text>
                  <View className="w-full h-[1px] bg-slate-200 dark:bg-slate-800/80 my-1" />
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold">Tổng tiền hoàn dự kiến:</Text>
                    <Text className="text-emerald-400 text-sm font-black">
                      {refundEstimation.totalRefund.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                </View>
              )}

              <View className="space-y-1.5 mt-4">
                <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Nhập lý do hủy đặt lịch</Text>
                <TextInput
                  className="w-full min-h-[70px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white text-xs font-medium leading-4 mt-3"
                  multiline={true}
                  placeholder="Nhập lý do hủy lịch chơi của bạn..."
                  placeholderTextColor="#94a3b8"
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
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <ImageZoomModal
        visible={!!previewPhoto}
        imageUrl={previewPhoto?.url}
        title={previewPhoto?.title}
        onClose={() => setPreviewPhoto(null)}
      />
    </SafeAreaView>
  );
}
