import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, SafeAreaView, TouchableOpacity } from 'react-native';
import { createScrollHandler } from '@/shared/ui/main-tab-events';
import { Trophy, AlertCircle } from 'lucide-react-native';
import { contestsApi } from '../api/contests.api';
import { ContestCard } from '../components/ContestCard';
import type { Contest } from '../types/contests.types';

export const ContestListScreen: React.FC = () => {
  const handleScroll = useRef(createScrollHandler()).current;
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PAST'>('ACTIVE');
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContests = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      // Gọi API lấy toàn bộ giải đấu công khai
      const allContests = await contestsApi.getPublicContests();
      
      // Lọc theo Tab:
      // Tab ACTIVE: OPEN, CLOSED, RUNNING
      // Tab PAST: COMPLETED
      // Backend tự ẩn DRAFT và CANCELLED với role Customer
      const filtered = allContests.filter((c) => {
        if (activeTab === 'ACTIVE') {
          return ['OPEN', 'CLOSED', 'RUNNING'].includes(c.status);
        } else {
          return c.status === 'COMPLETED';
        }
      });
      
      // Sắp xếp: ACTIVE xếp từ ngày bắt đầu gần nhất, PAST xếp từ ngày kết thúc mới nhất
      filtered.sort((a, b) => {
        const dateA = new Date(a.startsAt || 0).getTime();
        const dateB = new Date(b.startsAt || 0).getTime();
        return activeTab === 'ACTIVE' ? dateA - dateB : dateB - dateA;
      });

      setContests(filtered);
    } catch (err) {
      console.error('[ContestListScreen] Error:', err);
      setError('Không thể tải danh sách giải đấu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContests();
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContests(false);
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    return (
      <View className="py-20 px-8 items-center justify-center">
        <Trophy size={48} className="text-gray-300 mb-3" />
        <Text className="text-base font-extrabold text-gray-700 text-center mb-1">
          {activeTab === 'ACTIVE' ? 'Chưa có giải đấu nào đang diễn ra' : 'Chưa có giải đấu nào kết thúc'}
        </Text>
        <Text className="text-xs font-semibold text-gray-400 text-center">
          Hãy quay lại kiểm tra sau hoặc theo dõi thông báo từ RC Field.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header Title */}
      <View className="px-5 py-3 border-b border-gray-50 flex-row justify-between items-center">
        <Text className="text-xl font-extrabold text-gray-900">Giải Đấu RC Field</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-2 border-b border-gray-100/50 bg-gray-50/20">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('ACTIVE')}
          className={`flex-1 py-3 items-center rounded-xl ${
            activeTab === 'ACTIVE' ? 'bg-white shadow-sm border border-gray-100/60' : 'bg-transparent'
          }`}
        >
          <Text
            className={`text-sm ${
              activeTab === 'ACTIVE' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'
            }`}
          >
            Đang & Sắp diễn ra
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('PAST')}
          className={`flex-1 py-3 items-center rounded-xl ${
            activeTab === 'PAST' ? 'bg-white shadow-sm border border-gray-100/60' : 'bg-transparent'
          }`}
        >
          <Text
            className={`text-sm ${
              activeTab === 'PAST' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'
            }`}
          >
            Đã kết thúc
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View className="m-4 flex-row items-center bg-red-50 border border-red-100 p-3 rounded-xl">
          <AlertCircle size={16} className="text-red-500 mr-2" />
          <Text className="text-xs font-bold text-red-600 flex-1">{error}</Text>
        </View>
      )}

      {/* Content List */}
      {loading && contests.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ea580c" />
        </View>
      ) : (
        <FlatList
          data={contests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContestCard contest={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={renderEmptyComponent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
          }
        />
      )}
    </SafeAreaView>
  );
};
