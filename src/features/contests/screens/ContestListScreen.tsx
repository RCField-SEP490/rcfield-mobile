import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, SafeAreaView, Pressable, StyleSheet, ScrollView } from 'react-native';
import { createScrollHandler } from '@/shared/ui/main-tab-events';
import { Trophy, AlertCircle } from 'lucide-react-native';
import { contestsApi } from '../api/contests.api';
import { ContestCard } from '../components/ContestCard';
import type { Contest } from '../types/contests.types';

type ContestTabKey = 'ALL' | 'OPEN_RUNNING' | 'UPCOMING' | 'PAST';

interface ContestTabConfig {
  key: ContestTabKey;
  label: string;
}

const CONTEST_TABS: ContestTabConfig[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'OPEN_RUNNING', label: 'Đang diễn ra / Mở đăng ký' },
  { key: 'UPCOMING', label: 'Sắp mở đăng ký' },
  { key: 'PAST', label: 'Đã kết thúc' },
];

export const ContestListScreen: React.FC = () => {
  const handleScroll = useRef(createScrollHandler()).current;
  const [activeTab, setActiveTab] = useState<ContestTabKey>('ALL');
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
      const now = new Date();
      
      // Lọc theo Tab được chọn
      const filtered = allContests.filter((c) => {
        const regOpensAt = c.registration_opens_at ? new Date(c.registration_opens_at) : null;
        
        switch (activeTab) {
          case 'ALL':
            return true;
          case 'OPEN_RUNNING':
            // Đang thi đấu (RUNNING) hoặc Đang mở đăng ký (OPEN và thời gian mở đã qua hoặc không định nghĩa)
            if (c.status === 'RUNNING') return true;
            if (c.status === 'OPEN') {
              if (!regOpensAt) return true;
              return regOpensAt <= now;
            }
            return false;
          case 'UPCOMING':
            // Sắp mở đăng ký (status OPEN và regOpensAt ở tương lai)
            if (c.status === 'OPEN' && regOpensAt && regOpensAt > now) {
              return true;
            }
            return false;
          case 'PAST':
            // Đã kết thúc (COMPLETED)
            return c.status === 'COMPLETED';
          default:
            return true;
        }
      });
      
      // Sắp xếp: Mới nhất lên đầu
      filtered.sort((a, b) => {
        const dateA = new Date(a.starts_at || 0).getTime();
        const dateB = new Date(b.starts_at || 0).getTime();
        return dateB - dateA;
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

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'OPEN_RUNNING':
        return 'Chưa có giải đấu nào đang diễn ra hoặc mở đăng ký';
      case 'UPCOMING':
        return 'Chưa có giải đấu nào sắp mở đăng ký';
      case 'PAST':
        return 'Chưa có giải đấu nào kết thúc';
      default:
        return 'Chưa có giải đấu nào được công bố';
    }
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    return (
      <View className="py-20 px-8 items-center justify-center">
        <Trophy size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
        <Text className="text-base font-extrabold text-gray-700 text-center mb-1">
          {getEmptyMessage()}
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

      {/* Tabs Switcher using horizontal scroll view */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
      >
        {CONTEST_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabItem,
                isActive ? styles.tabItemActive : styles.tabItemInactive
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive ? styles.tabTextActive : styles.tabTextInactive
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Error Message */}
      {error && (
        <View className="m-4 flex-row items-center bg-red-50 border border-red-100 p-3 rounded-xl">
          <AlertCircle size={16} color="#ef4444" style={{ marginRight: 8 }} />
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

const styles = StyleSheet.create({
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.8)',
    backgroundColor: '#ffffff',
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  tabItemInactive: {
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  tabText: {
    fontSize: 12,
  },
  tabTextActive: {
    fontWeight: '800',
    color: '#ea580c',
  },
  tabTextInactive: {
    fontWeight: '600',
    color: '#64748b',
  },
});
