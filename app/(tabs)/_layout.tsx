import { Tabs } from 'expo-router';
import { CalendarDays, Home, UserRound, type LucideIcon } from 'lucide-react-native';
import { type ColorValue } from 'react-native';

interface TabBarIconProps {
  color: ColorValue;
  Icon: LucideIcon;
  size: number;
}

function TabBarIcon({ color, Icon, size }: TabBarIconProps) {
  return <Icon color={String(color)} size={size} strokeWidth={2.2} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          borderTopColor: '#e2e8f0',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: (props) => <TabBarIcon Icon={Home} {...props} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: (props) => <TabBarIcon Icon={CalendarDays} {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: (props) => <TabBarIcon Icon={UserRound} {...props} />,
        }}
      />
    </Tabs>
  );
}
