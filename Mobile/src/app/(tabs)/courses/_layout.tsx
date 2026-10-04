import { Stack } from 'expo-router';

import { C } from '@/constants/theme';

export default function CoursesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.pageBg } }} />;
}
