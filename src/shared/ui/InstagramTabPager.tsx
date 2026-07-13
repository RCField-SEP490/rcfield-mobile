import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import PagerView from 'react-native-pager-view';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Compass, Home, UserRound, type LucideIcon } from 'lucide-react-native';

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
  { key: 'explore', title: 'Kh\u00e1m ph\u00e1', href: '/explore', Icon: Compass, Screen: ExploreScreen },
  { key: 'bookings', title: 'Bookings', href: '/bookings', Icon: CalendarDays, Screen: BookingListScreen },
  { key: 'profile', title: 'Profile', href: '/profile', Icon: UserRound, Screen: ProfileScreen },
];

function getTabIndex(pathname: string | null) {
  const index = MAIN_TABS.findIndex((tab) => tab.href === pathname);
  return index === -1 ? 0 : index;
}

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

export function InstagramTabPager() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const initialIndex = useMemo(() => getTabIndex(pathname), [pathname]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeIndexRef = useRef(initialIndex);

  const setActiveTab = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const handlePageSelected = useCallback(
    (event: { nativeEvent: { position: number } }) => {
      setActiveTab(event.nativeEvent.position);
    },
    [setActiveTab],
  );

  const handleTabPress = useCallback((index: number) => {
    if (index === activeIndexRef.current) {
      return;
    }

    activeIndexRef.current = index;
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  useEffect(() => {
    const nextIndex = getTabIndex(pathname);
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      pagerRef.current?.setPageWithoutAnimation(nextIndex);
    }
  }, [pathname]);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialIndex}
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
    backgroundColor: '#ffffff',
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
