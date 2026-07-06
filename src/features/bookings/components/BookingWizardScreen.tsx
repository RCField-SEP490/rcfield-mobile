import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/shared/ui/Text';
import { getCafes } from '@/features/explore/api/explore.api';
import type { Cafe } from '@/features/explore/types/explore.types';

import { StepperBar } from './StepperBar';
import { TrackSelectionStep } from './TrackSelectionStep';
import { ParticipantsStep } from './ParticipantsStep';
import { FnbStep } from './FnbStep';
import { PaymentStep } from './PaymentStep';
import { bookingWizardApi, type TrackConfig, type VehicleCatalog, type MenuItem, type PromoValidationResult, type Companion } from '../api/booking-wizard.api';

interface BookingWizardScreenProps {
  cafeId: string;
  preselectedVehicleId?: string;
}

export function BookingWizardScreen({ cafeId, preselectedVehicleId }: BookingWizardScreenProps) {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [loadingCafe, setLoadingCafe] = useState(true);

  // Form states
  const [selectedTrackConfig, setSelectedTrackConfig] = useState<TrackConfig | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [playMode, setPlayMode] = useState<'RENTAL' | 'BYOC'>('RENTAL');
  const [participants, setParticipants] = useState<number>(1);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [fnbQuantities, setFnbQuantities] = useState<Record<string, number>>({});
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);

  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [mockSubmitting, setMockSubmitting] = useState(false);

  // Data details lists (for calculation & labels)
  const [catalogs, setCatalogs] = useState<VehicleCatalog[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // 1. Fetch Cafe Details & catalogs/menus
  useEffect(() => {
    const fetchCafeData = async () => {
      setLoadingCafe(true);
      try {
        const cafes = await getCafes();
        const found = cafes.find((c) => c.id === cafeId);
        if (found) {
          setCafe(found);
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin cơ sở này!');
          router.back();
        }

        // Preload vehicle catalogs & menu items for breakdown calculations
        const [vehiclesData, menuData] = await Promise.all([
          bookingWizardApi.getCafeCatalogs(cafeId),
          bookingWizardApi.getCafeMenu(cafeId),
        ]);
        setCatalogs(vehiclesData);
        setMenuItems(menuData);

        // Preselect vehicle if provided
        if (preselectedVehicleId && vehiclesData.some(v => v.id === preselectedVehicleId)) {
          setSelectedVehicleIds([preselectedVehicleId]);
        }
      } catch (err) {
        console.error('[BookingWizardScreen] Error loading cafe data:', err);
      } finally {
        setLoadingCafe(false);
      }
    };

    fetchCafeData();
  }, [cafeId, preselectedVehicleId, router]);

  // Reset vehicles if switched to BYOC
  useEffect(() => {
    if (playMode === 'BYOC') {
      setSelectedVehicleIds([]);
    }
  }, [playMode]);

  // 2. Calculations
  const sortedSlots = useMemo(() => {
    return [...selectedSlots].sort((a, b) => {
      const [ha, ma] = a.split(':').map(Number);
      const [hb, mb] = b.split(':').map(Number);
      return (ha * 60 + ma) - (hb * 60 + mb);
    });
  }, [selectedSlots]);

  const durationHours = sortedSlots.length || 1;
  const slotFeeRate = cafe?.slotFeeRate || 0;

  // Rental vehicle prices calculation
  const vehiclePriceTotal = useMemo(() => {
    return selectedVehicleIds.reduce((sum, id) => {
      const match = catalogs.find((c) => c.id === id);
      const rate = match ? Number(match.price_per_hour) : 0;
      return sum + rate * durationHours;
    }, 0);
  }, [selectedVehicleIds, catalogs, durationHours]);

  // Fnb preorder price total
  const fnbPriceTotal = useMemo(() => {
    return Object.entries(fnbQuantities).reduce((sum, [id, qty]) => {
      const match = menuItems.find((m) => m.id === id);
      const rate = match ? Number(match.price) : 0;
      return sum + rate * qty;
    }, 0);
  }, [fnbQuantities, menuItems]);

  const fnbDetailsList = useMemo(() => {
    return Object.entries(fnbQuantities)
      .map(([id, qty]) => {
        const match = menuItems.find((m) => m.id === id);
        return {
          name: match ? match.name : 'Món F&B',
          qty,
          price: match ? Number(match.price) : 0,
        };
      })
      .filter((m) => m.qty > 0);
  }, [fnbQuantities, menuItems]);

  // Final Total calculation for Step 4 Preview (also used for next step button label)
  const finalTotalAmount = useMemo(() => {
    const baseSlotFee = slotFeeRate * participants * durationHours;
    const slotFeeDiscount = selectedPackageId !== null ? slotFeeRate * durationHours : 0;
    const finalSlotFee = Math.max(0, baseSlotFee - slotFeeDiscount);
    const securityDeposit = playMode === 'RENTAL' ? selectedVehicleIds.length * 50000 : 0;

    const subtotal = finalSlotFee + vehiclePriceTotal + fnbPriceTotal;
    let promoDiscount = 0;
    if (appliedPromo) {
      if (appliedPromo.discount_type === 'PERCENTAGE') {
        promoDiscount = Math.round((subtotal * appliedPromo.value) / 100);
      } else {
        promoDiscount = appliedPromo.value;
      }
      promoDiscount = Math.min(subtotal, promoDiscount);
    }

    return Math.max(0, subtotal + securityDeposit - promoDiscount);
  }, [slotFeeRate, participants, durationHours, selectedPackageId, playMode, selectedVehicleIds.length, vehiclePriceTotal, fnbPriceTotal, appliedPromo]);

  // 3. Navigation Controls
  const slotStartIso = useMemo(() => {
    if (sortedSlots.length === 0) return '';
    return `${selectedDate}T${sortedSlots[0]}:00+07:00`;
  }, [selectedDate, sortedSlots]);

  const slotEndIso = useMemo(() => {
    if (sortedSlots.length === 0) return '';
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const [lastH, lastM] = lastSlot.split(':').map(Number);
    const endH = String(lastH + 1).padStart(2, '0');
    const endM = String(lastM || 0).padStart(2, '0');
    return `${selectedDate}T${endH}:${endM}:00+07:00`;
  }, [selectedDate, sortedSlots]);

  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !selectedTrackConfig || selectedSlots.length === 0;
    }
    if (currentStep === 2) {
      // Validation rules
      const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;
      const companionPhoneInvalid = companions.some(
        (c) => c.phone.trim() !== '' && !phoneRegex.test(c.phone)
      );
      const companionNameEmpty = companions.some((c) => c.name.trim() === '');
      
      if (companionNameEmpty || companionPhoneInvalid) return true;

      if (playMode === 'RENTAL') {
        return selectedVehicleIds.length < participants;
      }
      return false; // For BYOC capacity error, screen will show warnings but we check before going next
    }
    return false;
  }, [currentStep, selectedTrackConfig, selectedSlots.length, playMode, selectedVehicleIds.length, participants, companions]);

  const handleNext = () => {
    if (currentStep === 4) return;
    
    // Step 1 Validation: Ensure sequential selected slots
    if (currentStep === 1) {
      let isSequential = true;
      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const [h1] = sortedSlots[i].split(':').map(Number);
        const [h2] = sortedSlots[i + 1].split(':').map(Number);
        if (h2 - h1 !== 1) {
          isSequential = false;
          break;
        }
      }
      if (!isSequential) {
        Alert.alert('Khung giờ không hợp lệ', 'Các khung giờ được chọn phải liên tiếp nhau!');
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  // 4. Booking submission
  const getBookingPayload = () => {
    return {
      cafe_id: cafeId,
      play_mode: playMode,
      slot_start: slotStartIso,
      slot_end: slotEndIso,
      vehicle_ids: playMode === 'RENTAL' ? selectedVehicleIds : [],
      participants: companions.map((c) => ({
        participant_type: 'WALK_IN_GUEST' as const,
        guest_name: c.name.trim(),
        guest_phone: c.phone.trim(),
      })),
      fnb_items: Object.entries(fnbQuantities).map(([menu_item_id, quantity]) => ({
        menu_item_id,
        quantity,
      })),
      track_type_id: selectedTrackConfig?.track_type_id,
      track_config_id: selectedTrackConfig?.id,
      customer_package_id: selectedPackageId || undefined,
      promotion_code: appliedPromo?.code || undefined,
    };
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      const payload = getBookingPayload();
      const booking = await bookingWizardApi.createBooking(payload);

      // Create VNPay checkout url
      const checkout = await bookingWizardApi.createCheckout(booking.booking_id);
      
      if (checkout.confirmed) {
        Alert.alert('Thành công', 'Đặt lịch thành công! Slot đã được thanh toán thông qua Gói hội viên.', [
          { text: 'Đóng', onPress: () => router.push('/(tabs)/bookings') },
        ]);
        return;
      }

      if (checkout.payment_url) {
        // Open VNPay checkout URL in external browser
        await Linking.openURL(checkout.payment_url);
        
        // Wait and redirect user to bookings page
        Alert.alert('Thanh toán', 'Đang chuyển hướng sang cổng thanh toán VNPay. Hãy kiểm tra trạng thái trong mục Lịch đặt.', [
          { text: 'Đóng', onPress: () => router.push('/(tabs)/bookings') },
        ]);
      } else {
        throw new Error('Không nhận được URL thanh toán từ cổng VNPay!');
      }
    } catch (err: any) {
      console.error('[BookingWizard] Submit payment error:', err);
      const msg = err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại!';
      Alert.alert('Lỗi đặt lịch', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockPayment = async () => {
    setMockSubmitting(true);
    try {
      const payload = getBookingPayload();
      const booking = await bookingWizardApi.createBooking(payload);
      
      // Perform mock checkout
      await bookingWizardApi.mockCheckout(booking.booking_id);
      
      Alert.alert('Thành công', 'Mock thanh toán thành công! Lịch đặt đã được xác nhận.', [
        { text: 'Xem lịch đặt', onPress: () => router.push('/(tabs)/bookings') },
      ]);
    } catch (err: any) {
      console.error('[BookingWizard] Mock payment error:', err);
      const msg = err?.response?.data?.message || 'Mock thanh toán thất bại!';
      Alert.alert('Lỗi thanh toán', msg);
    } finally {
      setMockSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Header Back Button */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-900 bg-[#0f172a]/50">
        <Pressable onPress={handleBack} className="p-1 rounded-full active:bg-slate-800 flex-row items-center gap-1">
          <ChevronLeft color="#f97316" size={20} />
          <Text className="text-[12px] text-[#f97316] font-bold">
            Quay lại
          </Text>
        </Pressable>
        {cafe && (
          <Text className="text-[13px] text-white flex-1 text-center font-bold mr-10" numberOfLines={1}>
            Đặt sân {cafe.name}
          </Text>
        )}
      </View>

      {loadingCafe ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <View className="flex-1">
          <ScrollView
            contentContainerClassName="px-5 py-5 pb-24"
            showsVerticalScrollIndicator={false}
          >
            {/* Stepper progress */}
            <StepperBar currentStep={currentStep} />

            {/* Steps Container */}
            {currentStep === 1 && (
              <TrackSelectionStep
                cafeId={cafeId}
                selectedTrackConfig={selectedTrackConfig}
                setSelectedTrackConfig={setSelectedTrackConfig}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedSlots={selectedSlots}
                setSelectedSlots={setSelectedSlots}
                playMode={playMode}
                setPlayMode={setPlayMode}
              />
            )}

            {currentStep === 2 && (
              <ParticipantsStep
                cafeId={cafeId}
                playMode={playMode}
                participants={participants}
                setParticipants={setParticipants}
                companions={companions}
                setCompanions={setCompanions}
                selectedVehicleIds={selectedVehicleIds}
                setSelectedVehicleIds={setSelectedVehicleIds}
                slotStart={slotStartIso}
                slotEnd={slotEndIso}
                trackConfigId={selectedTrackConfig?.id}
              />
            )}

            {currentStep === 3 && (
              <FnbStep
                cafeId={cafeId}
                fnbQuantities={fnbQuantities}
                setFnbQuantities={setFnbQuantities}
              />
            )}

            {currentStep === 4 && (
              <PaymentStep
                cafeId={cafeId}
                playMode={playMode}
                slotStart={slotStartIso}
                slotFeeRate={slotFeeRate}
                participants={participants}
                selectedVehicleIds={selectedVehicleIds}
                vehiclePriceTotal={vehiclePriceTotal}
                fnbPriceTotal={fnbPriceTotal}
                fnbDetailsList={fnbDetailsList}
                selectedPackageId={selectedPackageId}
                setSelectedPackageId={setSelectedPackageId}
                appliedPromo={appliedPromo}
                setAppliedPromo={setAppliedPromo}
                onMockPayment={handleMockPayment}
                isMockSubmitting={mockSubmitting}
              />
            )}
          </ScrollView>

          {/* Action Bottom Bar */}
          <View className="absolute bottom-0 left-0 right-0 border-t border-slate-900 bg-[#0f172a]/95 px-5 py-3.5 flex-row justify-between items-center shadow-lg">
            <View>
              <Text className="text-[10px] text-slate-400 font-semibold">Tạm tính</Text>
              <Text className="text-[16px] text-[#f97316]" weight="700">
                {finalTotalAmount.toLocaleString('vi-VN')}đ
              </Text>
            </View>

            {currentStep === 4 ? (
              <Pressable
                disabled={submitting}
                onPress={handleConfirmPayment}
                className="flex-row items-center justify-center bg-[#ea580c] py-2.5 px-6 rounded-xl active:bg-[#f97316] gap-1"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text className="text-[12px] text-white font-bold">
                      Thanh toán VNPay
                    </Text>
                    <ChevronRight color="#ffffff" size={14} strokeWidth={2.5} />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                disabled={isNextDisabled}
                onPress={handleNext}
                className={`flex-row items-center justify-center py-2.5 px-6 rounded-xl gap-1 ${
                  isNextDisabled ? 'bg-slate-800 opacity-50' : 'bg-[#ea580c] active:bg-[#f97316]'
                }`}
              >
                <Text className="text-[12px] text-white font-bold">
                  Tiếp theo
                </Text>
                <ChevronRight color="#ffffff" size={14} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
