import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BookingDetailScreen } from '@/features/bookings/components/BookingDetailScreen';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';

export default function BookingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <View className="flex-1 bg-[#0b0f19] items-center justify-center p-5">
        <Text className="text-[14px] text-red-500 font-bold">
          Không tìm thấy mã đặt sân!
        </Text>
      </View>
    );
  }

  return <BookingDetailScreen bookingId={id} />;
}
