import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Image, ActivityIndicator } from 'react-native';
import { User, Plus, Minus, AlertTriangle, Car, Smartphone } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type Companion, type RentalVehicleUnit } from '../api/booking-wizard.api';

interface ParticipantsStepProps {
  cafeId: string;
  playMode: 'RENTAL' | 'BYOC';
  participants: number;
  setParticipants: (num: number) => void;
  companions: Companion[];
  setCompanions: (list: Companion[]) => void;
  selectedVehicleIds: string[];
  setSelectedVehicleIds: React.Dispatch<React.SetStateAction<string[]>>;
  slotStart: string;
  slotEnd: string;
  trackConfigId?: string;
  vehicleUnits: RentalVehicleUnit[];
}

export function ParticipantsStep({
  cafeId,
  playMode,
  participants,
  setParticipants,
  companions,
  setCompanions,
  selectedVehicleIds,
  setSelectedVehicleIds,
  slotStart,
  slotEnd,
  trackConfigId,
  vehicleUnits,
}: ParticipantsStepProps) {
  const { colorScheme } = useColorScheme();
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [availableVehicleIds, setAvailableVehicleIds] = useState<string[]>([]);
  const [byocRemaining, setByocRemaining] = useState<number | null>(null);
  const [checkingByoc, setCheckingByoc] = useState(false);

  // 1. Resolve actual vehicle units that remain available for the whole selected range.
  useEffect(() => {
    if (playMode !== 'RENTAL' || !slotStart || !slotEnd) return;
    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      try {
        const result = await bookingWizardApi.checkAvailability(cafeId, {
          slot_start: slotStart,
          slot_end: slotEnd,
          play_mode: 'RENTAL',
          track_config_id: trackConfigId,
        });
        const ids = result.vehicles?.map((vehicle) => vehicle.vehicle_id) ?? [];
        setAvailableVehicleIds(ids);
        setSelectedVehicleIds((current) => current.filter((id) => ids.includes(id)));
      } catch (error) {
        console.error('[ParticipantsStep] Error checking rental availability:', error);
        setAvailableVehicleIds([]);
      } finally {
        setLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, [cafeId, playMode, slotStart, slotEnd, trackConfigId, setSelectedVehicleIds]);

  // 2. Check BYOC remaining spots (only if BYOC)
  useEffect(() => {
    if (playMode !== 'BYOC' || !slotStart || !slotEnd) return;
    const checkByocCapacity = async () => {
      setCheckingByoc(true);
      try {
        const res = await bookingWizardApi.checkAvailability(cafeId, {
          slot_start: slotStart,
          slot_end: slotEnd,
          play_mode: 'BYOC',
          track_config_id: trackConfigId,
        });
        setByocRemaining(res.byoc_remaining ?? 0);
      } catch (err) {
        console.error('[ParticipantsStep] Error checking BYOC:', err);
        setByocRemaining(0);
      } finally {
        setCheckingByoc(false);
      }
    };
    checkByocCapacity();
  }, [cafeId, playMode, slotStart, slotEnd, trackConfigId]);

  // 3. Handle change of participants count
  const handleIncrease = () => {
    const newVal = participants + 1;
    setParticipants(newVal);
    // Add an empty companion
    setCompanions([...companions, { name: '', phone: '' }]);
  };

  const handleDecrease = () => {
    if (participants <= 1) return;
    const newVal = participants - 1;
    setParticipants(newVal);
    // Remove the last companion
    setCompanions(companions.slice(0, -1));
  };

  // 4. Update companion details
  const updateCompanion = (index: number, key: keyof Companion, value: string) => {
    const updated = [...companions];
    updated[index] = { ...updated[index], [key]: value };
    setCompanions(updated);
  };

  // 5. Select/deselect vehicle
  const toggleVehicle = (vehicleId: string) => {
    if (selectedVehicleIds.includes(vehicleId)) {
      setSelectedVehicleIds(selectedVehicleIds.filter((id) => id !== vehicleId));
    } else {
      setSelectedVehicleIds([...selectedVehicleIds, vehicleId]);
    }
  };

  // Validations
  const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;

  const isRentalVehicleError =
    playMode === 'RENTAL' && selectedVehicleIds.length === 0;
    
  const isByocCapacityError =
    playMode === 'BYOC' && byocRemaining !== null && participants > byocRemaining;

  return (
    <View className="space-y-6">
      {/* 1. Số người chơi */}
      <View>
        <View className="flex-row items-center gap-1.5 mb-3">
          <User color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            1. Số lượng người chơi
          </Text>
        </View>

        <View className="flex-row items-center bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 justify-between shadow-sm">
          <View>
            <Text className="text-[14px] text-slate-900 dark:text-white" weight="700">
              Tổng số người chơi
            </Text>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
              Bao gồm người đặt và người chơi đi cùng
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable
              disabled={participants <= 1}
              onPress={handleDecrease}
              className={`h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 ${
                participants <= 1 ? 'opacity-40' : ''
              }`}
            >
              <Minus color={colorScheme === 'dark' ? '#ffffff' : '#475569'} size={16} />
            </Pressable>
            <Text className="text-[16px] text-slate-900 dark:text-white font-bold w-6 text-center">
              {participants}
            </Text>
            <Pressable
              onPress={handleIncrease}
              className="h-8 w-8 rounded-full bg-[#ea580c] items-center justify-center active:bg-[#f97316]"
            >
              <Plus color="#ffffff" size={16} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. Đăng ký người đi cùng */}
      {participants > 1 && (
        <View className="mt-5">
          <View className="flex-row items-center gap-1.5 mb-3">
            <Smartphone color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
              2. Thông tin người đi cùng
            </Text>
          </View>

          <View className="gap-3.5">
            {companions.map((comp, idx) => (
              <View
                key={idx}
                className="bg-white dark:bg-[#0f172a]/30 border border-slate-200 dark:border-slate-800 rounded-xl p-4 gap-3 shadow-sm"
              >
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  Người chơi #{idx + 2}
                </Text>
                
                {/* Tên */}
                <View className="space-y-1">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">Họ và tên</Text>
                  <TextInput
                    value={comp.name}
                    onChangeText={(val) => updateCompanion(idx, 'name', val)}
                    placeholder="Nhập tên người đi cùng"
                    placeholderTextColor="#94a3b8"
                    className="h-10 px-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[12px] rounded-lg"
                  />
                  {comp.name.trim() === '' && (
                    <Text className="text-[9px] text-[#ef4444] font-semibold mt-1">
                      Họ tên không được để trống!
                    </Text>
                  )}
                </View>

                {/* SĐT */}
                <View className="space-y-1">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">Số điện thoại</Text>
                  <TextInput
                    value={comp.phone}
                    onChangeText={(val) => updateCompanion(idx, 'phone', val)}
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    className="h-10 px-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[12px] rounded-lg"
                  />
                  {comp.phone.trim() !== '' && !phoneRegex.test(comp.phone) && (
                    <Text className="text-[9px] text-[#ef4444] font-semibold mt-1">
                      Số điện thoại không đúng định dạng Việt Nam!
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. Chọn xe / Validate */}
      {playMode === 'RENTAL' ? (
        <View className="mt-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <Car color="#f97316" size={15} />
              <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                3. Chọn xe thuê để đua
              </Text>
            </View>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Đã chọn: {selectedVehicleIds.length} xe
            </Text>
          </View>

          {loadingVehicles ? (
            <ActivityIndicator size="small" color="#f97316" className="py-4" />
          ) : vehicleUnits.filter((vehicle) => availableVehicleIds.includes(vehicle.id)).length > 0 ? (
            <View className="gap-2.5">
              {vehicleUnits.filter((vehicle) => availableVehicleIds.includes(vehicle.id)).map((vehicle) => {
                const isSelected = selectedVehicleIds.includes(vehicle.id);
                return (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => toggleVehicle(vehicle.id)}
                    className={`p-3 rounded-xl border flex-row gap-3.5 transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#ea580c]/10 border-[#f97316]'
                        : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {vehicle.distinctive_image_url || vehicle.catalog?.cover_image_url ? (
                      <Image
                        source={{ uri: vehicle.distinctive_image_url || vehicle.catalog?.cover_image_url || undefined }}
                        className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-900 object-cover"
                      />
                    ) : (
                      <View className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center">
                        <Car color="#475569" size={24} />
                      </View>
                    )}
                    <View className="flex-1 justify-center">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                          {vehicle.catalog?.name || 'Xe thuê'}
                        </Text>
                        <View className="bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                          <Text className="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                            {vehicle.catalog?.tier || 'Tiêu chuẩn'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[10px] text-slate-550 dark:text-slate-400 mt-0.5 font-semibold" numberOfLines={1}>
                        Mã xe: {vehicle.identifier || vehicle.id.slice(0, 8).toUpperCase()}{vehicle.color ? ` • ${vehicle.color}` : ''}
                      </Text>
                      <View className="flex-row items-center justify-between mt-1.5">
                        <Text className="text-[12px] text-[#f97316] font-bold">
                          {Number(vehicle.catalog?.hourlyRate || 0).toLocaleString('vi-VN')}đ/giờ
                        </Text>
                        <Text className="text-[9px] text-[#10b981] font-bold">
                          Sẵn sàng
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View className="bg-slate-100 dark:bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-200 dark:border-slate-800 items-center justify-center">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">
                Không có xe thuê khả dụng.
              </Text>
            </View>
          )}

          {isRentalVehicleError && (
            <View className="flex-row items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3 mt-3">
              <AlertTriangle color="#ef4444" size={15} />
              <Text className="text-[11px] text-[#ef4444] font-semibold flex-1 font-medium">
                Vui lòng chọn ít nhất một xe thuê còn trống cho phiên này.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View className="mt-5">
          <View className="flex-row items-center gap-1.5 mb-3">
            <Car color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
              3. Xe cá nhân (BYOC)
            </Text>
          </View>

          <View className="bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 gap-3.5 shadow-sm">
            <View className="flex-row gap-2.5 items-start">
              <View className="h-8 w-8 items-center justify-center rounded bg-orange-600/10 border border-orange-500/20">
                <Car color="#ea580c" size={16} />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] text-slate-800 dark:text-slate-200" weight="700">
                  Tự mang xe đua của bạn
                </Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-4.5 font-semibold">
                  Chế độ này không phát sinh phí thuê xe. Vui lòng đảm bảo xe của bạn đã được kiểm định an toàn trước khi xuống làn.
                </Text>
              </View>
            </View>

            {checkingByoc ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : byocRemaining !== null ? (
              <View className="h-[1px] bg-slate-200 dark:bg-slate-800/80 my-0.5">
                <View className="flex-row justify-between items-center pt-2">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Số chỗ BYOC còn lại:</Text>
                  <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                    {byocRemaining} slot trống
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {isByocCapacityError && (
            <View className="flex-row items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3 mt-3">
              <AlertTriangle color="#ef4444" size={15} />
              <Text className="text-[11px] text-[#ef4444] font-semibold flex-1 font-medium">
                Khung giờ này chỉ còn trống {byocRemaining} chỗ cho xe cá nhân. Vui lòng giảm số người chơi!
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
