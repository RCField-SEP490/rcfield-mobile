import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  ClipboardCheck,
  Coffee,
  Compass,
  Home,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { usePathname } from 'expo-router';

import { BookingListScreen } from '@/features/bookings/components/BookingListScreen';
import { ExploreScreen } from '@/features/explore/components/ExploreScreen';
import { HomeScreen } from '@/features/home/components/HomeScreen';
import { ProfileScreen } from '@/features/profile/components/ProfileScreen';
import { StaffBookingsScreen } from '@/features/staff/components/StaffBookingsScreen';
import { StaffFnbOrdersScreen } from '@/features/staff/components/StaffFnbOrdersScreen';
import { StaffHomeScreen } from '@/features/staff/components/StaffHomeScreen';
import { useAuthStore } from '@/shared/store/auth-store';
import { subscribeMainTabRequests } from '@/shared/ui/main-tab-events';

const ACTIVE_COLOR = '#10b981';
const INACTIVE_COLOR = '#64748b';

const TAB_BAR_HEIGHT = 56;

type MainTab = {
  key: string;
  title: string;
  href: string;
  Icon: LucideIcon;
  Screen: React.ComponentType;
};

const CUSTOMER_TABS: MainTab[] = [
  { key: 'home', title: 'Trang chủ', href: '/', Icon: Home, Screen: HomeScreen },
  { key: 'explore', title: 'Khám phá', href: '/explore', Icon: Compass, Screen: ExploreScreen },
  { key: 'bookings', title: 'Lịch đặt', href: '/bookings', Icon: CalendarDays, Screen: BookingListScreen },
  { key: 'profile', title: 'Cá nhân', href: '/profile', Icon: UserRound, Screen: ProfileScreen },
];

const STAFF_TABS: MainTab[] = [
  { key: 'staff-home', title: 'Trực ca', href: '/', Icon: ClipboardCheck, Screen: StaffHomeScreen },
  { key: 'staff-bookings', title: 'Lịch sân', href: '/bookings', Icon: CalendarDays, Screen: StaffBookingsScreen },
  { key: 'staff-fnb', title: 'Đồ ăn', href: '/staff/fnb', Icon: Coffee, Screen: StaffFnbOrdersScreen },
  { key: 'profile', title: 'Cá nhân', href: '/profile', Icon: UserRound, Screen: ProfileScreen },
];

// Biến toàn cục lưu giữ tab đang active để khôi phục chính xác khi Back từ trang con về
let globalActiveTabIdx = 0;

const PagerScreen = memo(function PagerScreen({
  isLoaded,
  Screen,
}: {
  isLoaded: boolean;
  Screen: React.ComponentType;
}) {
  return (
    <View style={styles.page} collapsable={false}>
      {isLoaded ? <Screen /> : null}
    </View>
  );
});

const TabBarItem = memo(function TabBarItem({
  index,
  title,
  Icon,
  isActive,
  onPress,
}: {
  index: number;
  title: string;
  Icon: LucideIcon;
  isActive: boolean;
  onPress: (index: number) => void;
}) {
  const handlePress = useCallback(() => onPress(index), [index, onPress]);
  const color: ColorValue = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={handlePress}
      style={styles.tabButton}
    >
      <View style={styles.tabIconWrap}>
        <Icon color={String(color)} size={23} strokeWidth={2.15} />
        <Text numberOfLines={1} style={[styles.tabLabel, { color: String(color) }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
});

export function SwipeTabPager() {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((state) => state.role);
  const tabs = role === 'staff' ? STAFF_TABS : CUSTOMER_TABS;
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(globalActiveTabIdx);
  const [loadedIndexes, setLoadedIndexes] = useState(() => new Set([globalActiveTabIdx]));
  const activeIndexRef = useRef(globalActiveTabIdx);
  const pathname = usePathname();

  // Lắng nghe thay đổi của route để đồng bộ hóa tab hiện tại
  useEffect(() => {
    console.log('[SwipeTabPager] Pathname changed to:', pathname);
    const matchedIndex = tabs.findIndex((tab) => {
      if (tab.href === '/') {
        return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
      }
      return pathname === tab.href || pathname === `/(tabs)${tab.href}`;
    });
    console.log('[SwipeTabPager] Matched index:', matchedIndex, 'Active index ref:', activeIndexRef.current, 'Global active index:', globalActiveTabIdx);

    if (matchedIndex !== -1 && matchedIndex !== activeIndexRef.current) {
      // Nếu matchedIndex là 0 (Home tab) nhưng globalActiveTabIdx đang ở tab khác (do back từ subpage về),
      // thì giữ nguyên tab hiện tại bằng cách khôi phục lại globalActiveTabIdx
      let targetIndex = matchedIndex;
      if (matchedIndex === 0 && globalActiveTabIdx !== 0) {
        targetIndex = globalActiveTabIdx;
      }

      if (targetIndex !== activeIndexRef.current) {
        activeIndexRef.current = targetIndex;
        setActiveIndex(targetIndex);
        setLoadedIndexes((previous) => {
          if (previous.has(targetIndex)) {
            return previous;
          }
          const next = new Set(previous);
          next.add(targetIndex);
          return next;
        });
        globalActiveTabIdx = targetIndex;
        pagerRef.current?.setPageWithoutAnimation(targetIndex);
      }
    }
  }, [pathname, tabs]);

  const markTabLoaded = useCallback((index: number) => {
    setLoadedIndexes((previous) => {
      if (previous.has(index)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(index);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeIndexRef.current < tabs.length) {
      markTabLoaded(activeIndexRef.current);
      return;
    }

    activeIndexRef.current = 0;
    globalActiveTabIdx = 0;
    setActiveIndex(0);
    setLoadedIndexes(new Set([0]));
    pagerRef.current?.setPageWithoutAnimation(0);
  }, [markTabLoaded, tabs.length]);

  useEffect(() => {
    return subscribeMainTabRequests((index) => {
      if (index < 0 || index >= tabs.length || index === activeIndexRef.current) {
        return;
      }

      activeIndexRef.current = index;
      setActiveIndex(index);
      markTabLoaded(index);
      globalActiveTabIdx = index;
      pagerRef.current?.setPageWithoutAnimation(index);
    });
  }, [markTabLoaded, tabs.length]);

  const setActiveTab = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
    markTabLoaded(index);
    globalActiveTabIdx = index; // Cập nhật biến global
  }, [markTabLoaded]);

  const handlePageSelected = useCallback(
    (event: { nativeEvent: { position: number } }) => {
      const position = event.nativeEvent.position;
      if (position !== activeIndexRef.current) {
        setActiveTab(position);
      }
    },
    [setActiveTab],
  );

  const handleTabPress = useCallback((index: number) => {
    if (index === activeIndexRef.current) {
      return;
    }

    activeIndexRef.current = index;
    setActiveIndex(index);
    markTabLoaded(index);
    globalActiveTabIdx = index; // Cập nhật biến global

    // Bấm bottom tab thì xuất hiện liền lập tức không có animation trượt theo yêu cầu
    pagerRef.current?.setPageWithoutAnimation(index);
  }, [markTabLoaded]);

  return (
    <View className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]">
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={Math.min(globalActiveTabIdx, tabs.length - 1)}
        offscreenPageLimit={1}
        overScrollMode="never"
        onPageSelected={handlePageSelected}
      >
        {tabs.map(({ key, Screen }, index) => (
          <PagerScreen key={key} isLoaded={loadedIndexes.has(index)} Screen={Screen} />
        ))}
      </PagerView>

      <View
        className="flex-row items-center border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19]"
        style={{ height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }}
      >
        {tabs.map(({ key, title, Icon }, index) => (
          <TabBarItem
            key={key}
            index={index}
            title={title}
            Icon={Icon}
            isActive={activeIndex === index}
            onPress={handleTabPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrap: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    maxWidth: '100%',
    marginTop: 1,
    fontSize: 11,
    fontWeight: '600',
  },
});
