import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/web';
import { C } from '@/constants/theme';

/** Breadcrumb-style back row under the app header (the web uses "Home / Courses / Name"). */
export function BackBar({ label = 'Back', right }: { label?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 12 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6 }}>
        <ChevronLeft size={20} color={C.slate500} />
        <T size={14} weight="medium" color={C.slate500} numberOfLines={1} style={{ maxWidth: 240 }}>{label}</T>
      </Pressable>
      {right}
    </View>
  );
}
