import { Stack } from 'expo-router';

import { C } from '@/constants/theme';

export default function ChatLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.pageBg } }} />;
}
