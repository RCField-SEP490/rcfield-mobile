import React from 'react';
import { View } from 'react-native';

interface GestureWrapperProps {
  children: React.ReactNode;
}

export function GestureWrapper({ children }: GestureWrapperProps) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
