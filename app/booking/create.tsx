import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BookingWizardScreen } from '@/features/bookings/components/BookingWizardScreen';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';

export default function BookingCreateRoute() {
  const { cafeId, vehicleId } = useLocalSearchParams<{ cafeId: string; vehicleId?: string }>();

  if (!cafeId) {
    return (
      <View className="flex-1 bg-[#0b0f19] items-center justify-center p-5">
        <Text className="text-[14px] text-red-500 font-bold">
          Thiếu tham số cafeId! Không thể tiến hành đặt lịch.
        </Text>
      </View>
    );
  }

  return <BookingWizardScreen cafeId={cafeId} preselectedVehicleId={vehicleId} />;
}
