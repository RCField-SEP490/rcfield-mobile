import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { Calendar, Clock, Layers, ShieldCheck, AlertCircle, ChevronLeft, ChevronRight, X, Car, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type TrackConfig, type VehicleCatalog } from '../api/booking-wizard.api';
import type { Cafe } from '@/features/explore/types/explore.types';

const TRACK_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=600&auto=format&fit=crop';

interface TrackSelectionStepProps {
  cafeId: string;
  selectedTrackConfig: TrackConfig | null;
  setSelectedTrackConfig: (track: TrackConfig) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  selectedSlots: string[]; // Array of selected HH:MM
  setSelectedSlots: (slots: string[]) => void;
  playMode: 'RENTAL' | 'BYOC';
  setPlayMode: (mode: 'RENTAL' | 'BYOC') => void;
  selectedVehicleIds: string[];
  setSelectedVehicleIds: (ids: string[]) => void;
  catalogs: VehicleCatalog[];
  cafe: Cafe | null;
}

interface SlotDetails {
  available: boolean;
  byocRemaining: number;
  vehiclesAvailable: number;
}

// Check if a time slot on a given date is in the past compared to current system time
const isSlotPast = (slot: string, dateStr: string) => {
  const today = new Date();

  // Format today as YYYY-MM-DD
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  // Same day, compare hours
  const [slotH, slotM] = slot.split(':').map(Number);
  const currentH = today.getHours();
  const currentM = today.getMinutes();

  if (slotH < currentH) return true;
  if (slotH === currentH && slotM <= currentM) return true;

  return false;
};

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

export function TrackSelectionStep({
  cafeId,
  selectedTrackConfig,
  setSelectedTrackConfig,
  selectedDate,
  setSelectedDate,
  selectedSlots,
  setSelectedSlots,
  playMode,
  setPlayMode,
  selectedVehicleIds,
  setSelectedVehicleIds,
  catalogs,
  cafe,
}: TrackSelectionStepProps) {
  const { colorScheme } = useColorScheme();
  const [tracks, setTracks] = useState<TrackConfig[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [slotDetails, setSlotDetails] = useState<Record<string, SlotDetails>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Generate dynamic time slots based on Cafe's operatingHours and slotDurationMinutes
  const timeSlots = React.useMemo(() => {
    const defaultSlots = [
      '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
    ];

    if (!cafe) {
      return defaultSlots;
    }

    let parsedHours: Record<string, any> = {};
    if (typeof cafe.operatingHours === 'string') {
      try {
        parsedHours = JSON.parse(cafe.operatingHours);
      } catch (e) {
        console.error('[TrackSelectionStep] Error parsing operatingHours string:', e);
      }
    } else if (cafe.operatingHours) {
      parsedHours = cafe.operatingHours;
    }

    // Get day of the week
    const dateObj = new Date(selectedDate);
    const dayIndex = dateObj.getDay();
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = days[dayIndex];

    const schedule = parsedHours[dayKey];
    if (!schedule || schedule.is_closed || !schedule.open || !schedule.close) {
      return [];
    }

    const duration = cafe.slotDurationMinutes || 60;

    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (min: number) => {
      const h = Math.floor(min / 60) % 24;
      const m = min % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const start = timeToMinutes(schedule.open);
    let end = timeToMinutes(schedule.close);
    if (end <= start) {
      end += 24 * 60;
    }

    const list: string[] = [];
    for (let current = start; current + duration <= end; current += duration) {
      list.push(minutesToTime(current));
    }
    return list.length > 0 ? list : defaultSlots;
  }, [cafe, selectedDate]);

  // Popup warning when switching playMode from RENTAL to BYOC with selected vehicles
  const handleSelectByoc = () => {
    if (playMode === 'RENTAL' && selectedVehicleIds.length > 0) {
      const selectedNames = selectedVehicleIds
        .map((id) => catalogs.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      Alert.alert(
        'Chuyển sang mang xe riêng?',
        `Bạn đang có xe ${selectedNames} đã chọn để thuê. Chuyển sang chế độ mang xe riêng sẽ xóa toàn bộ lựa chọn xe thuê này.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đồng ý',
            style: 'destructive',
            onPress: () => {
              setSelectedVehicleIds([]);
              setPlayMode('BYOC');
            },
          },
        ]
      );
    } else {
      setPlayMode('BYOC');
    }
  };

  // Custom Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth()); // 0-indexed

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
      setSlotDetails({}); // Clear old details immediately to show loader block and avoid UI jumping
      const updatedDetails: Record<string, SlotDetails> = {};

      try {
        await Promise.all(
          timeSlots.map(async (slot) => {
            // Optimization: If slot is in the past, disable immediately without calling API
            if (isSlotPast(slot, selectedDate)) {
              updatedDetails[slot] = {
                available: false,
                byocRemaining: 0,
                vehiclesAvailable: 0,
              };
              return;
            }

            const duration = cafe?.slotDurationMinutes || 60;
            const [h, m] = slot.split(':').map(Number);
            const startMinutes = h * 60 + m;
            const endMinutes = startMinutes + duration;

            const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
            const endM = String(endMinutes % 60).padStart(2, '0');

            // Handle date overflow when booking crosses midnight
            let endDateStr = selectedDate;
            if (endMinutes >= 24 * 60) {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              const y = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const da = String(d.getDate()).padStart(2, '0');
              endDateStr = `${y}-${mo}-${da}`;
            }

            const slotStart = `${selectedDate}T${slot}:00+07:00`;
            const slotEnd = `${endDateStr}T${endH}:${endM}:00+07:00`;

            try {
              const res = await bookingWizardApi.checkAvailability(cafeId, {
                slot_start: slotStart,
                slot_end: slotEnd,
                play_mode: playMode,
                track_config_id: selectedTrackConfig.id,
              });

              const vCount = res.vehicles?.length || 0;
              const byocRem = res.byoc_remaining || 0;
              const isAvail = playMode === 'RENTAL' ? vCount > 0 : byocRem > 0;

              updatedDetails[slot] = {
                available: isAvail,
                byocRemaining: byocRem,
                vehiclesAvailable: vCount,
              };
            } catch {
              updatedDetails[slot] = {
                available: false,
                byocRemaining: 0,
                vehiclesAvailable: 0,
              };
            }
          })
        );
        setSlotDetails(updatedDetails);
      } catch (err) {
        console.error('[TrackSelectionStep] Error checking slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    checkAllSlots();
  }, [cafeId, selectedTrackConfig, selectedDate, playMode, timeSlots, cafe]);

  // Month-Year Label formatting
  const formattedMonthYear = React.useMemo(() => {
    if (!selectedDate) return '';
    const [y, m] = selectedDate.split('-');
    return `Tháng ${m}, ${y}`;
  }, [selectedDate]);

  // Custom Calendar Data Generation
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayIndex = (() => {
    const day = new Date(calendarYear, calendarMonth, 1).getDay();
    return day === 0 ? 6 : day - 1; // CN=6, T2=0
  })();

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleSelectDateFromCalendar = (day: number) => {
    const yearStr = calendarYear;
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const fullDate = `${yearStr}-${monthStr}-${dayStr}`;

    setSelectedDate(fullDate);
    setSelectedSlots([]);
    setShowCalendar(false);
  };

  const handleToggleSlot = (slot: string) => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter(s => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  return (
    <View className="space-y-6">
      {/* 1. Chọn loại sân */}
      <View>
        <View className="flex-row items-center gap-1.5 mb-3">
          <Layers color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            1. Chọn loại sân chạy
          </Text>
        </View>

        {loadingTracks ? (
          <ActivityIndicator size="small" color="#f97316" className="py-4" />
        ) : tracks.length > 0 ? (
          <View className="gap-3">
            {tracks.map((track) => {
              const isSelected = selectedTrackConfig?.id === track.id;
              const trackImage = track.images?.[0] || TRACK_PLACEHOLDER_IMAGE;
              const trackName = track.track_type?.name || 'Sân đua RC';
              const trackDesc = track.description || track.track_type?.description || 'Chi tiết thông số cấu hình làn đua.';

              return (
                <Pressable
                  key={track.id}
                  onPress={() => setSelectedTrackConfig(track)}
                  className={`p-3 rounded-xl border flex-row gap-3 transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#ea580c]/10 border-[#f97316]'
                      : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Sân image */}
                  <Image
                    source={{ uri: trackImage }}
                    className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-900 object-cover"
                  />

                  {/* Sân Info */}
                  <View className="flex-1 pr-1 justify-between">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                        {trackName}
                      </Text>
                      {isSelected && (
                        <View className="h-4.5 w-4.5 rounded-full bg-[#f97316] items-center justify-center">
                          <ShieldCheck color="#ffffff" size={11} strokeWidth={3} />
                        </View>
                      )}
                    </View>

                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 leading-4 font-semibold" numberOfLines={1}>
                      {trackDesc}
                    </Text>

                    {/* Specs columns */}
                    <View className="flex-row gap-4 mt-1.5">
                      <View className="flex-row items-center gap-1">
                        <Car color="#ea580c" size={11} />
                        <Text className="text-[9px] text-slate-600 dark:text-slate-300 font-bold">
                          Thuê xe: Tối đa {track.max_concurrent} lượt
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <User color="#10b981" size={11} />
                        <Text className="text-[9px] text-slate-600 dark:text-slate-300 font-bold">
                          Xe riêng: Tối đa {track.byoc_capacity} lượt
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="bg-slate-100 dark:bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-200 dark:border-slate-800 items-center justify-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">
              Không có sân chơi khả dụng.
            </Text>
          </View>
        )}
      </View>

      {/* 2. Chọn hình thức chơi */}
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5 mb-3">
          <Clock color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            2. Chế độ chơi (Play Mode)
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setPlayMode('RENTAL')}
            className={`flex-1 p-3.5 rounded-xl border items-center justify-center ${
              playMode === 'RENTAL'
                ? 'bg-[#ea580c]/10 border-[#f97316]'
                : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Text className={`text-[13px] ${playMode === 'RENTAL' ? 'text-[#f97316]' : 'text-slate-700 dark:text-slate-300'}`} weight="700">
              Thuê xe (RENTAL)
            </Text>
            <Text className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 text-center font-semibold">
              Sử dụng xe đua của cửa hàng
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSelectByoc}
            className={`flex-1 p-3.5 rounded-xl border items-center justify-center ${
              playMode === 'BYOC'
                ? 'bg-[#ea580c]/10 border-[#f97316]'
                : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Text className={`text-[13px] ${playMode === 'BYOC' ? 'text-[#f97316]' : 'text-slate-700 dark:text-slate-300'}`} weight="700">
              Xe cá nhân (BYOC)
            </Text>
            <Text className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 text-center font-semibold">
              Tự mang xe đã đăng ký của bạn
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Chọn ngày */}
      <View className="mt-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5">
            <Calendar color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
              3. Chọn ngày chơi
            </Text>
          </View>
          <Text className="text-[11px] text-slate-900 dark:text-white font-bold bg-slate-105 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
            {formattedMonthYear}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5">
          {/* List 7 days */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2.5"
            className="flex-1 py-1"
          >
            {daysList.map((item) => {
              const isSelected = selectedDate === item.fullDate;
              return (
                <Pressable
                  key={item.fullDate}
                  onPress={() => {
                    setSelectedDate(item.fullDate);
                    setSelectedSlots([]); // Reset slots when date changes
                  }}
                  className={`w-14 py-2.5 rounded-xl border items-center justify-center flex-col ${
                    isSelected
                      ? 'bg-[#ea580c] border-[#ea580c]'
                      : 'bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Text className={`text-[10px] ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} font-bold`}>
                    {item.dayLabel}
                  </Text>
                  <Text className={`text-[16px] mt-1 ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`} weight="700">
                    {item.dateLabel}
                  </Text>
                  {item.isToday && (
                    <View className={`h-1.5 w-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#f97316]'}`} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Calendar Picker Trigger */}
          <Pressable
            onPress={() => {
              const [y, m] = selectedDate.split('-').map(Number);
              setCalendarYear(y);
              setCalendarMonth(m - 1);
              setShowCalendar(true);
            }}
            className="w-14 py-2.5 bg-white dark:bg-[#0f172a]/50 border border-slate-200 dark:border-slate-800 rounded-xl items-center justify-center flex-col active:bg-slate-100 dark:active:bg-slate-850"
          >
            <Calendar color="#f97316" size={16} />
            <Text className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-1 font-bold">Khác</Text>
          </Pressable>
        </View>
      </View>

      {/* 4. Chọn giờ */}
      <View className="mt-5">
        <View className="flex-row items-center justify-between mb-3 h-6">
          <View className="flex-row items-center gap-1.5">
            <Clock color="#f97316" size={15} />
            <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
              4. Chọn khung giờ (Có thể chọn nhiều slot liên tiếp)
            </Text>
          </View>
          {loadingSlots && <ActivityIndicator size="small" color="#f97316" />}
        </View>

        {loadingSlots ? (
          <View className="h-32 items-center justify-center bg-white dark:bg-[#0f172a]/20 border border-slate-200 dark:border-slate-900 rounded-xl">
            <ActivityIndicator size="small" color="#f97316" />
            <Text className="text-[10px] text-slate-500 mt-2 font-semibold">
              Đang tải danh sách khung giờ trống...
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {timeSlots.map((slot) => {
              const isSelected = selectedSlots.includes(slot);
              const detail = slotDetails[slot];
              const isPast = isSlotPast(slot, selectedDate);
              const isAvailable = !isPast && (detail?.available ?? false);

              // Dynamic Styling based on slot status
              let btnStyle = "bg-white dark:bg-[#0f172a]/50 border-slate-200 dark:border-slate-800";
              let textStyle = "text-slate-700 dark:text-slate-300";
              let subTextStyle = "text-slate-400 dark:text-slate-500";

              if (isSelected) {
                btnStyle = "bg-[#ea580c] border-[#ea580c]";
                textStyle = "text-white";
                subTextStyle = "text-orange-200";
              } else if (isPast || (detail && !isAvailable)) {
                // Disabled state
                btnStyle = "bg-slate-100/30 dark:bg-slate-900/10 border-slate-200/40 dark:border-slate-900/40 opacity-30";
                textStyle = "text-slate-400 dark:text-slate-600 line-through";
                subTextStyle = "text-slate-400 dark:text-slate-600";
              } else if (isAvailable) {
                // Available slot gets elegant green borders and indicators
                btnStyle = "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/30";
                textStyle = "text-emerald-500 dark:text-emerald-400 font-bold";
                subTextStyle = "text-emerald-600 dark:text-emerald-500/80";
              }

              return (
                <Pressable
                  key={slot}
                  disabled={!isAvailable}
                  onPress={() => handleToggleSlot(slot)}
                  className={`w-[23%] py-2 rounded-xl border items-center justify-center ${btnStyle}`}
                >
                  <Text className={`text-[12px] ${textStyle}`}>
                    {slot}
                  </Text>
                  {isAvailable && detail && (
                    <Text className={`text-[7.5px] font-semibold mt-0.5 ${subTextStyle}`}>
                      {playMode === 'RENTAL' ? `Còn ${detail.vehiclesAvailable} xe` : `Còn ${detail.byocRemaining} chỗ`}
                    </Text>
                  )}
                  {!isAvailable && (isPast || (detail && !detail.available)) && (
                    <Text className={`text-[7.5px] font-semibold mt-0.5 ${subTextStyle}`}>
                      {isPast ? 'Quá giờ' : 'Hết chỗ'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {!loadingSlots && Object.values(slotDetails).every(v => v.available === false) && Object.keys(slotDetails).length > 0 && (
          <View className="flex-row items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-3 mt-3">
            <AlertCircle color="#ef4444" size={15} />
            <Text className="text-[11px] text-[#ef4444] font-semibold flex-1">
              Khung giờ ngày này đã hết chỗ hoặc không khả dụng. Vui lòng chọn ngày khác!
            </Text>
          </View>
        )}
      </View>

      {/* CUSTOM CALENDAR MODAL */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-5">
          <View className="w-full bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-900">
              <Text className="text-[14px] text-slate-900 dark:text-white" weight="700">
                Chọn ngày chơi khác
              </Text>
              <Pressable
                onPress={() => setShowCalendar(false)}
                className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center"
              >
                <X color={colorScheme === 'dark' ? '#94a3b8' : '#475569'} size={14} />
              </Pressable>
            </View>

            {/* Month-Year Selector */}
            <View className="flex-row justify-between items-center mb-4">
              <Pressable
                onPress={handlePrevMonth}
                className="h-8 w-8 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg items-center justify-center active:bg-slate-200 dark:active:bg-slate-800"
              >
                <ChevronLeft color="#f97316" size={16} />
              </Pressable>
              <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                {`Tháng ${String(calendarMonth + 1).padStart(2, '0')}, ${calendarYear}`}
              </Text>
              <Pressable
                onPress={handleNextMonth}
                className="h-8 w-8 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg items-center justify-center active:bg-slate-200 dark:active:bg-slate-800"
              >
                <ChevronRight color="#f97316" size={16} />
              </Pressable>
            </View>

            {/* Weekdays Header */}
            <View className="flex-row mb-2">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <View key={d} className="flex-1 items-center py-1">
                  <Text className="text-[10px] text-slate-500 font-bold">{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap">
              {/* Empty offset spaces */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <View key={`empty-${i}`} className="w-[14.28%] aspect-square justify-center items-center opacity-0" />
              ))}

              {/* Days digits */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;

                // Construct string date to check selection
                const checkingDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = selectedDate === checkingDate;

                // Validate if day is in past
                const checkDateObj = new Date(calendarYear, calendarMonth, dayNum);
                const todayObj = new Date();
                todayObj.setHours(0, 0, 0, 0);
                const isPast = checkDateObj < todayObj;

                return (
                  <Pressable
                    key={`day-${dayNum}`}
                    disabled={isPast}
                    onPress={() => handleSelectDateFromCalendar(dayNum)}
                    className={`w-[14.28%] aspect-square justify-center items-center rounded-lg border ${
                      isSelected
                        ? 'bg-[#ea580c] border-[#ea580c]'
                        : isPast
                        ? 'opacity-25 border-transparent'
                        : 'border-transparent active:bg-slate-100 dark:active:bg-slate-900'
                    }`}
                  >
                    <Text
                      className={`text-[12px] font-bold ${
                        isSelected
                          ? 'text-white'
                          : isPast
                          ? 'text-slate-400 dark:text-slate-600 line-through'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
