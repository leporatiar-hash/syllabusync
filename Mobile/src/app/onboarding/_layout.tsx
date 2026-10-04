import { Stack } from 'expo-router';

import { C } from '@/constants/theme';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, contentStyle: { backgroundColor: C.pageBg } }} />;
}
