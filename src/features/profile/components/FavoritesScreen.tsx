import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Star, MapPin, Compass } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { useAuthStore } from '@/shared/store/auth-store';
import { getCafes } from '@/features/explore/api/explore.api';
import { favoriteApi, favoriteLocal } from '@/features/explore/api/favorite.api';
import type { Cafe } from '@/features/explore/types/explore.types';

export function FavoritesScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [favorites, setFavorites] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      // 1. Lấy tất cả cafe
      const allCafes = await getCafes();

      // 2. Lấy danh sách favorite ids
      let favIds = await favoriteLocal.getLocalFavorites();
      if (isAuthenticated) {
        try {
          const dbFavs = await favoriteApi.getFavorites();
          favIds = dbFavs;
          await favoriteLocal.setLocalFavorites(dbFavs);
        } catch (e) {
          console.warn('[FavoritesScreen] Failed to fetch server favorites, using local:', e);
        }
      }

      setFavoriteIds(favIds);

      // 3. Lọc danh sách cafe
      const filtered = allCafes.filter((c) => favIds.includes(c.id));
      setFavorites(filtered);
    } catch (error) {
      console.error('[FavoritesScreen] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [isAuthenticated]);

  // Xử lý Bỏ thích nhanh (Unfavorite)
  const handleRemoveFavorite = async (cafeId: string) => {
    // Optimistic Update
    const updatedIds = favoriteIds.filter((id) => id !== cafeId);
    setFavoriteIds(updatedIds);
    setFavorites((prev) => prev.filter((c) => c.id !== cafeId));

    try {
      await favoriteLocal.setLocalFavorites(updatedIds);
      if (isAuthenticated) {
        await favoriteApi.removeFavorite(cafeId);
      }
    } catch (e) {
      console.error('[FavoritesScreen] Remove favorite error:', e);
      // Rollback
      await fetchFavorites();
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái yêu thích.');
    }
  };

  const renderItem = ({ item }: { item: Cafe }) => {
    return (
      <View
        className="mx-5 mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]/60 shadow-md"
      >
        <Pressable
          onPress={() => router.push(`/cafe-detail/${item.id}` as any)}
          className="relative h-40 w-full bg-slate-900"
        >
          <Image source={{ uri: item.image }} className="h-full w-full object-cover" />
          <Pressable
            onPress={() => handleRemoveFavorite(item.id)}
            className="absolute top-3 right-3 size-9 items-center justify-center rounded-full bg-black/40 active:bg-black/60"
          >
            <Heart color="#ef4444" fill="#ef4444" size={18} />
          </Pressable>
        </Pressable>

        <View className="p-4">
          <View className="flex-row justify-between items-start">
            <Pressable
              onPress={() => router.push(`/cafe-detail/${item.id}` as any)}
              className="flex-1 pr-2"
            >
              <Text className="text-[15px] text-white" weight="700">
                {item.name}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin color="#94a3b8" size={12} />
                <Text className="text-[11px] text-slate-400 leading-4" numberOfLines={1}>
                  {item.district}, {item.city}
                </Text>
              </View>
            </Pressable>
            <View className="flex-row items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg">
              <Star color="#f59e0b" fill="#f59e0b" size={11} />
              <Text className="text-[11px] text-amber-500 font-bold">
                {item.rating > 0 ? item.rating.toFixed(1) : '5.0'}
              </Text>
            </View>
          </View>

          {/* Bottom Bar: Price & CTA */}
          <View className="flex-row justify-between items-center mt-4 border-t border-slate-800/80 pt-3">
            <View>
              <Text className="text-[9px] text-slate-500 font-bold uppercase">Giá slot</Text>
              <Text className="text-[13px] text-[#f97316] font-bold mt-0.5">{item.priceRange.split(' ')[0]}đ</Text>
            </View>

            <Pressable
              onPress={() => router.push(`/booking/create?cafeId=${item.id}` as any)}
              className="px-4 py-2 bg-[#ea580c] active:bg-[#f97316] rounded-xl"
            >
              <Text className="text-[11px] text-white font-bold uppercase tracking-wider">Đặt lịch</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background Glow */}
      <View className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#f97316]/5 blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-900 bg-[#0f172a]/50">
        <Pressable
          onPress={() => router.back()}
          className="p-1 rounded-full active:bg-slate-800 flex-row items-center gap-1"
        >
          <ChevronLeft color="#f97316" size={20} />
          <Text className="text-[12px] text-[#f97316] font-bold">Quay lại</Text>
        </Pressable>
        <Text className="text-[14px] text-white flex-1 text-center font-bold mr-10">
          Cơ sở yêu thích
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : favorites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="size-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 mb-4">
            <Compass color="#64748b" size={28} />
          </View>
          <Text className="text-[15px] text-slate-300 font-bold">Danh sách trống</Text>
          <Text className="text-[11px] text-slate-500 text-center mt-1 leading-4 font-semibold">
            Bấm vào biểu tượng trái tim ở các chi nhánh trên Explore để lưu lại danh sách yêu thích của bạn nhé!
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerClassName="py-4 pb-24"
          showsVerticalScrollIndicator={false}
          onRefresh={fetchFavorites}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}
