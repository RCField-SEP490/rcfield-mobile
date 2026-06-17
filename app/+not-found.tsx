import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/shared/ui/Text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text variant="title" className="text-center">
          This screen does not exist.
        </Text>

        <Link href="/" className="mt-4 py-3">
          <Text weight="600" className="text-brand-600">
            Go to home
          </Text>
        </Link>
      </View>
    </>
  );
}
