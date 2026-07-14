import React from 'react';
import { View, Platform, DeviceEventEmitter } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, usePathname, useSegments } from 'expo-router';

interface GestureWrapperProps {
  children: React.ReactNode;
}

export function GestureWrapper({ children }: GestureWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  const gesture = Gesture.Pan()
    .runOnJS(true) // Chạy trên JS thread để gọi router.back an toàn không crash native
    .hitSlop({ left: 0, width: 32 })
    .activeOffsetX(20)
    .failOffsetY([-35, 35]) // Bỏ qua nếu vuốt dọc (tránh xung đột Scroll dọc của con)
    .onEnd((event) => {
      // Bỏ qua trang bản đồ ứng dụng
      if (pathname && pathname.includes('explore-map')) {
        return;
      }

      const { translationX, translationY } = event;

      // Nhận diện cú vuốt ngang dứt khoát từ trái sang phải (Swipe Right) để back
      if (translationX > 65 && translationX > Math.abs(translationY) * 1.3) {
        // Chỉ áp dụng cho các trang con thực sự (không phải 4 tab chính thuộc nhóm (tabs))
        const isSubPage = segments.length > 0 && segments[0] !== '(tabs)';

        if (isSubPage && router.canGoBack()) {
          if (pathname && pathname.includes('booking/create')) {
            console.log('[GestureWrapper] Swipe back inside Booking Wizard. Emitting event...');
            DeviceEventEmitter.emit('WIZARD_SWIPE_BACK');
          } else {
            console.log('[GestureWrapper] Swipe back gesture recognized. Navigating back...');
            router.back();
          }
        }
      }
    });

  // Chạy GestureDetector trên Mobile
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>{children}</View>
    </GestureDetector>
  );
}
