import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { staffApi, type StaffInspectionType, type StaffSessionDetail } from '@/features/staff/api/staff.api';
import { getStatusLabel } from '@/features/bookings/lib/status-label';
import { StaffSessionTools } from '@/features/staff/components/StaffSessionTools';
import {
  getSessionOperationalTiming,
  type SessionOperationalTiming,
} from '@/features/staff/lib/session-operational-timing';
import { wsClient } from '@/shared/lib/websocket';
import { ImageZoomModal } from '@/shared/ui/ImageZoomModal';
import { Text } from '@/shared/ui/Text';

function formatDateTime(iso?: string) {
  if (!iso) return '--';
  const date = new Date(iso);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function shortId(value?: string) {
  if (!value) return '--';
  return value.slice(0, 8).toUpperCase();
}

function getStatusColor(status?: string) {
  if (status === 'ACTIVE' || status === 'CHECKED_IN') return '#10b981';
  if (status === 'CHECKING_OUT' || status === 'EXTENDING') return '#f59e0b';
  if (status === 'COMPLETED') return '#38bdf8';
  if (status === 'CANCELLED') return '#ef4444';
  return '#94a3b8';
}

const PHOTO_ANGLE_LABELS: Record<string, string> = {
  FRONT: 'Phía trước',
  BACK: 'Phía sau',
  LEFT: 'Bên trái',
  RIGHT: 'Bên phải',
  TOP: 'Từ trên',
  BOTTOM: 'Phía dưới',
  DETAIL: 'Cận cảnh',
};

const PART_TYPE_LABELS: Record<string, string> = {
  TIRE_WHEEL: 'Bánh xe / Lốp',
  SPOILER: 'Cánh gió',
  CHASSIS: 'Khung gầm',
  MOTOR: 'Motor / Động cơ',
  SHELL: 'Vỏ nhựa (Shell)',
  SERVO: 'Servo / Tay lái',
  REMOTE: 'Remote / Điều khiển',
  OTHER: 'Khác',
};

function getPhotoAngleLabel(angle?: string) {
  return angle ? PHOTO_ANGLE_LABELS[angle] : undefined;
}

function getPartTypeLabel(type?: string) {
  return type ? PART_TYPE_LABELS[type] || type : 'Hư hỏng';
}

function getFnbOrderStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    CONFIRMED: 'Đang chuẩn bị',
    DELIVERED: 'Đã giao',
    CANCELLED: 'Đã hủy',
  };
  return labels[status || ''] || getStatusLabel(status);
}

type FnbSummary = {
  items: { name: string; quantity: number; total: number }[];
  total: number;
  statusLabel: string;
};

/**
 * A session may receive several counter orders. The session screen is an
 * operational summary, so it deliberately combines those orders by dish
 * rather than making staff reconcile a stack of nearly-identical cards.
 */
function summarizeFnbOrders(
  orders: StaffSessionDetail['fnbOrders'] | undefined,
  sessionStatus?: string
): FnbSummary {
  const activeOrders = (orders || []).filter((order) => order.status !== 'CANCELLED');
  const itemsByName = new Map<string, { name: string; quantity: number; total: number }>();

  for (const order of activeOrders) {
    for (const item of order.items || []) {
      const name = item.name?.trim() || 'Món ăn';
      const key = name.toLocaleLowerCase('vi-VN');
      const current = itemsByName.get(key) || { name, quantity: 0, total: 0 };
      current.quantity += Number(item.qty || 0);
      current.total += Number(item.price || 0) * Number(item.qty || 0);
      itemsByName.set(key, current);
    }
  }

  const total = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const statusLabel =
    sessionStatus === 'COMPLETED'
      ? 'Đã hoàn tất phiên'
      : sessionStatus === 'CANCELLED'
        ? 'Phiên đã hủy'
        : activeOrders.some((order) => order.status === 'CONFIRMED')
        ? getFnbOrderStatusLabel('CONFIRMED')
        : activeOrders.some((order) => order.status === 'PENDING')
          ? getFnbOrderStatusLabel('PENDING')
          : activeOrders.length > 0
            ? getFnbOrderStatusLabel(activeOrders[0].status)
            : '';

  return { items: [...itemsByName.values()], total, statusLabel };
}

function getVehicleSourceLabel(type?: string) {
  return type === 'BYOC' ? 'Khách tự mang xe' : 'Xe thuê của cơ sở';
}

const FALLBACK_VEHICLE_IMAGE_URL =
  'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&q=80&w=400';

function getVehicleImageUrl(imageUrl?: string) {
  return imageUrl && !imageUrl.includes('cdn.rcfield.vn') ? imageUrl : FALLBACK_VEHICLE_IMAGE_URL;
}

export function StaffSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<StaffSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadSession = useCallback(async (isRefresh = false) => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await staffApi.getSessionDetail(sessionId);
      setSession(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải chi tiết phiên.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event, data) => {
      if (
        ![
          'CUSTOMER_CHECKOUT_CONFIRMED',
          'CUSTOMER_CHECKIN_CONFIRMED',
          'CUSTOMER_INSPECTION_DISPUTED',
          'CUSTOMER_PAYMENT_CONFIRMED',
          'CUSTOMER_EXTENSION_APPROVED',
          'CUSTOMER_EXTENSION_REJECTED',
          'SESSION_EXTENSION_EXPIRED',
          'SESSION_FNB_ORDER_ADDED',
        ].includes(event)
      ) {
        return;
      }

      const eventSessionId = data?.sessionId || data?.session_id;
      if (eventSessionId && eventSessionId !== sessionId) {
        return;
      }

      loadSession(true);
    });

    return unsubscribe;
  }, [loadSession, sessionId]);

  const fnbSummary = useMemo(
    () => summarizeFnbOrders(session?.fnbOrders, session?.status),
    [session?.fnbOrders, session?.status]
  );

  const totals = useMemo(() => {
    const photoTotal =
      session?.inspections?.reduce((sum, inspection) => sum + (inspection.photos?.length || 0), 0) ?? 0;
    return { fnbTotal: fnbSummary.total, photoTotal };
  }, [fnbSummary.total, session?.inspections]);

  const checkInInspection = useMemo(
    () => session?.inspections?.find((inspection) => inspection.type === 'CHECK_IN') ?? null,
    [session?.inspections]
  );

  const checkOutInspection = useMemo(
    () => session?.inspections?.find((inspection) => inspection.type === 'CHECK_OUT') ?? null,
    [session?.inspections]
  );

  const checkOutDisputed = Boolean(
    checkOutInspection &&
      !checkOutInspection.customerConfirmed &&
      checkOutInspection.customerConfirmedAt &&
      ['ACTIVE', 'EXTENDING'].includes(session?.status || '')
  );

  const isByoc = useMemo(
    () => !!session?.vehicles?.length && session.vehicles.every((vehicle) => vehicle.type === 'BYOC'),
    [session?.vehicles]
  );
  const paymentSummary = session?.paymentSummary;
  const operationalTiming = getSessionOperationalTiming(session?.plannedEnd, session?.status, now);
  const canSettlePayments = !!paymentSummary?.requiresSettlement;
  const settlementDescription = paymentSummary?.outstandingAmount
    ? `Cần thu thêm: ${formatCurrency(paymentSummary.outstandingAmount)}`
    : paymentSummary?.pendingRefundAmount
      ? `Cần hoàn cọc: ${formatCurrency(paymentSummary.pendingRefundAmount)}`
      : 'Không còn khoản cần thu hoặc hoàn tiền.';

  const handleStartInspection = (type: StaffInspectionType) => {
    router.push({
      pathname: '/staff/inspection/[sessionId]',
      params: { sessionId, type },
    } as any);
  };

  const handleSettlePayments = async () => {
    if (!session?.bookingId || !canSettlePayments) return;

    setSettling(true);
    try {
      await staffApi.settlePendingPayments(session.bookingId);
      Alert.alert('Đã xử lý', 'Yêu cầu xử lý thanh toán tồn đọng đã hoàn tất.');
      await loadSession(true);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể xử lý thanh toán tồn đọng.';
      Alert.alert('Lỗi', message);
    } finally {
      setSettling(false);
    }
  };

  const handleConfirmCheckout = () => {
    if (!checkOutInspection) return;

    Alert.alert(
      'Xác nhận checkout',
      'Xác nhận khách đã xem biên bản và hoàn tất trả xe tại quầy? Nếu còn phí phát sinh, đơn sẽ chuyển sang chờ thanh toán.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận hoàn tất',
          onPress: async () => {
            setConfirmingCheckout(true);
            try {
              const result = await staffApi.confirmCheckout(sessionId, checkOutInspection.inspectionId);
              Alert.alert(
                'Đã xác nhận',
                result?.alreadyCompleted
                  ? 'Khách đã xác nhận trước đó. Phiên đã hoàn tất.'
                  : 'Checkout đã hoàn tất. Kiểm tra thanh toán tồn đọng nếu có phí phát sinh.'
              );
              await loadSession(true);
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Không thể xác nhận checkout.';
              Alert.alert('Lỗi', message);
            } finally {
              setConfirmingCheckout(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-900 px-5 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]"
        >
          <ArrowLeft color="#e2e8f0" size={19} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[12px] uppercase tracking-wider text-slate-500 dark:text-slate-400" weight="700">
            Phiên chạy
          </Text>
          <Text className="mt-1 text-[19px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
            #{shortId(sessionId)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : !session ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-center text-[15px] text-slate-900 dark:text-white" weight="700">
            Không tìm thấy phiên
          </Text>
          <Text className="mt-1 text-center text-[12px] text-slate-500">
            Phiên có thể đã bị xóa hoặc tài khoản không có quyền xem.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-5 py-5 pb-24"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSession(true)}
              colors={['#f97316']}
              tintColor="#f97316"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/70 p-4 shadow-sm">
            <View className="mb-4 flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[16px] text-slate-900 dark:text-white" weight="700">
                  Booking #{shortId(session.bookingId)}
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  Nhân viên: {session.staffName || 'Nhân viên trực ca'}
                </Text>
              </View>
              <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-2 py-1">
                <Text
                  className="text-[9px] uppercase"
                  weight="700"
                  style={{ color: getStatusColor(session.status) }}
                >
                  {getStatusLabel(session.status)}
                </Text>
              </View>
            </View>

            <View className="gap-2">
              <InfoRow Icon={Clock} label="Bắt đầu" value={formatDateTime(session.actualStart)} />
              <InfoRow Icon={Clock} label="Kết thúc dự kiến" value={formatDateTime(session.plannedEnd)} />
              {session.actualEnd ? (
                <InfoRow Icon={CheckCircle2} label="Kết thúc thực tế" value={formatDateTime(session.actualEnd)} />
              ) : null}
            </View>

            <View className="mt-4 flex-row flex-wrap gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <Metric label="Người chơi" value={session.participants?.length || 0} Icon={UserRound} />
              <Metric label="Xe" value={session.vehicles?.length || 0} Icon={Car} />
              <Metric label="Kiểm tra" value={session.inspections?.length || 0} Icon={ShieldCheck} />
              <Metric label="Ảnh" value={totals.photoTotal} Icon={ReceiptText} />
            </View>
          </View>

          {(operationalTiming.state === 'DUE_FOR_CHECKOUT' || operationalTiming.state === 'OVERDUE') && (
            <View
              className={`mb-5 rounded-2xl border p-4 ${
                operationalTiming.state === 'OVERDUE'
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <Text
                className={`text-[13px] ${operationalTiming.state === 'OVERDUE' ? 'text-red-500' : 'text-amber-600'}`}
                weight="700"
              >
                {operationalTiming.state === 'OVERDUE'
                  ? `Phiên đã quá giờ ${operationalTiming.minutesPastPlannedEnd} phút`
                  : 'Đã đến giờ trả xe'}
              </Text>
              <Text className="mt-1 text-[11px] leading-4 text-slate-500">
                Xe vẫn được giữ trong phiên cho đến khi hoàn tất biên bản trả xe và xác nhận checkout.
              </Text>
            </View>
          )}

          <SessionOperations
            status={session.status}
            isByoc={isByoc}
            hasCheckInInspection={!!checkInInspection}
            hasCheckOutInspection={!!checkOutInspection}
            checkOutConfirmed={!!checkOutInspection?.customerConfirmed}
            checkOutDisputed={checkOutDisputed}
            disputedNote={checkOutInspection?.staffNotes}
            onStartInspection={handleStartInspection}
            onConfirmCheckout={handleConfirmCheckout}
            confirmingCheckout={confirmingCheckout}
            operationalTiming={operationalTiming}
          />

          <StaffSessionTools
            session={session}
            onUpdated={() => loadSession(true)}
            operationalTiming={operationalTiming}
          />

          <SectionTitle title="Người chơi" />
          <View className="mb-5 gap-3">
            {session.participants?.map((participant, index) => (
              <ParticipantRow
                key={`${participant.name}-${index}`}
                participant={participant}
                index={index}
              />
            ))}
            {session.participants?.length === 0 ? <EmptyText text="Chưa có người chơi trong phiên." /> : null}
          </View>

          <SectionTitle title="Xe trong phiên" />
          <View className="mb-5 gap-3">
            {session.vehicles?.map((vehicle) => (
              <View
                key={vehicle.vehicleId}
                className="flex-row items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-3 shadow-sm"
              >
                <VehicleThumbnail imageUrl={vehicle.imageUrl} name={vehicle.name} />
                <View className="flex-1">
                  <Text className="text-[13px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
                    {vehicle.name}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-500">{getVehicleSourceLabel(vehicle.type)}</Text>
                </View>
              </View>
            ))}
            {session.vehicles?.length === 0 ? <EmptyText text="Chưa gán xe cho phiên." /> : null}
          </View>

          <SectionTitle title="Kiểm tra xe" />
          <View className="mb-5 gap-3">
            {session.inspections?.map((inspection) => (
              <View
                key={inspection.inspectionId}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-2">
                    <ShieldCheck color="#f97316" size={16} />
                    <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                      {inspection.type === 'CHECK_IN' ? 'Nhận xe' : 'Trả xe'}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-slate-500" weight="700">
                    {inspection.photos?.length || 0} ảnh
                  </Text>
                </View>
                <Text className="mt-2 text-[11px] text-slate-400">
                  Checklist: {inspection.checklist?.length || 0} mục
                  {inspection.damageFlagged ? ' • Có ghi nhận hư hỏng' : ''}
                </Text>
                {inspection.damageFlagged ? (
                  <View className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <Text className="text-[11px] text-red-300" weight="700">
                      Hư hỏng/phí phát sinh
                    </Text>
                    {inspection.damageLineItems?.map((item, index) => (
                      <View key={item.id || `${item.partType}-${index}`} className="mt-2 flex-row justify-between gap-3">
                        <Text className="flex-1 text-[10px] text-red-100/60" numberOfLines={1}>
                          {item.customPartName || getPartTypeLabel(item.partType)}
                        </Text>
                        <Text className="text-[10px] text-red-100" weight="700">
                          {formatCurrency(item.lineTotal)}
                        </Text>
                      </View>
                    ))}
                    <View className="mt-2 flex-row justify-between gap-3 border-t border-red-500/20 pt-2">
                      <Text className="text-[10px] text-red-100/60">Tổng phí bồi thường</Text>
                      <Text className="text-[10px] text-red-100" weight="700">
                        {formatCurrency(inspection.totalDamageCharge)}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {inspection.type === 'CHECK_OUT' ? (
                  <View
                    className={`mt-3 rounded-xl border p-3 ${
                      inspection.customerConfirmed
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : inspection.customerConfirmedAt
                        ? 'border-red-500/20 bg-red-500/10'
                        : 'border-amber-500/20 bg-amber-500/10'
                    }`}
                  >
                    <Text
                      className={`text-[11px] ${
                        inspection.customerConfirmed 
                          ? 'text-emerald-300' 
                          : inspection.customerConfirmedAt 
                            ? 'text-red-300' 
                            : 'text-amber-300'
                      }`}
                      weight="700"
                    >
                      {inspection.customerConfirmed
                        ? 'Khách đã xác nhận biên bản trả xe'
                        : inspection.customerConfirmedAt
                          ? 'Khách từ chối biên bản'
                          : 'Đang chờ khách xác nhận biên bản trả xe'}
                    </Text>
                    {inspection.customerConfirmedAt ? (
                      <Text className="mt-1 text-[10px] text-slate-500">
                        {inspection.customerConfirmed ? 'Xác nhận' : 'Phản hồi'} lúc {formatDateTime(inspection.customerConfirmedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {inspection.photos?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    <View className="flex-row gap-2">
                      {inspection.photos.map((photo, index) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Phóng to ảnh ${getPhotoAngleLabel(photo.angle) || index + 1}`}
                          onPress={() =>
                            setPreviewPhoto({
                              url: photo.url,
                              title: `${inspection.type === 'CHECK_IN' ? 'Ảnh nhận xe' : 'Ảnh trả xe'} · ${getPhotoAngleLabel(photo.angle) || `Ảnh ${index + 1}`}`,
                            })
                          }
                          key={`${inspection.inspectionId}-${photo.url}-${index}`}
                          className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"
                        >
                          <Image source={{ uri: photo.url }} className="h-full w-full" resizeMode="cover" />
                          {getPhotoAngleLabel(photo.angle) ? (
                            <View className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5">
                              <Text className="text-[7px] uppercase text-white" weight="700">
                                {getPhotoAngleLabel(photo.angle)}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
                {inspection.checklist?.length ? (
                  <View className="mt-3 gap-2">
                    {inspection.checklist.slice(0, 4).map((item) => (
                      <View key={`${inspection.inspectionId}-${item.itemKey}`} className="flex-row gap-2">
                        <CheckCircle2
                          color={item.status === 'OK' ? '#34d399' : '#f59e0b'}
                          size={13}
                          style={{ marginTop: 2 }}
                        />
                        <View className="flex-1">
                          <Text className="text-[10px] text-slate-300" numberOfLines={2}>
                            {item.itemLabel}
                          </Text>
                          {item.note ? (
                            <Text className="mt-0.5 text-[9px] text-slate-500" numberOfLines={2}>
                              {item.note}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          className={`text-[9px] ${item.status === 'OK' ? 'text-emerald-300' : 'text-amber-300'}`}
                          weight="700"
                        >
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {inspection.staffNotes ? (
                  <Text className="mt-2 text-[11px] text-slate-500" numberOfLines={3}>
                    {inspection.staffNotes}
                  </Text>
                ) : null}
              </View>
            ))}
            {session.inspections?.length === 0 ? <EmptyText text="Chưa có biên bản kiểm tra xe." /> : null}
          </View>

          <SectionTitle title="Đồ ăn, thức uống của phiên" />
          <View className="mb-5 gap-3">
            {fnbSummary.items.length > 0 ? (
              <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
                <View className="mb-3 flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                      Đồ ăn, thức uống đã gọi
                    </Text>
                    <Text className="mt-1 text-[10px] text-slate-500">
                      {fnbSummary.statusLabel}
                    </Text>
                  </View>
                  <Text className="text-[12px] text-[#f97316]" weight="700">
                    {formatCurrency(fnbSummary.total)}
                  </Text>
                </View>
                <View className="gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {fnbSummary.items.map((item) => (
                    <View key={item.name} className="flex-row justify-between gap-3">
                      <Text className="flex-1 text-[11px] text-slate-400" numberOfLines={1}>
                        {item.quantity}x {item.name}
                      </Text>
                      <Text className="text-[11px] text-slate-500">{formatCurrency(item.total)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <EmptyText text="Phiên chưa có đơn đồ ăn, thức uống." />
            )}
          </View>

          <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                  {canSettlePayments ? 'Thanh toán tồn đọng' : 'Thanh toán đã hoàn tất'}
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  {settlementDescription}
                </Text>
              </View>
              {canSettlePayments ? <Coffee color="#f97316" size={20} /> : <CheckCircle2 color="#10b981" size={20} />}
            </View>
            <Pressable
              disabled={!canSettlePayments || settling}
              onPress={handleSettlePayments}
              className={`h-11 flex-row items-center justify-center gap-2 rounded-xl ${
                canSettlePayments ? 'bg-[#ea580c]' : 'bg-slate-200 dark:bg-slate-800'
              } ${
                settling || !canSettlePayments ? 'opacity-70' : ''
              }`}
            >
              {settling ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <WalletCards color="#ffffff" size={16} />
              )}
              <Text className="text-[12px] text-white" weight="700">
                {canSettlePayments ? 'Xử lý thanh toán' : 'Đã thanh toán đầy đủ'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      <ImageZoomModal
        visible={!!previewPhoto}
        imageUrl={previewPhoto?.url}
        title={previewPhoto?.title}
        onClose={() => setPreviewPhoto(null)}
      />
    </SafeAreaView>
  );
}

function InfoRow({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon color="#94a3b8" size={14} />
      <Text className="w-32 text-[11px] text-slate-500">{label}</Text>
      <Text className="flex-1 text-right text-[11px] text-slate-300" weight="700">
        {value}
      </Text>
    </View>
  );
}

function Metric({ Icon, label, value }: { Icon: LucideIcon; label: string; value: number }) {
  return (
    <View className="min-w-[47%] flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0b0f19] p-3">
      <Icon color="#f97316" size={16} />
      <Text className="mt-2 text-[18px] text-slate-900 dark:text-white" weight="700">
        {value}
      </Text>
      <Text className="mt-0.5 text-[10px] text-slate-500">{label}</Text>
    </View>
  );
}

function SessionOperations({
  status,
  isByoc,
  hasCheckInInspection,
  hasCheckOutInspection,
  checkOutConfirmed,
  checkOutDisputed,
  disputedNote,
  onStartInspection,
  onConfirmCheckout,
  confirmingCheckout,
  operationalTiming,
}: {
  status: string;
  isByoc: boolean;
  hasCheckInInspection: boolean;
  hasCheckOutInspection: boolean;
  checkOutConfirmed: boolean;
  checkOutDisputed?: boolean;
  disputedNote?: string;
  onStartInspection: (type: StaffInspectionType) => void;
  onConfirmCheckout: () => void;
  confirmingCheckout: boolean;
  operationalTiming: SessionOperationalTiming;
}) {
  const canSubmitCheckIn = status === 'CHECKED_IN' && !hasCheckInInspection;
  const canSubmitCheckOut =
    ['ACTIVE', 'EXTENDING'].includes(status) && (!hasCheckOutInspection || checkOutDisputed);

  return (
    <View className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
            Thao tác phiên
          </Text>
          <Text className="mt-1 text-[11px] leading-4 text-slate-500">
            Tạo biên bản kiểm xe để đi tiếp qua nhận xe, trả xe và hoàn tất phiên.
          </Text>
        </View>
        <ShieldCheck color="#f97316" size={20} />
      </View>

      <View className="gap-3">
        {checkOutDisputed ? (
          <View className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle color="#ef4444" size={15} />
              <Text className="flex-1 text-[12px] text-red-400" weight="700">
                Khách phản hồi sai lệch biên bản trả xe
              </Text>
            </View>
            {disputedNote ? (
              <Text className="mt-1.5 text-[11px] leading-4 text-red-300/90">
                {disputedNote}
              </Text>
            ) : null}
            <Text className="mt-1 text-[10px] text-slate-400">
              Cần đối chiếu lại ảnh, tình trạng xe và lập lại biên bản trả xe mới trước khi đóng phiên.
            </Text>
          </View>
        ) : null}

        {canSubmitCheckIn ? (
          <Pressable
            onPress={() => onStartInspection('CHECK_IN')}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 active:bg-emerald-700"
          >
            <CheckCircle2 color="#ffffff" size={16} />
            <Text className="text-[12px] text-white" weight="700">
              Tạo biên bản nhận xe
            </Text>
          </Pressable>
        ) : null}

        {canSubmitCheckOut ? (
          <Pressable
            onPress={() => onStartInspection('CHECK_OUT')}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] active:bg-[#c2410c]"
          >
            <ReceiptText color="#ffffff" size={16} />
            <Text className="text-[12px] text-white" weight="700">
              {checkOutDisputed
                ? 'Lập lại biên bản trả xe'
                : operationalTiming.state === 'ON_TIME'
                  ? isByoc
                    ? 'Tạo biên bản trả xe khách tự mang'
                    : 'Tạo biên bản trả xe'
                  : 'Xử lý trả xe'}
            </Text>
          </Pressable>
        ) : null}

        {status === 'CHECKING_OUT' && hasCheckOutInspection && !checkOutConfirmed ? (
          <View className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Text className="text-[12px] text-amber-300" weight="700">
              Đang chờ xác nhận trả xe
            </Text>
            <Text className="mt-1 text-[11px] leading-4 text-amber-200/70">
              Chờ khách xác nhận trên ứng dụng, hoặc xác nhận trực tiếp tại quầy sau khi khách đã xem biên bản.
            </Text>
            <Pressable
              disabled={confirmingCheckout}
              onPress={onConfirmCheckout}
              className={`mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
                confirmingCheckout ? 'opacity-70' : ''
              }`}
            >
              {confirmingCheckout ? <ActivityIndicator color="#ffffff" size="small" /> : <CheckCircle2 color="#ffffff" size={15} />}
              <Text className="text-[11px] text-white" weight="700">
                Xác nhận trả xe tại quầy
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!canSubmitCheckIn && !canSubmitCheckOut && status !== 'CHECKING_OUT' ? (
          <Text className="text-[11px] leading-4 text-slate-500">
            Không có thao tác kiểm xe cần xử lý ở trạng thái hiện tại.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="mb-3 text-[12px] uppercase tracking-wider text-slate-400" weight="700">
      {title}
    </Text>
  );
}

function ParticipantRow({
  participant,
  index,
}: {
  participant: { name: string; type: string; avatarUrl?: string };
  index: number;
}) {
  const initials = participant.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [participant.avatarUrl]);

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      <View className="h-10 w-10 overflow-hidden rounded-full border border-orange-500/20 bg-orange-500/10">
        {participant.avatarUrl && !avatarFailed ? (
          <Image
            source={{ uri: participant.avatarUrl }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={`Ảnh ${participant.name}`}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-[11px] text-[#f97316]" weight="700">
              {initials || String(index + 1)}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[13px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
          {participant.name || `Người chơi ${index + 1}`}
        </Text>
        <Text className="mt-1 text-[11px] text-slate-500">Người chơi</Text>
      </View>
    </View>
  );
}

function VehicleThumbnail({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [source, setSource] = useState(() => getVehicleImageUrl(imageUrl));

  useEffect(() => {
    setSource(getVehicleImageUrl(imageUrl));
  }, [imageUrl]);

  return (
    <View className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
      {source ? (
        <Image
          source={{ uri: source }}
          className="h-full w-full"
          resizeMode="cover"
          accessibilityLabel={`Ảnh ${name}`}
          onError={() => {
            if (source !== FALLBACK_VEHICLE_IMAGE_URL) {
              setSource(FALLBACK_VEHICLE_IMAGE_URL);
            } else {
              setSource('');
            }
          }}
        />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Car color="#64748b" size={22} />
        </View>
      )}
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/40 p-4">
      <Text className="text-center text-[11px] text-slate-500">{text}</Text>
    </View>
  );
}
