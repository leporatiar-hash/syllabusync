import { Stack } from 'expo-router';

import { C } from '@/constants/theme';

export default function NotebookLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.groupedBg } }} />;
}
