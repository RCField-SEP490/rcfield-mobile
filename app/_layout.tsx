import 'react-native-gesture-handler';
import '../global.css';

import { Slot } from 'expo-router';
import 'react-native-reanimated';
import { LogBox } from 'react-native';
import { AppProvider } from '@/shared/providers/AppProvider';

LogBox.ignoreLogs([
  '[Reanimated] Reading from `value` during component render',
  '[Reanimated] Writing to `value` during component render',
]);

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <AppProvider>
      <Slot />
    </AppProvider>
  );
}
