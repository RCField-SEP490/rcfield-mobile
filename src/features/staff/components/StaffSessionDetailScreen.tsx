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
import { StaffSessionTools } from '@/features/staff/components/StaffSessionTools';
import { wsClient } from '@/shared/lib/websocket';
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

export function StaffSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<StaffSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

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
    const unsubscribe = wsClient.subscribe((event, data) => {
      if (
        ![
          'CUSTOMER_CHECKOUT_CONFIRMED',
          'CUSTOMER_CHECKIN_CONFIRMED',
          'CUSTOMER_INSPECTION_DISPUTED',
          'CUSTOMER_PAYMENT_CONFIRMED',
          'CUSTOMER_EXTENSION_APPROVED',
          'CUSTOMER_EXTENSION_REJECTED',
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

  const totals = useMemo(() => {
    const fnbTotal = session?.fnbOrders?.reduce((sum, order) => sum + Number(order.total || 0), 0) ?? 0;
    const photoTotal =
      session?.inspections?.reduce((sum, inspection) => sum + (inspection.photos?.length || 0), 0) ?? 0;
    return { fnbTotal, photoTotal };
  }, [session]);

  const checkInInspection = useMemo(
    () => session?.inspections?.find((inspection) => inspection.type === 'CHECK_IN') ?? null,
    [session?.inspections]
  );

  const checkOutInspection = useMemo(
    () => session?.inspections?.find((inspection) => inspection.type === 'CHECK_OUT') ?? null,
    [session?.inspections]
  );

  const isByoc = useMemo(
    () => !!session?.vehicles?.length && session.vehicles.every((vehicle) => vehicle.type === 'BYOC'),
    [session?.vehicles]
  );

  const handleStartInspection = (type: StaffInspectionType) => {
    router.push({
      pathname: '/staff/inspection/[sessionId]',
      params: { sessionId, type },
    } as any);
  };

  const handleSettlePayments = async () => {
    if (!session?.bookingId) return;

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

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 border-b border-slate-900 px-5 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0f172a]"
        >
          <ArrowLeft color="#e2e8f0" size={19} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[12px] uppercase tracking-wider text-slate-500" weight="700">
            Phiên chạy
          </Text>
          <Text className="mt-1 text-[19px] text-white" weight="700" numberOfLines={1}>
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
          <Text className="text-center text-[15px] text-white" weight="700">
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
          <View className="mb-5 rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-4">
            <View className="mb-4 flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[16px] text-white" weight="700">
                  Booking #{shortId(session.bookingId)}
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  Staff: {session.staffName || 'Nhân viên trực ca'}
                </Text>
              </View>
              <View className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1">
                <Text
                  className="text-[9px] uppercase"
                  weight="700"
                  style={{ color: getStatusColor(session.status) }}
                >
                  {session.status}
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

            <View className="mt-4 flex-row flex-wrap gap-3 border-t border-slate-800 pt-4">
              <Metric label="Người chơi" value={session.participants?.length || 0} Icon={UserRound} />
              <Metric label="Xe" value={session.vehicles?.length || 0} Icon={Car} />
              <Metric label="Kiểm tra" value={session.inspections?.length || 0} Icon={ShieldCheck} />
              <Metric label="Ảnh" value={totals.photoTotal} Icon={ReceiptText} />
            </View>
          </View>

          <SessionOperations
            status={session.status}
            isByoc={isByoc}
            hasCheckInInspection={!!checkInInspection}
            hasCheckOutInspection={!!checkOutInspection}
            checkOutConfirmed={!!checkOutInspection?.customerConfirmed}
            onStartInspection={handleStartInspection}
          />

          <StaffSessionTools session={session} onUpdated={() => loadSession(true)} />

          <SectionTitle title="Người chơi" />
          <View className="mb-5 gap-3">
            {session.participants?.map((participant, index) => (
              <SimpleRow
                key={`${participant.name}-${index}`}
                Icon={UserRound}
                title={participant.name || `Người chơi ${index + 1}`}
                subtitle={participant.type || 'PLAYER'}
              />
            ))}
            {session.participants?.length === 0 ? <EmptyText text="Chưa có người chơi trong phiên." /> : null}
          </View>

          <SectionTitle title="Xe trong phiên" />
          <View className="mb-5 gap-3">
            {session.vehicles?.map((vehicle) => (
              <View
                key={vehicle.vehicleId}
                className="flex-row items-center gap-3 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-3"
              >
                <View className="h-14 w-14 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                  {vehicle.imageUrl ? (
                    <Image source={{ uri: vehicle.imageUrl }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Car color="#64748b" size={22} />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
                    {vehicle.name}
                  </Text>
                  <Text className="mt-1 text-[11px] text-slate-500">{vehicle.type}</Text>
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
                className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-2">
                    <ShieldCheck color="#f97316" size={16} />
                    <Text className="text-[13px] text-white" weight="700">
                      {inspection.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'}
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
                    {inspection.damageDescription ? (
                      <Text className="mt-1 text-[10px] leading-4 text-red-100/70">
                        {inspection.damageDescription}
                      </Text>
                    ) : null}
                    {inspection.estimatedCost !== undefined ? (
                      <View className="mt-2 flex-row justify-between gap-3">
                        <Text className="text-[10px] text-red-100/60">Chi phí dự kiến</Text>
                        <Text className="text-[10px] text-red-100" weight="700">
                          {formatCurrency(inspection.estimatedCost)}
                        </Text>
                      </View>
                    ) : null}
                    {inspection.finalCharge !== undefined ? (
                      <View className="mt-1 flex-row justify-between gap-3">
                        <Text className="text-[10px] text-red-100/60">Tính phí sau hệ số</Text>
                        <Text className="text-[10px] text-red-100" weight="700">
                          {formatCurrency(inspection.finalCharge)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {inspection.type === 'CHECK_OUT' ? (
                  <View
                    className={`mt-3 rounded-xl border p-3 ${
                      inspection.customerConfirmed
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : 'border-amber-500/20 bg-amber-500/10'
                    }`}
                  >
                    <Text
                      className={`text-[11px] ${
                        inspection.customerConfirmed ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                      weight="700"
                    >
                      {inspection.customerConfirmed
                        ? 'Khách đã xác nhận biên bản trả xe'
                        : 'Đang chờ khách xác nhận biên bản trả xe'}
                    </Text>
                    {inspection.customerConfirmedAt ? (
                      <Text className="mt-1 text-[10px] text-slate-500">
                        Xác nhận lúc {formatDateTime(inspection.customerConfirmedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {inspection.photos?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    <View className="flex-row gap-2">
                      {inspection.photos.map((photo, index) => (
                        <View
                          key={`${inspection.inspectionId}-${photo.url}-${index}`}
                          className="h-20 w-20 overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                        >
                          <Image source={{ uri: photo.url }} className="h-full w-full" resizeMode="cover" />
                          <View className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5">
                            <Text className="text-[7px] uppercase text-white" weight="700">
                              {photo.angle || 'PHOTO'}
                            </Text>
                          </View>
                        </View>
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
                          {item.status}
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

          <SectionTitle title="F&B của phiên" />
          <View className="mb-5 gap-3">
            {session.fnbOrders?.map((order) => (
              <View key={order.orderId} className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
                <View className="mb-3 flex-row items-center justify-between gap-3">
                  <View>
                    <Text className="text-[13px] text-white" weight="700">
                      {order.orderType}
                    </Text>
                    <Text className="mt-1 text-[10px] text-slate-500">{order.status}</Text>
                  </View>
                  <Text className="text-[12px] text-[#f97316]" weight="700">
                    {formatCurrency(order.total)}
                  </Text>
                </View>
                {order.items?.map((item, index) => (
                  <View key={`${order.orderId}-${index}`} className="flex-row justify-between gap-3">
                    <Text className="flex-1 text-[11px] text-slate-400" numberOfLines={1}>
                      {item.qty}x {item.name}
                    </Text>
                    <Text className="text-[11px] text-slate-500">{formatCurrency(item.price * item.qty)}</Text>
                  </View>
                ))}
              </View>
            ))}
            {session.fnbOrders?.length === 0 ? <EmptyText text="Phiên chưa có đơn F&B." /> : null}
          </View>

          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[13px] text-white" weight="700">
                  Thanh toán tồn đọng
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  Tổng F&B ghi nhận: {formatCurrency(totals.fnbTotal)}
                </Text>
              </View>
              <Coffee color="#f97316" size={20} />
            </View>
            <Pressable
              disabled={settling}
              onPress={handleSettlePayments}
              className={`h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
                settling ? 'opacity-70' : ''
              }`}
            >
              {settling ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <WalletCards color="#ffffff" size={16} />
              )}
              <Text className="text-[12px] text-white" weight="700">
                Xử lý thanh toán
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
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
    <View className="min-w-[47%] flex-1 rounded-xl border border-slate-800 bg-[#0b0f19] p-3">
      <Icon color="#f97316" size={16} />
      <Text className="mt-2 text-[18px] text-white" weight="700">
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
  onStartInspection,
}: {
  status: string;
  isByoc: boolean;
  hasCheckInInspection: boolean;
  hasCheckOutInspection: boolean;
  checkOutConfirmed: boolean;
  onStartInspection: (type: StaffInspectionType) => void;
}) {
  const canSubmitCheckIn = status === 'CHECKED_IN' && !hasCheckInInspection;
  const canSubmitCheckOut = ['ACTIVE', 'EXTENDING'].includes(status) && !hasCheckOutInspection;

  return (
    <View className="mb-5 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[13px] text-white" weight="700">
            Thao tác phiên
          </Text>
          <Text className="mt-1 text-[11px] leading-4 text-slate-500">
            Tạo biên bản kiểm xe để đi tiếp qua nhận xe, trả xe và hoàn tất checkout.
          </Text>
        </View>
        <ShieldCheck color="#f97316" size={20} />
      </View>

      <View className="gap-3">
        {canSubmitCheckIn ? (
          <Pressable
            onPress={() => onStartInspection('CHECK_IN')}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600"
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
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c]"
          >
            <ReceiptText color="#ffffff" size={16} />
            <Text className="text-[12px] text-white" weight="700">
              {isByoc ? 'Đóng phiên BYOC' : 'Tạo biên bản trả xe'}
            </Text>
          </Pressable>
        ) : null}

        {status === 'CHECKING_OUT' && hasCheckOutInspection && !checkOutConfirmed ? (
          <View className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Text className="text-[12px] text-amber-300" weight="700">
              Đang chờ khách xác nhận biên bản trả xe
            </Text>
            <Text className="mt-1 text-[11px] leading-4 text-amber-200/70">
              Khi khách đồng ý trên mobile, phiên sẽ chuyển sang hoàn tất.
            </Text>
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

function SimpleRow({
  Icon,
  title,
  subtitle,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
        <Icon color="#f97316" size={18} />
      </View>
      <View className="flex-1">
        <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-1 text-[11px] text-slate-500">{subtitle}</Text>
      </View>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-slate-800 bg-[#0f172a]/40 p-4">
      <Text className="text-center text-[11px] text-slate-500">{text}</Text>
    </View>
  );
}
