import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock3,
  Coffee,
  Plus,
  Repeat2,
  RefreshCw,
} from 'lucide-react-native';

import {
  staffApi,
  type StaffMenuItem,
  type StaffSessionDetail,
  type StaffVehicleUnit,
} from '@/features/staff/api/staff.api';
import { Text } from '@/shared/ui/Text';

function formatCurrency(value?: number | string) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatTime(iso?: string) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function shortId(value?: string) {
  if (!value) return '--';
  return value.slice(0, 8).toUpperCase();
}

function getUnitName(unit: StaffVehicleUnit) {
  return unit.catalog?.name || unit.identifier || `Xe ${shortId(unit.id)}`;
}

function getMenuImage(item: StaffMenuItem) {
  return item.image || item.imageUrl || item.image_url || null;
}

export function StaffSessionTools({
  session,
  onUpdated,
}: {
  session: StaffSessionDetail;
  onUpdated: () => Promise<void>;
}) {
  const canOperate = ['ACTIVE', 'EXTENDING'].includes(session.status);
  const canProposeExtension = session.status === 'ACTIVE';
  const extensionPending = session.extensionProposal?.status === 'PENDING' || session.status === 'EXTENDING';
  const directExtension = session.bookingSource === 'STAFF_MANUAL';

  const [loadingResources, setLoadingResources] = useState(false);
  const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<StaffVehicleUnit[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [qtyText, setQtyText] = useState('1');
  const [selectedOldVehicleId, setSelectedOldVehicleId] = useState('');
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [oldVehicleStatus, setOldVehicleStatus] = useState<'MAINTENANCE' | 'AVAILABLE'>('MAINTENANCE');
  const [submitting, setSubmitting] = useState<'extension' | 'fnb' | 'swap' | null>(null);

  const rentalVehicles = useMemo(
    () => session.vehicles?.filter((vehicle) => vehicle.type === 'RENT') ?? [],
    [session.vehicles]
  );

  const extensionOptions = useMemo(() => {
    const quoted = session.extensionPricingOptions ?? [];
    return [15, 30, 60].map((minutes) => {
      const option = quoted.find((item) => item.extraMinutes === minutes);
      return {
        extraMinutes: minutes,
        additionalFee: Number(option?.additionalFee ?? 0),
        newPlannedEnd:
          option?.newPlannedEnd ??
          new Date(new Date(session.plannedEnd).getTime() + minutes * 60000).toISOString(),
        available: option?.available !== false,
        blockedReason: option?.blockedReason,
      };
    });
  }, [session.extensionPricingOptions, session.plannedEnd]);

  const replacementVehicles = useMemo(() => {
    const activeIds = new Set(rentalVehicles.map((vehicle) => vehicle.vehicleId));
    return availableVehicles.filter((vehicle) => vehicle.status === 'AVAILABLE' && !activeIds.has(vehicle.id));
  }, [availableVehicles, rentalVehicles]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId),
    [menuItems, selectedMenuItemId]
  );

  const loadResources = useCallback(async () => {
    if (!session.cafeId || !canOperate) return;

    setLoadingResources(true);
    try {
      const [menu, vehicles] = await Promise.all([
        staffApi.getCafeMenu(session.cafeId),
        staffApi.getCafeVehicles(session.cafeId),
      ]);
      setMenuItems(menu);
      setAvailableVehicles(vehicles);
      if (!selectedMenuItemId && menu[0]) {
        setSelectedMenuItemId(menu[0].id);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải menu hoặc danh sách xe khả dụng.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoadingResources(false);
    }
  }, [canOperate, selectedMenuItemId, session.cafeId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    if (!selectedOldVehicleId && rentalVehicles[0]) {
      setSelectedOldVehicleId(rentalVehicles[0].vehicleId);
    }
  }, [rentalVehicles, selectedOldVehicleId]);

  const handleExtension = (option: {
    extraMinutes: number;
    additionalFee: number;
    newPlannedEnd: string;
    available: boolean;
    blockedReason?: string;
  }) => {
    if (!option.available) {
      Alert.alert('Không thể gia hạn', option.blockedReason || 'Khung giờ này không khả dụng.');
      return;
    }

    Alert.alert(
      directExtension ? 'Gia hạn trực tiếp' : 'Gửi yêu cầu gia hạn',
      directExtension
        ? `Xác nhận gia hạn +${option.extraMinutes} phút tới ${formatTime(option.newPlannedEnd)} với phí ${formatCurrency(option.additionalFee)}?`
        : `Gửi yêu cầu +${option.extraMinutes} phút tới khách với phí ${formatCurrency(option.additionalFee)}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: directExtension ? 'Gia hạn ngay' : 'Gửi yêu cầu',
          onPress: async () => {
            setSubmitting('extension');
            try {
              await staffApi.proposeExtension(session.sessionId, {
                extraMinutes: option.extraMinutes,
                additionalFee: option.additionalFee,
                direct: directExtension,
              });
              Alert.alert(
                'Đã xử lý',
                directExtension ? 'Phiên đã được gia hạn trực tiếp.' : 'Đã gửi yêu cầu gia hạn tới khách.'
              );
              await onUpdated();
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Không thể xử lý gia hạn.';
              Alert.alert('Lỗi', message);
            } finally {
              setSubmitting(null);
            }
          },
        },
      ]
    );
  };

  const handleAddFnb = async () => {
    if (!selectedMenuItem) {
      Alert.alert('Chưa chọn món', 'Vui lòng chọn món trước khi thêm vào phiên.');
      return;
    }

    const qty = Math.max(1, Math.min(Number(qtyText) || 1, 99));
    setSubmitting('fnb');
    try {
      await staffApi.addSessionFnbOrder(session.sessionId, {
        items: [
          {
            name: selectedMenuItem.name,
            qty,
            price: Number(selectedMenuItem.price || 0),
          },
        ],
      });
      Alert.alert('Đã thêm món', 'Món đã được thêm vào phiên và thông báo tới khách.');
      setQtyText('1');
      await onUpdated();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể thêm món vào phiên.';
      Alert.alert('Lỗi', message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleSwapVehicle = () => {
    if (!selectedOldVehicleId || !selectedReplacementId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn xe đang chạy và xe thay thế khả dụng.');
      return;
    }

    Alert.alert(
      'Xác nhận đổi xe',
      oldVehicleStatus === 'MAINTENANCE'
        ? 'Xe cũ sẽ được chuyển sang bảo trì và xe thay thế sẽ vào phiên.'
        : 'Xe cũ sẽ trả lại kho trống và xe thay thế sẽ vào phiên.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đổi xe',
          onPress: async () => {
            setSubmitting('swap');
            try {
              await staffApi.swapSessionVehicle(session.sessionId, {
                oldVehicleId: selectedOldVehicleId,
                newVehicleId: selectedReplacementId,
                oldVehicleNewStatus: oldVehicleStatus,
              });
              Alert.alert('Đã đổi xe', 'Xe thay thế đã được gán vào phiên.');
              setSelectedReplacementId('');
              await loadResources();
              await onUpdated();
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Không thể đổi xe trong phiên.';
              Alert.alert('Lỗi', message);
            } finally {
              setSubmitting(null);
            }
          },
        },
      ]
    );
  };

  if (!canOperate) {
    return null;
  }

  return (
    <View className="mb-5 gap-4">
      <ToolCard
        icon={<Clock3 color="#f97316" size={18} />}
        title="Gia hạn ca chạy"
        subtitle={`Kết thúc dự kiến ${formatTime(session.plannedEnd)}`}
      >
        {extensionPending ? (
          <View className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Text className="text-[12px] text-amber-300" weight="700">
              Đang chờ khách phản hồi gia hạn {session.extensionProposal?.extraMinutes || ''} phút
            </Text>
            <Text className="mt-1 text-[11px] leading-4 text-amber-100/70">
              Khi khách đồng ý hoặc từ chối, màn này sẽ tự cập nhật qua WebSocket.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
              {extensionOptions.map((option) => (
                <Pressable
                  key={option.extraMinutes}
                  disabled={!canProposeExtension || submitting === 'extension'}
                  onPress={() => handleExtension(option)}
                  className={`min-w-[31%] flex-1 rounded-xl border p-3 ${
                    option.available && canProposeExtension
                      ? 'border-orange-500/30 bg-orange-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 opacity-60'
                  }`}
                >
                  <Text className="text-center text-[13px] text-[#fb923c]" weight="700">
                    +{option.extraMinutes} phút
                  </Text>
                  <Text className="mt-1 text-center text-[10px] text-slate-500">
                    {option.available ? `→ ${formatTime(option.newPlannedEnd)}` : 'Không khả dụng'}
                  </Text>
                  <Text className="mt-1 text-center text-[10px] text-slate-900 dark:text-white" weight="700">
                    {option.blockedReason || formatCurrency(option.additionalFee)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-[10px] leading-4 text-slate-500">
              {directExtension
                ? 'Đơn đăng ký tại quầy: nhân viên xác nhận gia hạn trực tiếp tại quầy.'
                : 'Đơn đặt trước: khách cần xác nhận yêu cầu gia hạn trên mobile.'}
            </Text>
          </View>
        )}
      </ToolCard>

      <ToolCard
        icon={<Coffee color="#f97316" size={18} />}
        title="Gọi thêm đồ ăn, thức uống"
        subtitle={loadingResources ? 'Đang tải menu...' : `${menuItems.length} món khả dụng`}
      >
        {loadingResources ? (
          <ActivityIndicator color="#f97316" />
        ) : menuItems.length === 0 ? (
          <EmptyInline text="Chi nhánh chưa có món khả dụng." />
        ) : (
          <View className="gap-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {menuItems.map((item) => {
                  const active = item.id === selectedMenuItemId;
                  const imageUrl = getMenuImage(item);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSelectedMenuItemId(item.id)}
                      className={`w-36 overflow-hidden rounded-xl border ${
                        active ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
                      }`}
                    >
                      <View className="h-20 bg-slate-100 dark:bg-[#0b0f19]">
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                        ) : (
                          <View className="h-full w-full items-center justify-center">
                            <Coffee color="#475569" size={22} />
                          </View>
                        )}
                      </View>
                      <View className="p-2">
                        <Text className="text-[11px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="mt-1 text-[10px] text-[#fb923c]" weight="700">
                          {formatCurrency(item.price)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={qtyText}
                onChangeText={(value) => setQtyText(value.replace(/[^\d]/g, ''))}
                keyboardType="number-pad"
                className="h-11 w-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-center text-[13px] text-slate-900 dark:text-white"
              />
              <Pressable
                disabled={submitting === 'fnb'}
                onPress={handleAddFnb}
                className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
                  submitting === 'fnb' ? 'opacity-70' : ''
                }`}
              >
                {submitting === 'fnb' ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Plus color="#ffffff" size={16} />
                )}
                <Text className="text-[12px] text-white" weight="700">
                  Thêm món
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ToolCard>

      {rentalVehicles.length ? (
        <ToolCard
          icon={<Repeat2 color="#f97316" size={18} />}
          title="Đổi xe trong phiên"
          subtitle={`${replacementVehicles.length} xe thay thế khả dụng`}
        >
          <View className="gap-3">
            <View>
              <Text className="mb-2 text-[10px] uppercase tracking-wider text-slate-500" weight="700">
                Xe đang chạy
              </Text>
              <View className="gap-2">
                {rentalVehicles.map((vehicle) => {
                  const active = selectedOldVehicleId === vehicle.vehicleId;
                  return (
                    <Pressable
                      key={vehicle.vehicleId}
                      onPress={() => setSelectedOldVehicleId(vehicle.vehicleId)}
                      className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                        active ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
                      }`}
                    >
                      <Car color={active ? '#fb923c' : '#64748b'} size={16} />
                      <View className="flex-1">
                        <Text className="text-[12px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
                          {vehicle.name}
                        </Text>
                        <Text className="mt-0.5 text-[10px] text-slate-500">ID {shortId(vehicle.vehicleId)}</Text>
                      </View>
                      {active ? <CheckCircle2 color="#fb923c" size={15} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[12px] text-slate-900 dark:text-white" weight="700">
                    Xe cũ cần bảo trì
                  </Text>
                  <Text className="mt-1 text-[10px] text-slate-500">
                    Tắt nếu xe cũ vẫn bình thường và trả lại kho trống.
                  </Text>
                </View>
                <Switch
                  value={oldVehicleStatus === 'MAINTENANCE'}
                  onValueChange={(value) => setOldVehicleStatus(value ? 'MAINTENANCE' : 'AVAILABLE')}
                  trackColor={{ false: '#1e293b', true: '#f97316' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            <View>
              <Text className="mb-2 text-[10px] uppercase tracking-wider text-slate-500" weight="700">
                Xe thay thế
              </Text>
              {loadingResources ? (
                <ActivityIndicator color="#f97316" />
              ) : replacementVehicles.length === 0 ? (
                <EmptyInline text="Không có xe khả dụng để thay thế." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {replacementVehicles.map((vehicle) => {
                      const active = selectedReplacementId === vehicle.id;
                      return (
                        <Pressable
                          key={vehicle.id}
                          onPress={() => setSelectedReplacementId(vehicle.id)}
                          className={`w-40 rounded-xl border p-3 ${
                            active ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
                          }`}
                        >
                          <Text className="text-[12px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
                            {getUnitName(vehicle)}
                          </Text>
                          <Text className="mt-1 text-[10px] text-slate-500" numberOfLines={1}>
                            {vehicle.identifier || shortId(vehicle.id)}
                            {vehicle.color ? ` • ${vehicle.color}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            <Pressable
              disabled={submitting === 'swap' || !selectedReplacementId}
              onPress={handleSwapVehicle}
              className={`h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
                submitting === 'swap' || !selectedReplacementId ? 'opacity-60' : ''
              }`}
            >
              {submitting === 'swap' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <RefreshCw color="#ffffff" size={15} />
              )}
              <Text className="text-[12px] text-white" weight="700">
                Xác nhận đổi xe
              </Text>
            </Pressable>
          </View>
        </ToolCard>
      ) : null}
    </View>
  );
}

function ToolCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            {icon}
          </View>
          <View>
            <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
              {title}
            </Text>
            <Text className="mt-1 text-[10px] text-slate-500">{subtitle}</Text>
          </View>
        </View>
        <AlertTriangle color="#334155" size={16} />
      </View>
      {children}
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
      <Text className="text-center text-[11px] text-slate-500">{text}</Text>
    </View>
  );
}
