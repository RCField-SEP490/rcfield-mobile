import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Compass, Home, UserRound, type LucideIcon } from 'lucide-react-native';
import { usePathname } from 'expo-router';

import { BookingListScreen } from '@/features/bookings/components/BookingListScreen';
import { ExploreScreen } from '@/features/explore/components/ExploreScreen';
import { HomeScreen } from '@/features/home/components/HomeScreen';
import { ProfileScreen } from '@/features/profile/components/ProfileScreen';

const ACTIVE_COLOR = '#10b981';
const INACTIVE_COLOR = '#64748b';
const BORDER_COLOR = '#1f2937';
const TAB_BAR_HEIGHT = 56;

type MainTab = {
  key: string;
  title: string;
  href: '/' | '/explore' | '/bookings' | '/profile';
  Icon: LucideIcon;
  Screen: React.ComponentType;
};

const MAIN_TABS: MainTab[] = [
  { key: 'home', title: 'Home', href: '/', Icon: Home, Screen: HomeScreen },
  { key: 'explore', title: 'Khám phá', href: '/explore', Icon: Compass, Screen: ExploreScreen },
  { key: 'bookings', title: 'Bookings', href: '/bookings', Icon: CalendarDays, Screen: BookingListScreen },
  { key: 'profile', title: 'Profile', href: '/profile', Icon: UserRound, Screen: ProfileScreen },
];

// Biến toàn cục lưu giữ tab đang active để khôi phục chính xác khi Back từ trang con về
let globalActiveTabIdx = 0;

const PagerScreen = memo(function PagerScreen({
  Screen,
}: {
  Screen: React.ComponentType;
}) {
  return (
    <View style={styles.page} collapsable={false}>
      <Screen />
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
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(globalActiveTabIdx);
  const activeIndexRef = useRef(globalActiveTabIdx);
  const pathname = usePathname();

  // Lắng nghe thay đổi của route để đồng bộ hóa tab hiện tại
  useEffect(() => {
    console.log('[SwipeTabPager] Pathname changed to:', pathname);
    const matchedIndex = MAIN_TABS.findIndex((tab) => {
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
        globalActiveTabIdx = targetIndex;
        pagerRef.current?.setPageWithoutAnimation(targetIndex);
      }
    }
  }, [pathname]);

  const setActiveTab = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
    globalActiveTabIdx = index; // Cập nhật biến global
  }, []);

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
    globalActiveTabIdx = index; // Cập nhật biến global

    // Bấm bottom tab thì xuất hiện liền lập tức không có animation trượt theo yêu cầu
    pagerRef.current?.setPageWithoutAnimation(index);
  }, []);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={globalActiveTabIdx}
        offscreenPageLimit={1}
        overScrollMode="never"
        onPageSelected={handlePageSelected}
      >
        {MAIN_TABS.map(({ key, Screen }) => (
          <PagerScreen key={key} Screen={Screen} />
        ))}
      </PagerView>

      <View style={[styles.tabBar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
        {MAIN_TABS.map(({ key, title, Icon }, index) => (
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
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: BORDER_COLOR,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#0b0b0b',
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
