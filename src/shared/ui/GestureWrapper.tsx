import React from 'react';
import { View, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, usePathname, useSegments } from 'expo-router';

const TAB_NAMES = ['index', 'explore', 'bookings', 'profile'];
const TABS = ['/', '/explore', '/bookings', '/profile'];

interface GestureWrapperProps {
  children: React.ReactNode;
}

export function GestureWrapper({ children }: GestureWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  const gesture = Gesture.Pan()
    .runOnJS(true)            // Chạy callback trên JS thread để gọi router.push và console.log an toàn không gây crash native
    .activeOffsetX([-25, 25]) // Ngưỡng kích hoạt cử chỉ vuốt ngang
    .failOffsetY([-35, 35])   // Hủy cử chỉ nếu vuốt dọc (tránh xung đột scroll dọc)
    .onEnd((event) => {
      const { translationX, translationY } = event;

      console.log('[GestureWrapper] Swipe event ended:', {
        pathname,
        segments,
        translationX,
        translationY,
        absX: Math.abs(translationX),
        absY: Math.abs(translationY)
      });

      // Bỏ qua cử chỉ trên trang bản đồ chi nhánh
      if (pathname && pathname.includes('explore-map')) {
        console.log('[GestureWrapper] Ignored gesture: on explore-map page');
        return;
      }

      // Ngưỡng vuốt ngang vững chắc (độ lệch ngang > 70px, độ lệch dọc < 50px)
      if (Math.abs(translationX) > 70 && Math.abs(translationY) < 50) {
        const isSwipeLeft = translationX < -70;
        const isSwipeRight = translationX > 70;

        // Xác định chính xác xem người dùng có đang ở màn hình tab chính hay không
        const isInTab = segments[0] === '(tabs)' && segments.length <= 2;
        const isPageCon = segments.length > 0 && segments[0] !== '(tabs)';

        console.log('[GestureWrapper] Gesture recognized:', {
          isSwipeLeft,
          isSwipeRight,
          isInTab,
          isPageCon
        });

        if (isInTab) {
          // Lấy tên tab hiện tại từ segment thứ 2, mặc định là 'index'
          const currentTabName = segments[1] || 'index';
          const tabIdx = TAB_NAMES.indexOf(currentTabName);

          console.log('[GestureWrapper] Currently in tab:', { currentTabName, tabIdx });

          if (tabIdx !== -1) {
            // Luồng vuốt chuyển tab chính
            if (isSwipeLeft) {
              const nextIdx = tabIdx + 1;
              console.log('[GestureWrapper] Swipe Left on Tab -> nextIdx:', nextIdx);
              if (nextIdx < TABS.length) {
                console.log('[GestureWrapper] Navigating to next tab:', TABS[nextIdx]);
                router.push(TABS[nextIdx] as any);
              }
            } else if (isSwipeRight) {
              const prevIdx = tabIdx - 1;
              console.log('[GestureWrapper] Swipe Right on Tab -> prevIdx:', prevIdx);
              if (prevIdx >= 0) {
                console.log('[GestureWrapper] Navigating to prev tab:', TABS[prevIdx]);
                router.push(TABS[prevIdx] as any);
              }
            }
          }
        } else if (isPageCon) {
          // Luồng vuốt trên trang con thực sự: Trượt sang trái để Back
          if (isSwipeLeft) {
            const canGoBack = router.canGoBack();
            console.log('[GestureWrapper] Swipe Left on Sub-page -> Back request. canGoBack:', canGoBack);
            if (canGoBack) {
              router.back();
            }
          }
        } else {
          console.log('[GestureWrapper] Gesture ignored: not in tab and not a sub-page');
        }
      } else {
        console.log('[GestureWrapper] Gesture ignored: threshold not met');
      }
    });

  // Chạy GestureDetector trên Mobile
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
