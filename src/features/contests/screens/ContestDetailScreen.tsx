import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Award, ShieldAlert, BadgeInfo, Trophy, CreditCard } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { contestsApi } from '../api/contests.api';
import { TournamentBracket } from '../components/TournamentBracket';
import type { Contest, ContestMatch } from '../types/contests.types';

// Cho phép WebBrowser lắng nghe link redirect từ VNPay
WebBrowser.maybeCompleteAuthSession();

export const ContestDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [matches, setMatches] = useState<ContestMatch[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'INFO' | 'BRACKET' | 'LEADERBOARD'>('INFO');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContestData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await contestsApi.getContestDetail(id);
      setContest(detail);

      // Nếu giải đấu không ở trạng thái DRAFT và đã bốc thăm, tải các trận đấu
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
      // Gọi API tạo link thanh toán VNPay
      // URL return được định cấu hình sâu trong Expo Linking (ví dụ: rcfield://payment-return)
      const returnUrl = 'rcfield://payment-return';
      const result = await contestsApi.createEntryFeePayment(regId, returnUrl);
      
      if (result && result.payment_url) {
        // Mở cổng thanh toán trên trình duyệt web bảo mật tích hợp
        const response = await WebBrowser.openBrowserAsync(result.payment_url);
        
        // Sau khi khách hàng đóng trình duyệt (hoặc VNPay redirect quay lại app)
        // Chúng ta reload lại dữ liệu giải đấu để cập nhật trạng thái
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (!contest) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <ShieldAlert size={48} className="text-red-500 mb-3" />
        <Text className="text-base font-extrabold text-gray-800 text-center">Không tìm thấy giải đấu</Text>
        <Text className="text-xs font-semibold text-gray-400 text-center mt-1">Giải đấu có thể đã bị xóa hoặc không khả dụng.</Text>
      </View>
    );
  }

  const defaultBanner = 'https://images.unsplash.com/photo-1568605117036-5fecc6207a71?auto=format&fit=crop&w=600&q=80';
  const myReg = contest.my_registration;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Banner */}
      <View className="relative h-48 w-full bg-gray-100">
        <Image
          source={contest.bannerImageUrl ? { uri: contest.bannerImageUrl } : { uri: defaultBanner }}
          className="h-full w-full object-cover"
          resizeMode="cover"
        />
        {/* Nút quay lại */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          className="absolute left-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/40"
        >
          <Text className="text-lg font-bold text-white">←</Text>
        </TouchableOpacity>
      </View>

      {/* Title & Cafe Info */}
      <View className="p-4 border-b border-gray-100/50">
        <Text className="text-lg font-extrabold text-gray-900 leading-tight mb-2">
          {contest.name}
        </Text>
        
        <View className="flex-row items-center mb-1">
          <MapPin size={12} className="text-gray-400 mr-1.5" />
          <Text className="text-xs font-semibold text-gray-600">Địa điểm tổ chức: RC Field Chi nhánh chính</Text>
        </View>

        <View className="flex-row items-center">
          <Calendar size={12} className="text-gray-400 mr-1.5" />
          <Text className="text-xs font-semibold text-gray-600">Thời gian bắt đầu: {formatDate(contest.startsAt)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-100 bg-gray-50/10">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveSubTab('INFO')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeSubTab === 'INFO' ? 'border-orange-500' : 'border-transparent'
          }`}
        >
          <Text className={`text-xs ${activeSubTab === 'INFO' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'}`}>
            Thông tin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveSubTab('BRACKET')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeSubTab === 'BRACKET' ? 'border-orange-500' : 'border-transparent'
          }`}
        >
          <Text className={`text-xs ${activeSubTab === 'BRACKET' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'}`}>
            Sơ đồ đấu
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveSubTab('LEADERBOARD')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeSubTab === 'LEADERBOARD' ? 'border-orange-500' : 'border-transparent'
          }`}
        >
          <Text className={`text-xs ${activeSubTab === 'LEADERBOARD' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-400'}`}>
            Bảng xếp hạng
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View className="flex-1">
        {activeSubTab === 'INFO' && (
          <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
            {/* Description */}
            <View className="mb-4">
              <Text className="text-sm font-extrabold text-gray-900 mb-1">Giới thiệu giải đấu</Text>
              <Text className="text-xs font-semibold text-gray-600 leading-relaxed">
                {contest.description || 'Chưa có thông tin mô tả chi tiết cho giải đấu này.'}
              </Text>
            </View>

            {/* Rules */}
            <View className="mb-4 p-3 rounded-xl bg-orange-50/50 border border-orange-100/50">
              <View className="flex-row items-center mb-1.5">
                <BadgeInfo size={14} className="text-orange-600 mr-1.5" />
                <Text className="text-xs font-extrabold text-orange-900">Quy chế & Dòng xe thi đấu</Text>
              </View>
              <Text className="text-[11px] font-semibold text-orange-800 leading-relaxed">
                • Thể thức thi đấu: Đấu loại trực tiếp 1v1 (Knockout).{'\n'}
                • Quy định xe: {
                  contest.vehicleRule?.vehicle_policy === 'RENTAL_ONLY' ? 'Chỉ sử dụng xe thuê của cơ sở.' :
                  contest.vehicleRule?.vehicle_policy === 'BYOC_ONLY' ? 'Chỉ sử dụng xe cá nhân (BYOC).' :
                  'Tùy chọn: Sử dụng xe thuê hoặc xe cá nhân tự mang (MIXED).'
                }
              </Text>
            </View>

            {/* Prize list */}
            {contest.config?.prizes && contest.config.prizes.length > 0 && (
              <View className="mb-4">
                <Text className="text-sm font-extrabold text-gray-900 mb-2">Cơ cấu giải thưởng</Text>
                <View className="space-y-2">
                  {contest.config.prizes.map((prize, idx) => (
                    <View key={idx} className="flex-row items-center p-3 rounded-xl border border-gray-100 bg-gray-50/30">
                      <Award size={18} className="text-amber-500 mr-2.5" />
                      <View className="flex-1">
                        <Text className="text-xs font-extrabold text-gray-800">{prize.title}</Text>
                        <Text className="text-[10px] font-semibold text-gray-500">{prize.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Empty block for padding scroll */}
            <View className="h-10" />
          </ScrollView>
        )}

        {activeSubTab === 'BRACKET' && (
          <View className="flex-1 p-3">
            <TournamentBracket matches={matches} />
          </View>
        )}

        {activeSubTab === 'LEADERBOARD' && (
          <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
            <Text className="text-sm font-extrabold text-gray-900 mb-3">Kết quả chung cuộc</Text>
            
            {contest.config?.published_leaderboard?.entries && contest.config.published_leaderboard.entries.length > 0 ? (
              <View className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
                {contest.config.published_leaderboard.entries.map((entry) => (
                  <View key={entry.registration_id} className="flex-row items-center p-3 bg-white">
                    {/* Rank Number */}
                    <View className="h-6 w-6 rounded-full bg-gray-100 items-center justify-center mr-3">
                      <Text className={`text-xs font-extrabold ${entry.rank <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {entry.rank}
                      </Text>
                    </View>
                    {/* Driver Name */}
                    <View className="flex-1">
                      <Text className="text-xs font-extrabold text-gray-800">{entry.display_name}</Text>
                      <Text className="text-[10px] font-semibold text-gray-400">Wins: {entry.wins} trận</Text>
                    </View>
                    {/* Badge Trophy */}
                    {entry.rank === 1 && <Trophy size={16} className="text-amber-500" />}
                  </View>
                ))}
              </View>
            ) : (
              <View className="py-12 items-center justify-center">
                <Trophy size={36} className="text-gray-300 mb-2" />
                <Text className="text-xs font-bold text-gray-400 italic text-center">Bảng xếp hạng sẽ được công bố khi giải đấu kết thúc.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Bottom Bar: Action Register / Payment / Status */}
      <View className="p-4 border-t border-gray-100 bg-white">
        {/* Trường hợp Chưa đăng ký và giải đang mở */}
        {!myReg && contest.status === 'OPEN' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRegisterPress}
            className="w-full bg-orange-600 py-3.5 rounded-xl items-center justify-center shadow-sm"
          >
            <Text className="text-sm font-extrabold text-white">ĐĂNG KÝ THAM GIA ({formatPrice(contest.entryFee)})</Text>
          </TouchableOpacity>
        )}

        {/* Trường hợp Đã đăng ký nhưng Chưa đóng lệ phí */}
        {myReg && myReg.status !== 'CANCELLED' && myReg.paymentStatus === 'PENDING_PAYMENT' && (
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
                <CreditCard size={16} className="text-white mr-2" />
                <Text className="text-sm font-extrabold text-white">THANH TOÁN LỆ PHÍ VNPAY</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Trường hợp Đã xác nhận / Đang thi đấu */}
        {myReg && myReg.status !== 'CANCELLED' && myReg.paymentStatus !== 'PENDING_PAYMENT' && (
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
    </SafeAreaView>
  );
};
