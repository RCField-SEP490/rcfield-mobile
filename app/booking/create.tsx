import React from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { BookingWizardScreen } from '@/features/bookings/components/BookingWizardScreen';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';

export default function BookingCreateRoute() {
  const { cafeId, vehicleId, fnb } = useLocalSearchParams<{ cafeId: string; vehicleId?: string; fnb?: string }>();

  const preselectedFnb = React.useMemo(() => {
    if (!fnb) return undefined;
    try {
      return JSON.parse(fnb) as Record<string, number>;
    } catch (e) {
      console.warn('Failed to parse preselected F&B params:', e);
      return undefined;
    }
  }, [fnb]);

  if (!cafeId) {
    return (
      <View className="flex-1 bg-[#0b0f19] items-center justify-center p-5">
        <Text className="text-[14px] text-red-500 font-bold">
          Thiếu tham số cafeId! Không thể tiến hành đặt lịch.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <BookingWizardScreen
        cafeId={cafeId}
        preselectedVehicleId={vehicleId}
        preselectedFnb={preselectedFnb}
      />
    </>
  );
}

