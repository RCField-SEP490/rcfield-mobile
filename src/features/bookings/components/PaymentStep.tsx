import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ticket, CreditCard, Package, Info, CheckCircle2 } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';
import { getMyPackages, type MyPackageResponse } from '@/features/packages/api/package.api';
import { bookingWizardApi, type PromoValidationResult } from '../api/booking-wizard.api';

interface PaymentStepProps {
  cafeId: string;
  playMode: 'RENTAL' | 'BYOC';
  slotStart: string;
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
}

export function PaymentStep({
  cafeId,
  playMode,
  slotStart,
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
  // Base Slot Fee = slotFeeRate * participants
  const baseSlotFee = slotFeeRate * participants;
  
  // If package is applied, user gets 1 slot free (their own slot)
  const isPackageApplied = selectedPackageId !== null;
  const slotFeeDiscount = isPackageApplied ? slotFeeRate : 0;
  const finalSlotFee = Math.max(0, baseSlotFee - slotFeeDiscount);

  // Security Deposit: e.g. 50.000đ per rental vehicle
  const securityDeposit = playMode === 'RENTAL' ? selectedVehicleIds.length * 50000 : 0;

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

  const totalAmount = Math.max(0, subtotalBeforePromo + securityDeposit - promoDiscount);

  return (
    <View className="space-y-6">
      {/* 1. Gói slot hội viên */}
      <View>
        <View className="flex-row items-center gap-1.5 mb-3">
          <Package color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            1. Áp dụng gói slot hội viên
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
                      : 'bg-[#0f172a]/50 border-slate-800'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[13px] text-white" weight="700">
                      {pkg.package_name}
                    </Text>
                    <Text className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                      Còn {pkg.slots_remaining} / {pkg.slots_total} slots • Hạn: {new Date(pkg.expires_at).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                  <View
                    className={`h-5 w-5 rounded-full border items-center justify-center ${
                      isSelected ? 'bg-[#f97316] border-[#f97316]' : 'border-slate-700 bg-slate-900'
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
                <Text className="text-[10px] text-slate-300 leading-4 font-semibold flex-1">
                  Đã áp dụng gói: Miễn phí tiền sân cho bản thân (1 slot). Người đi cùng (nếu có) vẫn tính phí bình thường.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-800 items-center justify-center">
            <Text className="text-[11px] text-slate-400 font-semibold">
              Bạn không có gói hội viên nào phù hợp tại cơ sở này.
            </Text>
          </View>
        )}
      </View>

      {/* 2. Mã ưu đãi */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Ticket color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            2. Nhập mã ưu đãi (Voucher)
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TextInput
            value={promoCodeInput}
            onChangeText={setPromoCodeInput}
            placeholder={appliedPromo ? `Đang áp dụng: ${appliedPromo.code}` : "Nhập mã voucher"}
            placeholderTextColor="#475569"
            className="flex-1 h-10 px-3 bg-[#0b0f19] border border-slate-800 text-white text-[12px] rounded-lg"
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
          <View className="flex-row items-center justify-between bg-emerald-950/15 border border-emerald-900/40 rounded-xl p-3 mt-3">
            <View>
              <Text className="text-[12px] text-emerald-400 font-bold">
                Voucher: {appliedPromo.code}
              </Text>
              <Text className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                Được giảm -{promoDiscount.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <Pressable
              onPress={() => setAppliedPromo(null)}
              className="px-2 py-1 rounded border border-emerald-900/60"
            >
              <Text className="text-[9px] text-emerald-400 font-semibold">Gỡ bỏ</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 3. Phân tích hoá đơn */}
      <View className="mt-5 bg-[#0f172a]/50 border border-slate-800 rounded-2xl p-4">
        <Text className="text-[13px] text-white mb-3.5" weight="700">
          Chi tiết hoá đơn
        </Text>

        <View className="space-y-2.5">
          {/* Tiền sân */}
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-[12px] text-slate-300 font-semibold">Tiền sân ({participants} người)</Text>
              {isPackageApplied && (
                <Text className="text-[9.5px] text-[#f97316] font-semibold">
                  (Đã giảm 1 slot từ gói hội viên)
                </Text>
              )}
            </View>
            <Text className="text-[12px] text-slate-200 font-bold">
              {finalSlotFee.toLocaleString('vi-VN')}đ
            </Text>
          </View>

          {/* Tiền thuê xe */}
          {playMode === 'RENTAL' && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-slate-300 font-semibold">
                Phí thuê xe ({selectedVehicleIds.length} xe)
              </Text>
              <Text className="text-[12px] text-slate-200 font-bold">
                {vehiclePriceTotal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Tiền cọc xe */}
          {securityDeposit > 0 && (
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-[12px] text-slate-300 font-semibold">Tiền cọc giữ xe (Sẽ hoàn lại)</Text>
                <Text className="text-[9.5px] text-slate-400 font-semibold">
                  (50k/xe, hoàn sau check-out)
                </Text>
              </View>
              <Text className="text-[12px] text-slate-200 font-bold">
                +{securityDeposit.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Tiền F&B đặt trước */}
          {fnbPriceTotal > 0 && (
            <View className="space-y-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-[12px] text-slate-300 font-semibold">Dịch vụ ăn uống đặt trước</Text>
                <Text className="text-[12px] text-slate-200 font-bold">
                  {fnbPriceTotal.toLocaleString('vi-VN')}đ
                </Text>
              </View>
              {fnbDetailsList.map((m, idx) => (
                <View key={idx} className="flex-row justify-between items-center pl-3">
                  <Text className="text-[10px] text-slate-400 font-semibold">
                    • {m.name} (x{m.qty})
                  </Text>
                  <Text className="text-[10px] text-slate-400 font-semibold">
                    {(m.qty * m.price).toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Giảm giá voucher */}
          {promoDiscount > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] text-emerald-400 font-semibold">Khuyến mãi (Voucher)</Text>
              <Text className="text-[12px] text-emerald-400 font-bold">
                -{promoDiscount.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          )}

          {/* Divider */}
          <View className="h-[1px] bg-slate-800 my-2" />

          {/* Tổng cộng */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[13px] text-white" weight="700">Tổng tiền thanh toán</Text>
            <Text className="text-[16px] text-[#f97316]" weight="700">
              {totalAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Chọn phương thức & Nút giả lập */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <CreditCard color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            3. Phương thức thanh toán
          </Text>
        </View>

        <View className="bg-[#0f172a]/50 border border-slate-800 rounded-xl p-4 flex-row justify-between items-center">
          <View className="flex-row gap-3 items-center">
            <View className="h-8 w-8 items-center justify-center rounded bg-emerald-600/10 border border-emerald-500/20">
              <CreditCard color="#10b981" size={16} />
            </View>
            <View>
              <Text className="text-[13px] text-slate-200" weight="700">
                Cổng thanh toán VNPay
              </Text>
              <Text className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                Thanh toán online bằng QR hoặc ATM/Visa
              </Text>
            </View>
          </View>
        </View>

        {/* Mock Payment button for Dev */}
        <Pressable
          disabled={isMockSubmitting}
          onPress={onMockPayment}
          className="mt-4 border border-dashed border-[#ea580c]/40 bg-[#ea580c]/5 py-3 rounded-xl items-center justify-center active:bg-[#ea580c]/10"
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
