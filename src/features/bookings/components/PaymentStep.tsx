import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { Ticket, CreditCard, Package, Info, CheckCircle2, MapPin, Layers } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { getMyPackages, type MyPackageResponse } from '@/features/packages/api/package.api';
import { bookingWizardApi, type PromoValidationResult, type VehicleCatalog } from '../api/booking-wizard.api';

interface PaymentStepProps {
  cafeId: string;
  playMode: 'RENTAL' | 'BYOC';
  slotStart: string;
  slotEnd: string;
  durationHours: number;
  slotFeeRate: number;
  participants: number;
  selectedVehicleIds: string[];
  vehiclePriceTotal: number;
  fnbPriceTotal: number;
  fnbDetailsList: { name: string; qty: number; price: number }[];
  selectedPackageId: string | null;
  setSelectedPackageId: (id: string | null) => void;
  appliedPromo: PromoValidationResult | null;
  setAppliedPromo: (promo: PromoValidationResult | null) => void;
  onMockPayment: () => void;
  isMockSubmitting: boolean;

  // Add detail props to mirror web summary
  cafeName: string;
  cafeAddress: string;
  cafeImage: string | null;
  trackConfigName: string;
  vehicleCatalogs: VehicleCatalog[];
  slotDurationMinutes?: number;
}

export function PaymentStep({
  cafeId,
  playMode,
  slotStart,
  slotEnd,
  durationHours,
  slotFeeRate,
  participants,
  selectedVehicleIds,
  vehiclePriceTotal,
  fnbPriceTotal,
  fnbDetailsList,
  selectedPackageId,
  setSelectedPackageId,
  appliedPromo,
  setAppliedPromo,
  onMockPayment,
  isMockSubmitting,
  cafeName,
  cafeAddress,
  cafeImage,
  trackConfigName,
  vehicleCatalogs,
  slotDurationMinutes,
}: PaymentStepProps) {
  const [packages, setPackages] = useState<MyPackageResponse[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');

  // 1. Fetch active packages compatible with cafe and playMode
  useEffect(() => {
    const fetchPackages = async () => {
      setLoadingPackages(true);
      const data = await getMyPackages('ACTIVE');
      // Filter packages for this cafe and playMode
      const filtered = data.filter(
        (pkg) =>
          pkg.cafe_id === cafeId &&
          pkg.slots_remaining > 0 &&
          pkg.applicable_play_modes.includes(playMode)
      );
      setPackages(filtered);
      setLoadingPackages(false);
    };
    fetchPackages();
  }, [cafeId, playMode]);

  // 2. Validate Promo Code
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const res = await bookingWizardApi.validatePromoCode(
        promoCodeInput,
        cafeId,
        slotStart
      );
      setAppliedPromo(res);
      setPromoCodeInput('');
      Alert.alert('Thành công', `Đã áp dụng mã giảm giá thành công!`);
    } catch (err: any) {
      console.error('[PaymentStep] Error validating promo:', err);
      const msg = err?.response?.data?.message || 'Mã giảm giá không hợp lệ!';
      setPromoError(msg);
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  // 3. Billing Calculations
  // Base Slot Fee = slotFeeRate * participants * durationHours
  const baseSlotFee = slotFeeRate * participants * durationHours;
  
  // If package is applied, user gets 1 slot free (their own slot) for the booking duration
  const isPackageApplied = selectedPackageId !== null;
  const slotFeeDiscount = isPackageApplied ? slotFeeRate * durationHours : 0;
  const finalSlotFee = Math.max(0, baseSlotFee - slotFeeDiscount);

  // Promo Discount
  let promoDiscount = 0;
  const subtotalBeforePromo = finalSlotFee + vehiclePriceTotal + fnbPriceTotal;
  if (appliedPromo) {
    if (appliedPromo.discount_type === 'PERCENTAGE') {
      promoDiscount = Math.round((subtotalBeforePromo * appliedPromo.value) / 100);
    } else {
      promoDiscount = appliedPromo.value;
    }
    // Limit discount to subtotal
    promoDiscount = Math.min(subtotalBeforePromo, promoDiscount);
  }

  const totalAmount = Math.max(0, subtotalBeforePromo - promoDiscount);

  // Formatting utils
  const formattedDate = React.useMemo(() => {
    if (!slotStart) return '';
    const [datePart] = slotStart.split('T');
    const [y, m, d] = datePart.split('-');
    return `${Number(d)}/${Number(m)}/${y}`;
  }, [slotStart]);

  const formattedTimeRange = React.useMemo(() => {
    if (!slotStart || !slotEnd) return '';
    const startT = slotStart.split('T')[1].substring(0, 5);
    const endT = slotEnd.split('T')[1].substring(0, 5);
    return `${startT} - ${endT}`;
  }, [slotStart, slotEnd]);

  const selectedVehicleNames = React.useMemo(() => {
    return selectedVehicleIds
      .map(id => vehicleCatalogs.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'Không có';
  }, [selectedVehicleIds, vehicleCatalogs]);

  return (
    <View className="space-y-6">
      {/* 1. Tóm tắt đơn đặt (Giống y hệt giao diện trên Web) */}
      <View className="bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-3.5">
          Tóm tắt đơn đặt
        </Text>
        <Text className="text-[10px] text-slate-500 dark:text-slate-450 font-semibold mb-4">
          Giá sẽ được chốt tại thời điểm thanh toán.
        </Text>

        {/* Cafe Info block */}
        <View className="flex-row gap-3.5 items-center mb-4">
          {cafeImage ? (
            <Image
              source={{ uri: cafeImage }}
              className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-900 object-cover"
            />
          ) : (
            <View className="h-12 w-12 rounded-xl bg-[#ea580c]/10 border border-[#ea580c]/20 items-center justify-center">
              <MapPin color="#f97316" size={20} />
            </View>
          )}
          <View className="flex-1 pr-1">
            <Text className="text-[14px] text-slate-900 dark:text-white" weight="700">
              {cafeName}
            </Text>
            <Text className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1" numberOfLines={1}>
              {cafeAddress}
            </Text>
          </View>
        </View>

        {/* Track Config Badge */}
        <View className="flex-row mb-4">
          <View className="bg-[#ea580c]/10 border border-[#ea580c]/20 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5">
            <Layers color="#f97316" size={13} />
            <Text className="text-[12px] text-[#f97316]" weight="700">
              {trackConfigName}
            </Text>
          </View>
        </View>

        {/* Details Table */}
        <View className="space-y-2.5">
          <View className="flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Loại đặt lịch</Text>
            <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
              {isPackageApplied ? 'Hội viên' : 'Đơn lẻ'}
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Hình thức</Text>
            <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
              {playMode === 'RENTAL' ? 'Thuê xe' : 'Xe cá nhân'}
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Ngày</Text>
            <Text className="text-[12px] text-slate-900 dark:text-white font-bold">{formattedDate}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Giờ</Text>
            <Text className="text-[12px] text-slate-900 dark:text-white font-bold">{formattedTimeRange}</Text>
          </View>
          
          {playMode === 'RENTAL' && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Xe thuê</Text>
              <Text className="text-[12px] text-slate-900 dark:text-white font-bold" numberOfLines={1}>
                {selectedVehicleNames}
              </Text>
            </View>
          )}

          {fnbPriceTotal > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">Đặt trước F&B</Text>
              <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
                {fnbPriceTotal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 2. Gói slot hội viên */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Package color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            Áp dụng gói slot hội viên
          </Text>
        </View>

        {loadingPackages ? (
          <ActivityIndicator size="small" color="#f97316" className="py-2" />
        ) : packages.length > 0 ? (
          <View className="gap-2.5">
            {packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              return (
                <Pressable
                  key={pkg.id}
                  onPress={() => setSelectedPackageId(isSelected ? null : pkg.id)}
                  className={`p-3 rounded-xl border flex-row gap-3 items-center justify-between transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#ea580c]/10 border-[#f97316]'
                      : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                      {pkg.package_name}
                    </Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
                      Còn {pkg.slots_remaining} / {pkg.slots_total} slots • Hạn: {new Date(pkg.expires_at).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                  <View
                    className={`h-5 w-5 rounded-full border items-center justify-center ${
                      isSelected ? 'bg-[#f97316] border-[#f97316]' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    {isSelected && <CheckCircle2 color="#ffffff" size={12} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
            {isPackageApplied && (
              <View className="flex-row items-start gap-2 bg-[#ea580c]/10 border border-[#ea580c]/20 rounded-xl p-3 mt-1">
                <Info color="#f97316" size={14} className="mt-0.5" />
                <Text className="text-[10px] text-slate-800 dark:text-slate-300 leading-4 font-semibold flex-1">
                  Đã áp dụng gói: Miễn phí tiền sân cho bản thân trong suốt {(durationHours * (slotDurationMinutes || 60)) / 60} giờ chơi. Người đi cùng (nếu có) vẫn tính phí bình thường.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-slate-100 dark:bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-200 dark:border-slate-800 items-center justify-center">
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              Bạn không có gói hội viên nào phù hợp tại cơ sở này.
            </Text>
          </View>
        )}
      </View>

      {/* 3. Mã ưu đãi */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Ticket color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            Nhập mã ưu đãi (Voucher)
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TextInput
            value={promoCodeInput}
            onChangeText={setPromoCodeInput}
            placeholder={appliedPromo ? `Đang áp dụng: ${appliedPromo.code}` : "Nhập mã voucher"}
            placeholderTextColor="#94a3b8"
            className="flex-1 h-10 px-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[12px] rounded-lg"
          />
          <Pressable
            disabled={validatingPromo}
            onPress={handleApplyPromo}
            className="h-10 bg-[#ea580c] px-4 rounded-lg items-center justify-center active:bg-[#f97316]"
          >
            {validatingPromo ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-[11px] text-white" weight="700">
                Áp dụng
              </Text>
            )}
          </Pressable>
        </View>

        {promoError !== '' && (
          <Text className="text-[9px] text-[#ef4444] font-semibold mt-1.5">{promoError}</Text>
        )}

        {appliedPromo && (
          <View className="flex-row items-center justify-between bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3 mt-3">
            <View>
              <Text className="text-[12px] text-emerald-600 dark:text-emerald-400 font-bold">
                Voucher: {appliedPromo.code}
              </Text>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
                Được giảm -{promoDiscount.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <Pressable
              onPress={() => setAppliedPromo(null)}
              className="px-2 py-1 rounded border border-emerald-350 dark:border-emerald-900/60"
            >
              <Text className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Gỡ bỏ</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 4. Phân tích hoá đơn chi tiết */}
      <View className="mt-5 bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <Text className="text-[13px] text-slate-900 dark:text-white mb-3.5" weight="700">
          Chi tiết hoá đơn
        </Text>

        <View className="space-y-2.5">
          {/* Tiền sân */}
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-2">
              <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold">
                Phí lịch chơi ({participants} người x {durationHours}h)
              </Text>
              {isPackageApplied && (
                <Text className="text-[9.5px] text-[#f97316] font-semibold">
                  (Đã áp dụng gói hội viên)
                </Text>
              )}
            </View>
            <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
              {finalSlotFee.toLocaleString('vi-VN')}đ
            </Text>
          </View>

          {/* Tiền thuê xe */}
          {playMode === 'RENTAL' && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold">
                Phí thuê {selectedVehicleNames}
              </Text>
              <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
                {vehiclePriceTotal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Tiền F&B đặt trước */}
          {fnbPriceTotal > 0 && (
            <View className="space-y-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold">F&B preorder</Text>
                <Text className="text-[12px] text-slate-900 dark:text-white font-bold">
                  {fnbPriceTotal.toLocaleString('vi-VN')}đ
                </Text>
              </View>
              {fnbDetailsList.map((m, idx) => (
                <View key={idx} className="flex-row justify-between items-center pl-3">
                  <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    • {m.name} (x{m.qty})
                  </Text>
                  <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    {(m.qty * m.price).toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Giảm giá voucher */}
          {promoDiscount > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">Khuyến mãi (Voucher)</Text>
              <Text className="text-[12px] text-emerald-600 dark:text-emerald-400 font-bold">
                -{promoDiscount.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Divider */}
          <View className="h-[1px] bg-slate-200 dark:bg-slate-800 my-2" />

          {/* Tổng cộng */}
          <View className="flex-row justify-between items-center font-bold">
            <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">Tổng thanh toán</Text>
            <Text className="text-[16px] text-[#f97316]" weight="700">
              {totalAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Chọn phương thức & Nút giả lập */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <CreditCard color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            Phương thức thanh toán
          </Text>
        </View>

        <View className="bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex-row justify-between items-center shadow-sm">
          <View className="flex-row gap-3 items-center">
            <View className="h-8 w-8 items-center justify-center rounded bg-emerald-600/10 border border-emerald-500/20">
              <CreditCard color="#10b981" size={16} />
            </View>
            <View>
              <Text className="text-[13px] text-slate-800 dark:text-slate-200" weight="700">
                Cổng thanh toán VNPay
              </Text>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
                Thanh toán online bằng QR hoặc ATM/Visa
              </Text>
            </View>
          </View>
        </View>

        {/* Mock Payment button for Dev */}
        <Pressable
          disabled={isMockSubmitting}
          onPress={onMockPayment}
          className="mt-4 border border-dashed border-[#ea580c]/40 bg-orange-50 dark:bg-[#ea580c]/5 py-3 rounded-xl items-center justify-center active:bg-orange-100 dark:active:bg-[#ea580c]/10"
        >
          {isMockSubmitting ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <Text className="text-[11px] text-[#f97316] font-bold">
              [DEV] Giả lập thanh toán nhanh (Không qua VNPay)
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
