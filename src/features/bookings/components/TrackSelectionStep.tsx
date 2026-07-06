import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Calendar, Clock, Layers, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type TrackConfig } from '../api/booking-wizard.api';

interface TrackSelectionStepProps {
  cafeId: string;
  selectedTrackConfig: TrackConfig | null;
  setSelectedTrackConfig: (track: TrackConfig) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  selectedSlot: string; // HH:MM
  setSelectedSlot: (slot: string) => void;
  playMode: 'RENTAL' | 'BYOC';
  setPlayMode: (mode: 'RENTAL' | 'BYOC') => void;
}

// Generate 7 days starting from today
const getNext7Days = () => {
  const list = [];
  const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateStr = String(d.getDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${dateStr}`;
    
    list.push({
      fullDate,
      dayLabel: daysOfWeek[d.getDay()],
      dateLabel: d.getDate(),
      isToday: i === 0,
    });
  }
  return list;
};

// Generate time slots from 08:00 to 21:00 (every 1 hour)
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

export function TrackSelectionStep({
  cafeId,
  selectedTrackConfig,
  setSelectedTrackConfig,
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
  playMode,
  setPlayMode,
}: TrackSelectionStepProps) {
  const [tracks, setTracks] = useState<TrackConfig[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const daysList = getNext7Days();

  // Load track configs
  useEffect(() => {
    const fetchTracks = async () => {
      setLoadingTracks(true);
      const data = await bookingWizardApi.getCafeTrackConfigs(cafeId);
      setTracks(data);
      if (data.length > 0 && !selectedTrackConfig) {
        setSelectedTrackConfig(data[0]);
      }
      setLoadingTracks(false);
    };
    fetchTracks();
  }, [cafeId, selectedTrackConfig, setSelectedTrackConfig]);

  // Load slot availability when track, date or playMode changes
  useEffect(() => {
    if (!selectedTrackConfig || !selectedDate) return;

    const checkAllSlots = async () => {
      setLoadingSlots(true);
      const availabilityMap: Record<string, boolean> = {};

      try {
        await Promise.all(
          TIME_SLOTS.map(async (slot) => {
            const [h, m] = slot.split(':').map(Number);
            const slotStart = `${selectedDate}T${slot}:00+07:00`;
            
            // End time is +1 hour
            const endH = String(h + 1).padStart(2, '0');
            const slotEnd = `${selectedDate}T${endH}:${String(m).padStart(2, '0')}:00+07:00`;

            try {
              const res = await bookingWizardApi.checkAvailability(cafeId, {
                slot_start: slotStart,
                slot_end: slotEnd,
                play_mode: playMode,
                track_config_id: selectedTrackConfig.id,
              });
              
              if (playMode === 'RENTAL') {
                availabilityMap[slot] = (res.vehicles && res.vehicles.length > 0) || false;
              } else {
                availabilityMap[slot] = (res.byoc_remaining && res.byoc_remaining > 0) || false;
              }
            } catch {
              availabilityMap[slot] = false;
            }
          })
        );
        setSlotAvailability(availabilityMap);
      } catch (err) {
        console.error('[TrackSelectionStep] Error checking slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    checkAllSlots();
  }, [cafeId, selectedTrackConfig, selectedDate, playMode]);

  return (
    <View className="space-y-6">
      {/* 1. Chọn loại sân */}
      <View>
        <View className="flex-row items-center gap-1.5 mb-3">
          <Layers color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            1. Chọn loại sân chạy
          </Text>
        </View>

        {loadingTracks ? (
          <ActivityIndicator size="small" color="#f97316" className="py-4" />
        ) : tracks.length > 0 ? (
          <View className="gap-2.5">
            {tracks.map((track) => {
              const isSelected = selectedTrackConfig?.id === track.id;
              return (
                <Pressable
                  key={track.id}
                  onPress={() => setSelectedTrackConfig(track)}
                  className={`p-4 rounded-xl border flex-col transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#ea580c]/10 border-[#f97316]'
                      : 'bg-[#0f172a]/50 border-slate-800'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[14px] text-white" weight="700">
                      {track.name}
                    </Text>
                    {isSelected && (
                      <View className="h-5 w-5 rounded-full bg-[#f97316] items-center justify-center">
                        <ShieldCheck color="#ffffff" size={13} strokeWidth={2.5} />
                      </View>
                    )}
                  </View>
                  {track.description && (
                    <Text className="text-[11px] text-slate-400 mt-1 leading-4.5 font-semibold">
                      {track.description}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-800 items-center justify-center">
            <Text className="text-[12px] text-slate-400 font-semibold">
              Không có sân chơi khả dụng.
            </Text>
          </View>
        )}
      </View>

      {/* 2. Chọn hình thức chơi */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Clock color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            2. Chế độ chơi (Play Mode)
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setPlayMode('RENTAL')}
            className={`flex-1 p-3.5 rounded-xl border items-center justify-center ${
              playMode === 'RENTAL'
                ? 'bg-[#ea580c]/10 border-[#f97316]'
                : 'bg-[#0f172a]/50 border-slate-800'
            }`}
          >
            <Text className={`text-[13px] ${playMode === 'RENTAL' ? 'text-[#f97316]' : 'text-slate-300'}`} weight="700">
              Thuê xe (RENTAL)
            </Text>
            <Text className="text-[9px] text-slate-400 mt-0.5 text-center font-semibold">
              Sử dụng xe đua của cửa hàng
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setPlayMode('BYOC')}
            className={`flex-1 p-3.5 rounded-xl border items-center justify-center ${
              playMode === 'BYOC'
                ? 'bg-[#ea580c]/10 border-[#f97316]'
                : 'bg-[#0f172a]/50 border-slate-800'
            }`}
          >
            <Text className={`text-[13px] ${playMode === 'BYOC' ? 'text-[#f97316]' : 'text-slate-300'}`} weight="700">
              Xe cá nhân (BYOC)
            </Text>
            <Text className="text-[9px] text-slate-400 mt-0.5 text-center font-semibold">
              Tự mang xe đã đăng ký của bạn
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Chọn ngày */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Calendar color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            3. Chọn ngày chơi
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2.5"
          className="py-1"
        >
          {daysList.map((item) => {
            const isSelected = selectedDate === item.fullDate;
            return (
              <Pressable
                key={item.fullDate}
                onPress={() => {
                  setSelectedDate(item.fullDate);
                  setSelectedSlot(''); // Reset slot when date changes
                }}
                className={`w-14 py-2.5 rounded-xl border items-center justify-center flex-col ${
                  isSelected
                    ? 'bg-[#ea580c] border-[#ea580c]'
                    : 'bg-[#0f172a]/50 border-slate-800'
                }`}
              >
                <Text className={`text-[10px] ${isSelected ? 'text-white' : 'text-slate-400'} font-bold`}>
                  {item.dayLabel}
                </Text>
                <Text className={`text-[16px] mt-1 ${isSelected ? 'text-white' : 'text-slate-200'}`} weight="700">
                  {item.dateLabel}
                </Text>
                {item.isToday && (
                  <View className={`h-1.5 w-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#f97316]'}`} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Chọn giờ */}
      <View className="mt-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5">
            <Clock color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
              4. Chọn khung giờ (1 slot = 60 phút)
            </Text>
          </View>
          {loadingSlots && <ActivityIndicator size="small" color="#f97316" />}
        </View>

        <View className="flex-row flex-wrap gap-2">
          {TIME_SLOTS.map((slot) => {
            const isSelected = selectedSlot === slot;
            const isAvailable = slotAvailability[slot] !== false; // Default to true if not loaded yet
            
            return (
              <Pressable
                key={slot}
                disabled={!isAvailable || loadingSlots}
                onPress={() => setSelectedSlot(slot)}
                className={`w-[23%] py-2.5 rounded-xl border items-center justify-center ${
                  isSelected
                    ? 'bg-[#ea580c] border-[#ea580c]'
                    : !isAvailable
                    ? 'bg-slate-900/10 border-slate-900/40 opacity-40'
                    : 'bg-[#0f172a]/50 border-slate-800'
                }`}
              >
                <Text
                  className={`text-[12px] font-bold ${
                    isSelected
                      ? 'text-white'
                      : !isAvailable
                      ? 'text-slate-600 line-through'
                      : 'text-slate-300'
                  }`}
                >
                  {slot}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!loadingSlots && Object.values(slotAvailability).every(v => v === false) && (
          <View className="flex-row items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3 mt-3">
            <AlertCircle color="#ef4444" size={15} />
            <Text className="text-[11px] text-[#ef4444] font-semibold flex-1">
              Khung giờ ngày này đã hết chỗ hoặc không khả dụng. Vui lòng chọn ngày khác!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
