import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Image, ActivityIndicator } from 'react-native';
import { User, Plus, Minus, AlertTriangle, Car, Smartphone } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type Companion, type VehicleCatalog } from '../api/booking-wizard.api';

interface ParticipantsStepProps {
  cafeId: string;
  playMode: 'RENTAL' | 'BYOC';
  participants: number;
  setParticipants: (num: number) => void;
  companions: Companion[];
  setCompanions: (list: Companion[]) => void;
  selectedVehicleIds: string[];
  setSelectedVehicleIds: (ids: string[]) => void;
  slotStart: string;
  slotEnd: string;
  trackConfigId?: string;
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
}: ParticipantsStepProps) {
  const [catalogs, setCatalogs] = useState<VehicleCatalog[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [byocRemaining, setByocRemaining] = useState<number | null>(null);
  const [checkingByoc, setCheckingByoc] = useState(false);

  // 1. Load vehicle catalogs (only if RENTAL)
  useEffect(() => {
    if (playMode !== 'RENTAL') return;
    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      const data = await bookingWizardApi.getCafeCatalogs(cafeId);
      setCatalogs(data);
      setLoadingVehicles(false);
    };
    fetchVehicles();
  }, [cafeId, playMode]);

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
    playMode === 'RENTAL' && selectedVehicleIds.length < participants;
    
  const isByocCapacityError =
    playMode === 'BYOC' && byocRemaining !== null && participants > byocRemaining;

  return (
    <View className="space-y-6">
      {/* 1. Số người chơi */}
      <View>
        <View className="flex-row items-center gap-1.5 mb-3">
          <User color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            1. Số lượng người chơi
          </Text>
        </View>

        <View className="flex-row items-center bg-[#0f172a]/50 border border-slate-800 rounded-xl p-4 justify-between">
          <View>
            <Text className="text-[14px] text-white" weight="700">
              Tổng số người chơi
            </Text>
            <Text className="text-[10px] text-slate-400 mt-0.5 font-semibold">
              Bao gồm người đặt và người chơi đi cùng
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable
              disabled={participants <= 1}
              onPress={handleDecrease}
              className={`h-8 w-8 rounded-full bg-slate-800 items-center justify-center active:bg-slate-700 ${
                participants <= 1 ? 'opacity-40' : ''
              }`}
            >
              <Minus color="#ffffff" size={16} />
            </Pressable>
            <Text className="text-[16px] text-white font-bold w-6 text-center">
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
            <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
              2. Thông tin người đi cùng
            </Text>
          </View>

          <View className="gap-3.5">
            {companions.map((comp, idx) => (
              <View
                key={idx}
                className="bg-[#0f172a]/30 border border-slate-800 rounded-xl p-4 gap-3"
              >
                <Text className="text-[11px] text-slate-400 uppercase font-bold">
                  Người chơi #{idx + 2}
                </Text>
                
                {/* Tên */}
                <View className="space-y-1">
                  <Text className="text-[11px] text-slate-400 font-semibold mb-1">Họ và tên</Text>
                  <TextInput
                    value={comp.name}
                    onChangeText={(val) => updateCompanion(idx, 'name', val)}
                    placeholder="Nhập tên người đi cùng"
                    placeholderTextColor="#475569"
                    className="h-10 px-3 bg-[#0b0f19] border border-slate-800 text-white text-[12px] rounded-lg"
                  />
                  {comp.name.trim() === '' && (
                    <Text className="text-[9px] text-[#ef4444] font-semibold mt-1">
                      Họ tên không được để trống!
                    </Text>
                  )}
                </View>

                {/* SĐT */}
                <View className="space-y-1">
                  <Text className="text-[11px] text-slate-400 font-semibold mb-1">Số điện thoại</Text>
                  <TextInput
                    value={comp.phone}
                    onChangeText={(val) => updateCompanion(idx, 'phone', val)}
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#475569"
                    keyboardType="phone-pad"
                    className="h-10 px-3 bg-[#0b0f19] border border-slate-800 text-white text-[12px] rounded-lg"
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
              <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
                3. Chọn xe thuê để đua
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400 font-semibold">
              Đã chọn: {selectedVehicleIds.length} xe
            </Text>
          </View>

          {loadingVehicles ? (
            <ActivityIndicator size="small" color="#f97316" className="py-4" />
          ) : catalogs.length > 0 ? (
            <View className="gap-2.5">
              {catalogs.map((vehicle) => {
                const isSelected = selectedVehicleIds.includes(vehicle.id);
                return (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => toggleVehicle(vehicle.id)}
                    className={`p-3 rounded-xl border flex-row gap-3.5 transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#ea580c]/10 border-[#f97316]'
                        : 'bg-[#0f172a]/50 border-slate-800'
                    }`}
                  >
                    {vehicle.coverImageUrl ? (
                      <Image
                        source={{ uri: vehicle.coverImageUrl }}
                        className="h-16 w-16 rounded-lg bg-slate-900 object-cover"
                      />
                    ) : (
                      <View className="h-16 w-16 rounded-lg bg-slate-900 border border-slate-800 items-center justify-center">
                        <Car color="#475569" size={24} />
                      </View>
                    )}
                    <View className="flex-1 justify-center">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[13px] text-white" weight="700">
                          {vehicle.name}
                        </Text>
                        <View className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          <Text className="text-[8px] text-slate-400 font-bold uppercase">
                            {vehicle.tier}
                          </Text>
                        </View>
                      </View>
                      {vehicle.description && (
                        <Text className="text-[10px] text-slate-400 mt-0.5 font-semibold" numberOfLines={1}>
                          {vehicle.description}
                        </Text>
                      )}
                      {vehicle.compatibleTrackTypes && vehicle.compatibleTrackTypes.length > 0 && (
                        <View className="flex-row flex-wrap gap-1 mt-1">
                          {vehicle.compatibleTrackTypes.map((type) => (
                            <View key={type.id} className="bg-[#0b0f19] px-1.5 py-0.5 rounded border border-slate-800">
                              <Text className="text-[7.5px] text-slate-400 font-bold">
                                Sân: {type.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View className="flex-row items-center justify-between mt-1.5">
                        <Text className="text-[12px] text-[#f97316] font-bold">
                          {Number(vehicle.hourlyRate).toLocaleString('vi-VN')}đ/giờ
                        </Text>
                        <Text className="text-[9px] text-[#10b981] font-bold">
                          Còn {vehicle.available_units ?? 0} xe trống
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View className="bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-800 items-center justify-center">
              <Text className="text-[12px] text-slate-400 font-semibold">
                Không có xe thuê khả dụng.
              </Text>
            </View>
          )}

          {isRentalVehicleError && (
            <View className="flex-row items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3 mt-3">
              <AlertTriangle color="#ef4444" size={15} />
              <Text className="text-[11px] text-[#ef4444] font-semibold flex-1 font-medium">
                Bạn cần thuê ít nhất {participants} xe cho {participants} người chơi (mỗi người 1 xe)!
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View className="mt-5">
          <View className="flex-row items-center gap-1.5 mb-3">
            <Car color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
              3. Xe cá nhân (BYOC)
            </Text>
          </View>

          <View className="bg-[#0f172a]/50 border border-slate-800 rounded-xl p-4 gap-3.5">
            <View className="flex-row gap-2.5 items-start">
              <View className="h-8 w-8 items-center justify-center rounded bg-orange-600/10 border border-orange-500/20">
                <Car color="#ea580c" size={16} />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] text-slate-200" weight="700">
                  Tự mang xe đua của bạn
                </Text>
                <Text className="text-[10px] text-slate-400 mt-1 leading-4.5 font-semibold">
                  Chế độ này không phát sinh phí thuê xe. Vui lòng đảm bảo xe của bạn đã được kiểm định an toàn trước khi xuống làn.
                </Text>
              </View>
            </View>

            {checkingByoc ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : byocRemaining !== null ? (
              <View className="h-[1px] bg-slate-800/80 my-0.5">
                <View className="flex-row justify-between items-center pt-2">
                  <Text className="text-[11px] text-slate-400 font-semibold">Số chỗ BYOC còn lại:</Text>
                  <Text className="text-[13px] text-white" weight="700">
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
