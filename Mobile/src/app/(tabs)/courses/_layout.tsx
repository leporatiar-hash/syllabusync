import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function CoursesLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: t.background }, contentStyle: { backgroundColor: t.background } }}>
      <Stack.Screen name="index" options={{ title: 'Courses' }} />
      <Stack.Screen name="[id]" options={{ title: '', headerBackTitle: 'Courses' }} />
    </Stack>
  );
}
