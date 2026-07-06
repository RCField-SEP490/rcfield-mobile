import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Map, MapPin, Search, Star, Compass, RotateCcw } from 'lucide-react-native';

import { getCafes } from '../api/explore.api';
import type { Cafe } from '../types/explore.types';
import { useLocation } from '@/shared/hooks/useLocation';
import { Text } from '@/shared/ui/Text';

// Hàm tính khoảng cách Haversine (km)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const CITIES = ['Tất cả', 'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'];
const TRACK_TYPES = ['Tất cả', 'Drift', 'Off-Road', 'Speed'];

export function ExploreScreen() {
  const router = useRouter();
  const { location: userLocation } = useLocation();

  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [filteredCafes, setFilteredCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Tất cả');
  const [selectedTrackType, setSelectedTrackType] = useState('Tất cả');

  const fetchCafes = async () => {
    setLoading(true);
    const data = await getCafes();
    setCafes(data);
    setFilteredCafes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCafes();
  }, []);

  // Bộ lọc logic
  useEffect(() => {
    let result = cafes;

    // Tìm kiếm theo tên
    if (searchQuery.trim()) {
      result = result.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Lọc theo thành phố
    if (selectedCity !== 'Tất cả') {
      result = result.filter((c) =>
        c.city.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    // Lọc theo loại đường đua
    if (selectedTrackType !== 'Tất cả') {
      result = result.filter((c) =>
        c.trackTypes.some((t) => t.toLowerCase() === selectedTrackType.toLowerCase())
      );
    }

    setFilteredCafes(result);
  }, [searchQuery, selectedCity, selectedTrackType, cafes]);

  const handleSelectCafe = (cafeId: string) => {
    router.push({
      pathname: '/explore-map',
      params: { cafeId },
    } as any);
  };

  const handleOpenMap = () => {
    router.push('/explore-map' as any);
  };

  const renderCafeItem = ({ item }: { item: Cafe }) => {
    const distance =
      userLocation && item.latitude && item.longitude
        ? getHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            item.latitude,
            item.longitude
          )
        : null;

    return (
      <Pressable
        onPress={() => handleSelectCafe(item.id)}
        className="mx-5 mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]/60 shadow-md active:bg-slate-900/60"
      >
        <Image source={{ uri: item.image }} className="h-44 w-full object-cover bg-slate-900" />
        
        {/* Glow hiệu ứng khi được click */}
        <View className="p-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-2">
              <Text className="text-[16px] text-white" weight="700">
                {item.name}
              </Text>
              <Text className="mt-0.5 text-[12px] text-slate-400">
                {item.address}, {item.district}, {item.city}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg">
              <Star color="#f59e0b" fill="#f59e0b" size={12} />
              <Text className="text-[11px] text-amber-500 font-bold">5.0</Text>
            </View>
          </View>

          {/* Track types tags */}
          <View className="flex-row flex-wrap gap-1.5 mt-3.5">
            {item.trackTypes.map((t, idx) => (
              <View
                key={idx}
                className="rounded-lg bg-orange-600/10 border border-orange-500/20 px-2 py-0.5"
              >
                <Text className="text-[10px] text-[#f97316]" weight="700">
                  {t}
                </Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View className="h-[1px] bg-slate-800/80 my-3.5" />

          <View className="flex-row justify-between items-center">
            {distance !== null ? (
              <View className="flex-row items-center gap-1">
                <MapPin color="#10b981" size={13} />
                <Text className="text-[12px] text-emerald-500 font-semibold">
                  Cách bạn {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1">
                <MapPin color="#64748b" size={13} />
                <Text className="text-[12px] text-slate-400">Không rõ khoảng cách</Text>
              </View>
            )}

            <View className="flex-row items-baseline gap-0.5">
              <Text className="text-[15px] text-[#f97316]" weight="700">
                {item.priceRange.split(' ')[0]}
              </Text>
              <Text className="text-[10px] text-slate-400 font-medium">/slot</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background Glow */}
      <View className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none" />

      {/* Header Title */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-[22px] text-white" weight="700">
          Khám phá chi nhánh
        </Text>
        <Text className="text-[12px] text-slate-400 mt-0.5 font-semibold">
          Tìm kiếm và đặt lịch sân chạy RC của bạn
        </Text>
      </View>

      {/* Tìm kiếm */}
      <View className="mx-5 my-3 flex-row h-11 items-center rounded-xl border border-slate-800 bg-[#0f172a]/60 px-3.5 shadow-sm">
        <Search color="#94a3b8" size={18} />
        <TextInput
          placeholder="Tìm tên chi nhánh..."
          placeholderTextColor="#475569"
          className="ml-2.5 flex-1 text-[13px] text-white font-medium py-0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <RotateCcw color="#94a3b8" size={15} />
          </Pressable>
        )}
      </View>

      {/* Bộ lọc ngang */}
      <View className="mb-4">
        {/* Lọc Thành Phố */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 gap-1.5"
          className="py-1"
        >
          {CITIES.map((city) => {
            const isSelected = selectedCity === city;
            return (
              <Pressable
                key={city}
                onPress={() => setSelectedCity(city)}
                className={`rounded-xl border px-3.5 py-1.5 ${
                  isSelected
                    ? 'border-[#ea580c] bg-[#ea580c]'
                    : 'border-slate-800 bg-[#0f172a]/40'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}
                >
                  {city}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Lọc Track Type */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 gap-1.5 mt-2"
          className="py-1"
        >
          {TRACK_TYPES.map((type) => {
            const isSelected = selectedTrackType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setSelectedTrackType(type)}
                className={`rounded-xl border px-3.5 py-1.5 ${
                  isSelected
                    ? 'border-[#ea580c] bg-[#ea580c]'
                    : 'border-slate-800 bg-[#0f172a]/40'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Danh sách */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : filteredCafes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="size-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 mb-4">
            <Compass color="#64748b" size={28} />
          </View>
          <Text className="text-[15px] text-slate-300 font-bold">Không tìm thấy chi nhánh nào</Text>
          <Text className="text-[11px] text-slate-500 text-center mt-1 leading-4 font-semibold">
            Thử thay đổi từ khoá tìm kiếm hoặc đặt lại các bộ lọc xem sao nhé.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCafes}
          renderItem={renderCafeItem}
          keyExtractor={(item) => item.id}
          contentContainerClassName="pb-24"
          showsVerticalScrollIndicator={false}
          onRefresh={fetchCafes}
          refreshing={loading}
        />
      )}

      {/* Nút nổi Bản đồ */}
      <Pressable
        onPress={handleOpenMap}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-[#ea580c] active:bg-[#f97316] shadow-xl"
        style={{ elevation: 5 }}
      >
        <Map color="#ffffff" size={24} />
      </Pressable>
    </SafeAreaView>
  );
}
