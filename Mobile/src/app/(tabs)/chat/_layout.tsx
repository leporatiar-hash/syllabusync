import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function ChatLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: t.background }, contentStyle: { backgroundColor: t.background } }}>
      <Stack.Screen name="index" options={{ title: 'Chat' }} />

    </Stack>
  );
}
