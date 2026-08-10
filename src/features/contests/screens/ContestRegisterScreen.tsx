import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Shield, ChevronRight, Car, Check, Camera, Info } from 'lucide-react-native';
import { contestsApi, type ContestRentalOption } from '../api/contests.api';
import type { Contest } from '../types/contests.types';

// Danh sách ảnh xe RC Drift demo chất lượng cao phục vụ đăng ký BYOC nhanh chóng
const MOCK_BYOC_PHOTOS = [
  'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1568605117036-5fecc6207a71?auto=format&fit=crop&w=400&q=80',
];

export const ContestRegisterScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [contest, setContest] = useState<Contest | null>(null);
  const [rentalOptions, setRentalOptions] = useState<ContestRentalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [vehicleSource, setVehicleSource] = useState<'RENTAL' | 'BYOC'>('RENTAL');
  
  // Rental states
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');

  // BYOC states
  const [byocName, setByocName] = useState('');
  const [byocBrand, setByocBrand] = useState('');
  const [byocClass, setByocClass] = useState('1/10 Drift RWD');
  const [byocNotes, setByocNotes] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const detail = await contestsApi.getContestDetail(id);
        setContest(detail);
        
        // Nếu chính sách giải cho phép thuê xe (RENTAL_ONLY hoặc MIXED)
        if (detail && (detail.vehicle_rule?.vehicle_policy === 'RENTAL_ONLY' || detail.vehicle_rule?.vehicle_policy === 'MIXED')) {
          setVehicleSource('RENTAL');
          const options = await contestsApi.getRentalOptions(id);
          setRentalOptions(options);
          if (options.length > 0) {
            setSelectedCatalogId(options[0].id);
          }
        } else {
          setVehicleSource('BYOC');
        }
      } catch (error) {
        console.error('[ContestRegisterScreen] Load error:', error);
        Alert.alert('Lỗi', 'Không thể tải dữ liệu đăng ký.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handlePhotoToggle = (url: string) => {
    if (selectedPhotos.includes(url)) {
      setSelectedPhotos(selectedPhotos.filter((p) => p !== url));
    } else {
      setSelectedPhotos([...selectedPhotos, url]);
    }
  };

  const handleRegisterSubmit = async () => {
    if (!contest) return;

    // Validate
    if (vehicleSource === 'RENTAL' && !selectedCatalogId) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn dòng xe thi đấu muốn thuê.');
      return;
    }

    if (vehicleSource === 'BYOC') {
      if (!byocName.trim()) {
        Alert.alert('Cảnh báo', 'Vui lòng điền tên xe cá nhân của bạn.');
        return;
      }
      if (!byocBrand.trim()) {
        Alert.alert('Cảnh báo', 'Vui lòng điền hãng xe (ví dụ: Yokomo, MST...).');
        return;
      }
      if (selectedPhotos.length < 2) {
        Alert.alert('Cảnh báo', 'Theo quy chế của giải đấu, bạn cần cung cấp ít nhất 2 ảnh chụp xe BYOC để Ban tổ chức kiểm định kỹ thuật.');
        return;
      }
    }

    const hostCafeId = contest.host_branch?.cafe_id;
    if (vehicleSource === 'RENTAL' && !hostCafeId) {
      Alert.alert('Lỗi', 'Không xác định được chi nhánh đăng ký.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        vehicle_source: vehicleSource,
      };

      if (vehicleSource === 'RENTAL') {
        payload.rental = {
          cafe_id: hostCafeId,
          vehicle_catalog_id: selectedCatalogId,
        };
      } else {
        payload.byoc_vehicle_name = byocName;
        payload.byoc_vehicle_brand = byocBrand;
        payload.byoc_vehicle_class = byocClass;
        payload.byoc_vehicle_notes = byocNotes;
        payload.byoc_vehicle_photos = selectedPhotos;
      }

      await contestsApi.registerContest(contest.id, payload);
      
      Alert.alert('Đăng ký thành công', 'Hồ sơ đăng ký của bạn đã được khởi tạo thành công.', [
        {
          text: 'Tiếp tục thanh toán',
          onPress: () => {
            router.replace(`/customer/contest-detail/${contest.id}` as any);
          },
        },
      ]);
    } catch (error: any) {
      console.error('[ContestRegisterScreen] Register error:', error);
      const msg = error.response?.data?.message || 'Có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại.';
      Alert.alert('Lỗi đăng ký', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price === undefined || price === null) return 'Miễn phí';
    if (price === 0) return 'Miễn phí';
    return `${price.toLocaleString('vi-VN')} VND`;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (!contest) return null;
  const policy = contest.vehicle_rule?.vehicle_policy || 'MIXED';

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-50 flex-row items-center">
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} className="mr-3">
          <Text className="text-base font-extrabold text-gray-500">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-base font-extrabold text-gray-900 flex-1" numberOfLines={1}>
          Đăng ký: {contest.name}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Step Header */}
        <View className="mb-6 flex-row items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <Shield size={20} color="#f97316" style={{ marginRight: 12 }} />
          <View className="flex-1">
            <Text className="text-xs font-extrabold text-gray-800">Quy định giải đấu</Text>
            <Text className="text-[10px] font-semibold text-gray-400 mt-0.5">
              Giải đấu áp dụng phí tham gia {formatPrice(contest.entry_fee)}. Bạn cần thanh toán giữ chỗ.
            </Text>
          </View>
        </View>

        {/* Vehicle Source Toggle (Only if MIXED policy) */}
        {policy === 'MIXED' && (
          <View className="mb-6">
            <Text className="text-sm font-extrabold text-gray-900 mb-3">Hình thức xe thi đấu</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setVehicleSource('RENTAL')}
                className={`flex-1 p-4 rounded-2xl border-2 items-center ${
                  vehicleSource === 'RENTAL' ? 'border-orange-500 bg-orange-50/10' : 'border-gray-100 bg-white'
                }`}
              >
                <Car size={24} color={vehicleSource === 'RENTAL' ? '#ea580c' : '#94a3b8'} />
                <Text className={`text-xs mt-2 ${vehicleSource === 'RENTAL' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-500'}`}>
                  Thuê xe của quán
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setVehicleSource('BYOC')}
                className={`flex-1 p-4 rounded-2xl border-2 items-center ${
                  vehicleSource === 'BYOC' ? 'border-orange-500 bg-orange-50/10' : 'border-gray-100 bg-white'
                }`}
              >
                <Shield size={24} color={vehicleSource === 'BYOC' ? '#ea580c' : '#94a3b8'} />
                <Text className={`text-xs mt-2 ${vehicleSource === 'BYOC' ? 'font-extrabold text-gray-900' : 'font-bold text-gray-500'}`}>
                  Tự mang xe (BYOC)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FOR RENTAL OPTION */}
        {vehicleSource === 'RENTAL' && (
          <View className="mb-6">
            <Text className="text-sm font-extrabold text-gray-900 mb-3">Chọn dòng xe muốn thuê</Text>
            {rentalOptions.length === 0 ? (
              <View className="p-4 bg-gray-50 rounded-xl border border-gray-100 items-center">
                <Text className="text-xs font-bold text-gray-400 italic">Cơ sở hiện tại hết xe thi đấu phù hợp.</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {rentalOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedCatalogId(opt.id)}
                    className={`flex-row items-center p-3 rounded-2xl border-2 bg-white ${
                      selectedCatalogId === opt.id ? 'border-orange-500' : 'border-gray-100'
                    }`}
                  >
                    <Image
                      source={opt.coverImageUrl ? { uri: opt.coverImageUrl } : { uri: 'https://cdn.rcfield.vn/vehicles/tamiya-cover.jpg' }}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-xs font-extrabold text-gray-900">{opt.name}</Text>
                      <Text className="text-[10px] font-semibold text-gray-400 mt-0.5" numberOfLines={1}>
                        {opt.description || 'Dòng xe drift RC chất lượng cao.'}
                      </Text>
                      <Text className="text-[11px] font-extrabold text-orange-600 mt-1">Phí thuê: Miễn phí trong giải</Text>
                    </View>
                    <View className="h-6 w-6 rounded-full border border-gray-100 items-center justify-center bg-gray-50">
                      {selectedCatalogId === opt.id && <Check size={14} color="#ea580c" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* FOR BYOC OPTION */}
        {vehicleSource === 'BYOC' && (
          <View className="mb-6 space-y-4">
            <Text className="text-sm font-extrabold text-gray-900">Khai báo thông số xe cá nhân</Text>
            
            {/* Tên xe */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1.5">Tên xe / Model</Text>
              <TextInput
                value={byocName}
                onChangeText={setByocName}
                placeholder="Ví dụ: Sakura D5, Yokomo YD-2E..."
                className="w-full px-4 py-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/20 focus:border-orange-500"
              />
            </View>

            {/* Hãng xe */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1.5">Hãng xe</Text>
              <TextInput
                value={byocBrand}
                onChangeText={setByocBrand}
                placeholder="Ví dụ: Yokomo, 3Racing, MST..."
                className="w-full px-4 py-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/20 focus:border-orange-500"
              />
            </View>

            {/* Hệ xe / Class */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1.5">Phân khúc xe (Class)</Text>
              <TextInput
                value={byocClass}
                onChangeText={setByocClass}
                placeholder="Ví dụ: 1/10 Drift RWD, 1/10 Touring..."
                className="w-full px-4 py-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/20 focus:border-orange-500"
              />
            </View>

            {/* Ghi chú */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1.5">Mô tả cấu hình độ / Nâng cấp (Ghi chú)</Text>
              <TextInput
                value={byocNotes}
                onChangeText={setByocNotes}
                multiline
                numberOfLines={3}
                placeholder="Ví dụ: Servo nâng cấp, giảm xóc dầu carbon, bộ lốp cứng..."
                className="w-full px-4 py-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/20 focus:border-orange-500"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            {/* Ảnh chụp xe */}
            <View>
              <View className="flex-row items-center mb-1">
                <Camera size={14} color="#6b7280" style={{ marginRight: 6 }} />
                <Text className="text-xs font-bold text-gray-700">Tải lên ảnh chụp xe (Chọn tối thiểu 2 ảnh)</Text>
              </View>
              <Text className="text-[10px] font-semibold text-gray-400 mb-3">
                Nhấp chọn các ảnh mẫu chụp xe thi đấu RC Drift chuyên nghiệp dưới đây:
              </Text>
              
              <View className="flex-row gap-3">
                {MOCK_BYOC_PHOTOS.map((url, index) => {
                  const isSelected = selectedPhotos.includes(url);
                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      onPress={() => handlePhotoToggle(url)}
                      className="relative flex-1 h-20 rounded-xl overflow-hidden border border-gray-100 bg-gray-100"
                    >
                      <Image source={{ uri: url }} className="h-full w-full object-cover" />
                      {/* Check Overlay */}
                      {isSelected ? (
                        <View className="absolute inset-0 bg-orange-600/70 items-center justify-center">
                          <Check size={20} color="#ffffff" />
                        </View>
                      ) : (
                        <View className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-black/40 items-center justify-center border border-white/50">
                          <Text className="text-[8px] text-white">+</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Empty spacing scroll */}
        <View className="h-12" />
      </ScrollView>

      {/* Button Submit */}
      <View className="p-4 border-t border-gray-50">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleRegisterSubmit}
          disabled={submitting}
          className="w-full bg-orange-600 py-3.5 rounded-xl items-center justify-center shadow-sm"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-sm font-extrabold text-white">GỬI ĐĂNG KÝ VÀ THANH TOÁN</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
