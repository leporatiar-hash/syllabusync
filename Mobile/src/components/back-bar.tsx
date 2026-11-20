import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/web';
import { C } from '@/constants/theme';

/** iOS-style back row at the top of a pushed screen; pads itself below the status bar. */
export function BackBar({ label = 'Back', right }: { label?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: insets.top + 4, paddingBottom: 4 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 0, paddingVertical: 6 }}>
        <ChevronLeft size={26} color={C.brandSolid} strokeWidth={2.25} />
        <T size={17} color={C.brandSolid} numberOfLines={1} style={{ maxWidth: 240 }}>{label}</T>
      </Pressable>
      {right}
    </View>
  );
}
