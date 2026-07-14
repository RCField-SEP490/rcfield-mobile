import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Star, XCircle } from 'lucide-react-native';

import { bookingWizardApi } from '@/features/bookings/api/booking-wizard.api';
import { dismissReview, submitReview } from '@/features/reviews/api/review.api';
import { Text } from '@/shared/ui/Text';

function shortId(value?: string) {
  if (!value) return '--';
  return value.slice(0, 8).toUpperCase();
}

export default function CustomerReviewScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const normalizedBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'submit' | 'dismiss' | null>(null);
  const [overallScore, setOverallScore] = useState(5);
  const [vehicleScore, setVehicleScore] = useState(5);
  const [staffScore, setStaffScore] = useState(5);
  const [facilityScore, setFacilityScore] = useState(5);
  const [note, setNote] = useState('');

  const loadBooking = useCallback(async () => {
    if (!normalizedBookingId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await bookingWizardApi.getBooking(normalizedBookingId);
      setBooking(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải thông tin booking để đánh giá.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  }, [normalizedBookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleSubmit = async () => {
    if (!normalizedBookingId) return;

    setSubmitting('submit');
    try {
      await submitReview({
        booking_id: normalizedBookingId,
        overall_score: overallScore,
        vehicle_score: booking?.playMode === 'BYOC' ? null : vehicleScore,
        staff_score: staffScore,
        facility_score: facilityScore,
        note: note.trim() || null,
      });
      Alert.alert('Cảm ơn bạn', 'Đánh giá đã được ghi nhận.');
      router.back();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể gửi đánh giá.';
      Alert.alert('Lỗi', message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleDismiss = () => {
    if (!normalizedBookingId) return;

    Alert.alert('Bỏ qua đánh giá', 'Bạn có chắc muốn ẩn nhắc đánh giá cho booking này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ qua',
        style: 'destructive',
        onPress: async () => {
          setSubmitting('dismiss');
          try {
            await dismissReview(normalizedBookingId);
            router.back();
          } catch (error: any) {
            const message = error?.response?.data?.message || 'Không thể bỏ qua nhắc đánh giá.';
            Alert.alert('Lỗi', message);
          } finally {
            setSubmitting(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#0b0f19]">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-3 text-[12px] text-slate-500">Đang tải đánh giá...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 border-b border-slate-900 px-5 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0f172a]"
        >
          <ArrowLeft color="#e2e8f0" size={19} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[12px] uppercase tracking-wider text-slate-500" weight="700">
            Đánh giá trải nghiệm
          </Text>
          <Text className="mt-1 text-[19px] text-white" weight="700" numberOfLines={1}>
            Booking #{shortId(normalizedBookingId)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-5 py-5 pb-12" showsVerticalScrollIndicator={false}>
        <View className="mb-5 rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-4">
          <Text className="text-[16px] text-white" weight="700">
            {booking?.cafe?.name || booking?.cafeName || 'RCField'}
          </Text>
          <Text className="mt-1 text-[12px] leading-5 text-slate-500">
            Đánh giá của bạn giúp RCField cải thiện chất lượng sân, xe và phục vụ.
          </Text>
        </View>

        <View className="gap-3">
          <RatingRow label="Tổng thể" value={overallScore} onChange={setOverallScore} />
          {booking?.playMode === 'BYOC' ? null : (
            <RatingRow label="Xe thuê" value={vehicleScore} onChange={setVehicleScore} />
          )}
          <RatingRow label="Nhân viên" value={staffScore} onChange={setStaffScore} />
          <RatingRow label="Cơ sở/sân" value={facilityScore} onChange={setFacilityScore} />
        </View>

        <View className="mt-5 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
          <Text className="mb-2 text-[12px] uppercase tracking-wider text-slate-400" weight="700">
            Ghi chú
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Chia sẻ điểm tốt hoặc điều cần cải thiện..."
            placeholderTextColor="#64748b"
            className="min-h-[112px] rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-[12px] text-white"
            style={{ textAlignVertical: 'top' }}
          />
        </View>

        <View className="mt-6 gap-3">
          <Pressable
            disabled={!!submitting}
            onPress={handleSubmit}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
              submitting ? 'opacity-70' : ''
            }`}
          >
            {submitting === 'submit' ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <CheckCircle2 color="#ffffff" size={17} />
            )}
            <Text className="text-[13px] text-white" weight="700">
              Gửi đánh giá
            </Text>
          </Pressable>

          <Pressable
            disabled={!!submitting}
            onPress={handleDismiss}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 ${
              submitting ? 'opacity-70' : ''
            }`}
          >
            {submitting === 'dismiss' ? (
              <ActivityIndicator color="#94a3b8" size="small" />
            ) : (
              <XCircle color="#94a3b8" size={17} />
            )}
            <Text className="text-[13px] text-slate-300" weight="700">
              Bỏ qua
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
      <Text className="text-[13px] text-white" weight="700">
        {label}
      </Text>
      <View className="mt-3 flex-row gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <Pressable
              key={`${label}-${score}`}
              onPress={() => onChange(score)}
              className="h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950"
            >
              <Star
                color={active ? '#f59e0b' : '#475569'}
                fill={active ? '#f59e0b' : 'transparent'}
                size={20}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
