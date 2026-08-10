import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, Pressable, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Award, ShieldAlert, BadgeInfo, Trophy, CreditCard, Flag, Users } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { contestsApi } from '../api/contests.api';
import { TournamentBracket } from '../components/TournamentBracket';
import type { Contest, ContestMatch } from '../types/contests.types';

WebBrowser.maybeCompleteAuthSession();

type SubTabKey = 'INFO' | 'BRACKET' | 'LEADERBOARD';

export const ContestDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [matches, setMatches] = useState<ContestMatch[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('INFO');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContestData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await contestsApi.getContestDetail(id);
      setContest(detail);

      // Nếu giải đấu đã bốc thăm, tải các trận đấu
      if (detail && detail.status !== 'DRAFT') {
        const matchData = await contestsApi.getContestMatches(id);
        setMatches(matchData);
      }
    } catch (error) {
      console.error('[ContestDetailScreen] Error fetching data:', error);
      Alert.alert('Lỗi', 'Không thể tải chi tiết giải đấu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContestData();
  }, [id]);

  const handleRegisterPress = () => {
    if (!contest) return;
    router.push(`/customer/contest-register/${contest.id}` as any);
  };

  const handlePaymentPress = async () => {
    const regId = contest?.my_registration?.id;
    if (!regId) return;

    setActionLoading(true);
    try {
      const returnUrl = 'rcfield://payment-return';
      const result = await contestsApi.createEntryFeePayment(regId, returnUrl);
      
      if (result && result.payment_url) {
        await WebBrowser.openBrowserAsync(result.payment_url);
        fetchContestData();
      } else {
        Alert.alert('Thất bại', 'Không thể tạo liên kết thanh toán VNPay.');
      }
    } catch (error) {
      console.error('[ContestDetailScreen] Payment error:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi trong quá trình xử lý thanh toán.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price === undefined || price === null) return 'Miễn phí';
    if (price === 0) return 'Miễn phí';
    return `${price.toLocaleString('vi-VN')} VND`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Chưa định ngày';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'Chưa định ngày';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPastDate = (dateString: string | null) => {
    if (!dateString) return false;
    return new Date(dateString) <= new Date();
  };

  // Trích xuất danh sách avatar tay đua đăng ký từ danh sách trận đấu
  const topEntrants = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    matches.forEach((match) => {
      match.participants.forEach((p) => {
        if (p.registration_id) {
          const regId = p.registration?.id || p.registration_id;
          const name = p.registration?.participant_name || p.fullName || 'Racer';
          const avatar = p.registration?.participant_avatar_url || null;
          if (name !== 'Chờ vòng trước' && name !== 'Không có đối thủ') {
            map.set(regId, { name, avatar });
          }
        }
      });
    });
    return Array.from(map.values()).slice(0, 5);
  }, [matches]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (!contest) {
    return (
      <View style={styles.errorContainer}>
        <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: 12 }} />
        <Text className="text-base font-extrabold text-gray-800 text-center">Không tìm thấy giải đấu</Text>
        <Text className="text-xs font-semibold text-gray-400 text-center mt-1">Giải đấu có thể đã bị xóa hoặc không khả dụng.</Text>
      </View>
    );
  }

  const defaultBanner = 'https://images.unsplash.com/photo-1568605117036-5fecc6207a71?auto=format&fit=crop&w=600&q=80';
  const myReg = contest.my_registration;
  const branchName = contest.host_branch?.cafe?.name || 'RC Field Branch';
  const trackImage = contest.track_type?.image_url || contest.config?.track_image_url || contest.track_type?.layout_image_url || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {/* Toàn bộ nội dung cuộn trang đồng bộ */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Banner & Title Glass Card lồng đè lên nhau */}
          <View style={styles.bannerContainer}>
            <Image
              source={contest.banner_image_url ? { uri: contest.banner_image_url } : { uri: defaultBanner }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            {/* Nút quay lại */}
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>

            {/* Title Glass Card lơ lửng đè lên Banner */}
            <View style={styles.headerGlassCard}>
              <Text style={styles.headerTitle}>{contest.name}</Text>
              <View style={styles.headerMetaRow}>
                <View style={styles.headerMetaItem}>
                  <MapPin size={10} color="#ea580c" style={{ marginRight: 4 }} />
                  <Text style={styles.headerMetaText} numberOfLines={1}>{branchName}</Text>
                </View>
                <View style={styles.headerMetaItem}>
                  <Calendar size={10} color="#ea580c" style={{ marginRight: 4 }} />
                  <Text style={styles.headerMetaText}>{formatDate(contest.starts_at)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sub Tabs Switcher */}
          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => setActiveSubTab('INFO')}
              style={[styles.tabItem, activeSubTab === 'INFO' ? styles.tabItemActive : styles.tabItemInactive]}
            >
              <Text style={[styles.tabText, activeSubTab === 'INFO' ? styles.tabTextActive : styles.tabTextInactive]}>
                Thông tin
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveSubTab('BRACKET')}
              style={[styles.tabItem, activeSubTab === 'BRACKET' ? styles.tabItemActive : styles.tabItemInactive]}
            >
              <Text style={[styles.tabText, activeSubTab === 'BRACKET' ? styles.tabTextActive : styles.tabTextInactive]}>
                Sơ đồ đấu
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveSubTab('LEADERBOARD')}
              style={[styles.tabItem, activeSubTab === 'LEADERBOARD' ? styles.tabItemActive : styles.tabItemInactive]}
            >
              <Text style={[styles.tabText, activeSubTab === 'LEADERBOARD' ? styles.tabTextActive : styles.tabTextInactive]}>
                Bảng xếp hạng
              </Text>
            </Pressable>
          </View>

          {/* Tab Content Area */}
          <View style={{ padding: 16 }}>
            {activeSubTab === 'INFO' && (
              <View>
                {/* 1. Quick Stats Grid - Thể hiện Lệ phí và Danh sách Tay đua Avatar Overlap */}
                <View style={styles.statsGrid}>
                  {/* Lệ phí */}
                  <View style={styles.statsCardSmall}>
                    <View style={styles.statsIconWrapper}>
                      <CreditCard size={16} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statsLabel}>Lệ phí</Text>
                      <Text style={styles.statsValue}>{formatPrice(contest.entry_fee)}</Text>
                    </View>
                  </View>

                  {/* Danh sách người chơi Đăng ký (Overlap Avatars) */}
                  <View style={styles.statsCardLong}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statsLabel}>Đã đăng ký</Text>
                      <Text style={styles.statsValue}>
                        {contest.public_stats?.registration_count || 0} / {contest.capacity || '∞'} VĐV
                      </Text>
                    </View>

                    {topEntrants.length > 0 && (
                      <View style={styles.avatarOverlapContainer}>
                        {topEntrants.map((entrant, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.avatarBubble,
                              { marginLeft: idx === 0 ? 0 : -10, zIndex: idx }
                            ]}
                          >
                            {entrant.avatar ? (
                              <Image source={{ uri: entrant.avatar }} style={styles.avatarImage} />
                            ) : (
                              <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarPlaceholderText}>
                                  {entrant.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                        {contest.public_stats?.registration_count && contest.public_stats.registration_count > topEntrants.length && (
                          <View style={[styles.avatarMoreBadge, { zIndex: topEntrants.length }]}>
                            <Text style={styles.avatarMoreText}>
                              +{contest.public_stats.registration_count - topEntrants.length}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* 2. Description Section */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Giới thiệu giải đấu</Text>
                  <Text style={styles.sectionBody}>
                    {contest.description || 'Chưa có thông tin mô tả chi tiết cho giải đấu này.'}
                  </Text>
                </View>

                {/* 3. Rules & Vehicles Section (Quy chế - Ý tưởng 3) */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Quy chế & Dòng xe thi đấu</Text>
                  <View style={styles.ruleCardList}>
                    {/* Thể thức */}
                    <View style={styles.ruleItem}>
                      <View style={styles.ruleBullet} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTextTitle}>Thể thức thi đấu</Text>
                        <Text style={styles.ruleTextDesc}>
                          {contest.contest_format?.name || 'Đấu loại trực tiếp 1v1 (Knockout)'}
                        </Text>
                      </View>
                    </View>

                    {/* Quy định xe */}
                    <View style={styles.ruleItem}>
                      <View style={styles.ruleBullet} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTextTitle}>Quy định dòng xe</Text>
                        <Text style={styles.ruleTextDesc}>
                          {contest.vehicle_rule?.vehicle_policy === 'RENTAL_ONLY' ? 'Chỉ sử dụng xe thuê của cơ sở.' :
                           contest.vehicle_rule?.vehicle_policy === 'BYOC_ONLY' ? 'Chỉ sử dụng xe cá nhân tự mang theo (BYOC).' :
                           'Hỗn hợp (MIXED) - Sử dụng xe thuê hoặc xe cá nhân tùy chọn.'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 4. Track Information Section (Lá cờ fallback hoặc Ảnh đường đua thực tế) */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Thông tin đường đua</Text>
                  <View style={styles.trackCard}>
                    {trackImage ? (
                      <Image source={{ uri: trackImage }} style={styles.trackImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.trackIconWrapper}>
                        <Flag size={20} color="#ea580c" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trackName}>{contest.track_type?.name || 'Đường đua RC Field'}</Text>
                      <Text style={styles.trackDesc}>
                        {contest.track_type?.description || 'Đường đua chuyên nghiệp được thiết kế với các góc cua kỹ thuật khó, phù hợp với các giải đấu đối kháng đỉnh cao.'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 5. Horizontal Timeline Progress Bar (Lịch trình nằm ngang) */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Tiến trình giải đấu</Text>
                  <View style={styles.horizTimelineContainer}>
                    <View style={styles.horizTimelineLineBg} />
                    <View 
                      style={[
                        styles.horizTimelineLineActive,
                        {
                          width: isPastDate(contest.ends_at) ? '100%' :
                                 isPastDate(contest.starts_at) ? '66%' :
                                 isPastDate(contest.registration_closes_at) ? '33%' : '0%'
                        }
                      ]}
                    />

                    {/* Mốc 1: Mở đăng ký */}
                    <View style={styles.horizTimelineStep}>
                      <View style={[styles.horizTimelineDot, isPastDate(contest.registration_opens_at) ? styles.horizTimelineDotActive : styles.horizTimelineDotInactive]}>
                        <Text style={[styles.horizTimelineStepNum, isPastDate(contest.registration_opens_at) && styles.horizTimelineStepNumActive]}>1</Text>
                      </View>
                      <Text style={styles.horizTimelineLabel}>Mở Đăng Ký</Text>
                      <Text style={styles.horizTimelineTime}>{formatDateShort(contest.registration_opens_at)}</Text>
                    </View>

                    {/* Mốc 2: Đóng đăng ký */}
                    <View style={styles.horizTimelineStep}>
                      <View style={[styles.horizTimelineDot, isPastDate(contest.registration_closes_at) ? styles.horizTimelineDotActive : styles.horizTimelineDotInactive]}>
                        <Text style={[styles.horizTimelineStepNum, isPastDate(contest.registration_closes_at) && styles.horizTimelineStepNumActive]}>2</Text>
                      </View>
                      <Text style={styles.horizTimelineLabel}>Đóng Đăng Ký</Text>
                      <Text style={styles.horizTimelineTime}>{formatDateShort(contest.registration_closes_at)}</Text>
                    </View>

                    {/* Mốc 3: Khai mạc */}
                    <View style={styles.horizTimelineStep}>
                      <View style={[styles.horizTimelineDot, isPastDate(contest.starts_at) ? styles.horizTimelineDotActive : styles.horizTimelineDotInactive]}>
                        <Text style={[styles.horizTimelineStepNum, isPastDate(contest.starts_at) && styles.horizTimelineStepNumActive]}>3</Text>
                      </View>
                      <Text style={styles.horizTimelineLabel}>Khởi Tranh</Text>
                      <Text style={styles.horizTimelineTime}>{formatDateShort(contest.starts_at)}</Text>
                    </View>

                    {/* Mốc 4: Kết thúc */}
                    <View style={styles.horizTimelineStep}>
                      <View style={[styles.horizTimelineDot, isPastDate(contest.ends_at) ? styles.horizTimelineDotActive : styles.horizTimelineDotInactive]}>
                        <Text style={[styles.horizTimelineStepNum, isPastDate(contest.ends_at) && styles.horizTimelineStepNumActive]}>4</Text>
                      </View>
                      <Text style={styles.horizTimelineLabel}>Kết Thúc</Text>
                      <Text style={styles.horizTimelineTime}>{formatDateShort(contest.ends_at)}</Text>
                    </View>
                  </View>
                </View>

                {/* 6. Prizes Horizontal Carousel (Carousel giải thưởng nằm ngang - Ý tưởng 2) */}
                {contest.prize_structure && contest.prize_structure.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Cơ cấu giải thưởng</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.prizesCarouselContent}
                    >
                      {contest.prize_structure.map((prize: any, idx: number) => {
                        const rank = prize.rank || (idx + 1);
                        let cardBg = '#f8fafc';
                        let borderColor = '#e2e8f0';
                        let badgeBg = '#e2e8f0';
                        let badgeTextColor = '#475569';
                        let iconColor = '#64748b';

                        if (rank === 1) {
                          cardBg = '#fffbeb';
                          borderColor = '#fde68a';
                          badgeBg = '#fef3c7';
                          badgeTextColor = '#b45309';
                          iconColor = '#fbbf24';
                        } else if (rank === 2) {
                          cardBg = '#f1f5f9';
                          borderColor = '#cbd5e1';
                          badgeBg = '#e2e8f0';
                          badgeTextColor = '#334155';
                          iconColor = '#94a3b8';
                        } else if (rank === 3) {
                          cardBg = '#faf5ff';
                          borderColor = '#e9d5ff';
                          badgeBg = '#f3e8ff';
                          badgeTextColor = '#6b21a8';
                          iconColor = '#a855f7';
                        }

                        return (
                          <View key={idx} style={[styles.prizeCardCarousel, { backgroundColor: cardBg, borderColor }]}>
                            <View style={[styles.prizeBadge, { backgroundColor: badgeBg }]}>
                              <Award size={20} color={iconColor} />
                            </View>
                            <Text style={[styles.prizeRankLabel, { color: badgeTextColor }]}>Hạng {rank}</Text>
                            <Text style={styles.prizeTitle} numberOfLines={1}>{prize.title}</Text>
                            <Text style={styles.prizeDesc} numberOfLines={2}>{prize.description}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {activeSubTab === 'BRACKET' && (
              <View>
                <TournamentBracket matches={matches} />
              </View>
            )}

            {activeSubTab === 'LEADERBOARD' && (
              <View>
                <Text className="text-sm font-extrabold text-gray-900 mb-3">Kết quả chung cuộc</Text>
                
                {contest.published_leaderboard?.entries && contest.published_leaderboard.entries.length > 0 ? (
                  <View className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50 bg-white">
                    {contest.published_leaderboard.entries.map((entry) => (
                      <View key={entry.registration_id} className="flex-row items-center p-3">
                        {/* Rank Number */}
                        <View className="h-6 w-6 rounded-full bg-gray-100 items-center justify-center mr-3">
                          <Text className={`text-xs font-extrabold ${entry.rank <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                            {entry.rank}
                          </Text>
                        </View>
                        {/* Driver Name */}
                        <View className="flex-1">
                          <Text className="text-xs font-extrabold text-gray-800">
                            {entry.display_name || entry.driver_handle || `Tay đua #${entry.registration_id.substring(0, 6).toUpperCase()}`}
                          </Text>
                          <Text className="text-[10px] font-semibold text-gray-400">
                            {contest.config?.format === 'TIME_TRIAL'
                              ? `Best Lap: ${((entry.best_lap_ms || (entry.best_lap_seconds ? entry.best_lap_seconds * 1000 : 0)) / 1000).toFixed(2)}s`
                              : `Wins: ${entry.wins} trận`}
                          </Text>
                        </View>
                        {/* Badge Trophy */}
                        {entry.rank === 1 && <Trophy size={16} color="#f59e0b" />}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <Trophy size={36} color="#d1d5db" style={{ alignSelf: 'center', marginBottom: 8 }} />
                    <Text className="text-xs font-bold text-gray-400 italic text-center">Bảng xếp hạng sẽ được công bố khi giải đấu kết thúc.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Bar: Action Register / Payment / Status */}
        <View className="p-4 border-t border-gray-100 bg-white">
          {/* Trường hợp Chưa đăng ký và giải đang mở */}
          {!myReg && contest.status === 'OPEN' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRegisterPress}
              className="w-full bg-orange-600 py-3.5 rounded-xl items-center justify-center shadow-sm"
            >
              <Text className="text-sm font-extrabold text-white">ĐĂNG KÝ THAM GIA ({formatPrice(contest.entry_fee)})</Text>
            </TouchableOpacity>
          )}

          {/* Trường hợp Đã đăng ký nhưng Chưa đóng lệ phí */}
          {myReg && myReg.status !== 'CANCELLED' && myReg.payment_status === 'PENDING_PAYMENT' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePaymentPress}
              disabled={actionLoading}
              className="w-full bg-emerald-600 py-3.5 rounded-xl flex-row items-center justify-center shadow-sm"
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <CreditCard size={16} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text className="text-sm font-extrabold text-white">THANH TOÁN LỆ PHÍ VNPAY</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Trường hợp Đã xác nhận / Đang thi đấu */}
          {myReg && myReg.status !== 'CANCELLED' && myReg.payment_status !== 'PENDING_PAYMENT' && (
            <View className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl flex-row justify-between items-center">
              <View>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái của bạn</Text>
                <Text className="text-xs font-extrabold text-gray-800">
                  {myReg.status === 'CONFIRMED' ? 'Đã đăng ký (Chờ thi đấu)' : 
                   myReg.status === 'CHECKED_IN' ? 'Đã điểm danh (Sẵn sàng đấu)' : 
                   'Chờ Ban tổ chức phê duyệt'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/customer/my-contests' as any)}
                className="bg-orange-50 border border-orange-100/80 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-[10px] font-extrabold text-orange-600">Xem vé / QR</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Giải đấu đã đóng đăng ký / Đang chạy / Đã xong mà khách chưa đăng ký */}
          {!myReg && contest.status !== 'OPEN' && (
            <View className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl items-center justify-center">
              <Text className="text-xs font-bold text-gray-400 italic">
                {contest.status === 'COMPLETED' ? 'Giải đấu đã kết thúc' : 'Đã hết thời gian đăng ký giải đấu này.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  bannerContainer: {
    position: 'relative',
    height: 240,
    width: '100%',
    backgroundColor: '#f1f5f9',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerGlassCard: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 18,
    marginBottom: 6,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '50%',
  },
  headerMetaText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabItemActive: {
    borderBottomColor: '#ea580c',
  },
  tabItemInactive: {
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
  },
  tabTextActive: {
    fontWeight: '800',
    color: '#0f172a',
  },
  tabTextInactive: {
    fontWeight: '600',
    color: '#94a3b8',
  },
  // Các style mới cho Tab Info
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statsCardSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  statsCardLong: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
  },
  statsIconWrapper: {
    height: 32,
    width: 32,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  avatarOverlapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarPlaceholder: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdba74',
  },
  avatarPlaceholderText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  avatarMoreBadge: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  avatarMoreText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ea580c',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
  },
  ruleCardList: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ruleBullet: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c',
    marginTop: 6,
  },
  ruleTextTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c2d12',
    marginBottom: 2,
  },
  ruleTextDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9a3412',
    lineHeight: 15,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  trackIconWrapper: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackImage: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  trackName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
  },
  trackDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 16,
  },
  prizesCarouselContent: {
    paddingRight: 16,
    gap: 12,
  },
  prizeCardCarousel: {
    width: 180,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
  },
  prizeBadge: {
    height: 32,
    width: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  prizeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
    width: '100%',
  },
  prizeDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    width: '100%',
    lineHeight: 14,
  },
  prizeRankLabel: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Style cho Horizontal Timeline
  horizTimelineContainer: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  horizTimelineLineBg: {
    position: 'absolute',
    top: 32,
    left: 40,
    right: 40,
    height: 3,
    backgroundColor: '#cbd5e1',
  },
  horizTimelineLineActive: {
    position: 'absolute',
    top: 32,
    left: 40,
    height: 3,
    backgroundColor: '#ea580c',
  },
  horizTimelineStep: {
    flex: 1,
    alignItems: 'center',
  },
  horizTimelineDot: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 2,
    marginBottom: 8,
  },
  horizTimelineDotActive: {
    borderColor: '#ea580c',
    backgroundColor: '#ea580c',
  },
  horizTimelineDotInactive: {
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  horizTimelineStepNum: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  horizTimelineStepNumActive: {
    color: '#ffffff',
  },
  horizTimelineLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 2,
    textAlign: 'center',
  },
  horizTimelineTime: {
    fontSize: 8,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
});
