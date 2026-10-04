import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, T } from '@/components/web';
import { C } from '@/constants/theme';

/** Web auth layout: logo header, then a centered rounded-3xl white card. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.7)' }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <LogoMark size={32} />
          <T size={16} weight="semibold" color={C.brandText}>ClassMate</T>
        </View>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: insets.bottom + 24 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.slate200, padding: 28, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
            <T size={24} weight="semibold" color={C.slate900} style={{ lineHeight: 30 }}>{title}</T>
            <T size={14} color={C.slate500} style={{ marginTop: 4 }}>{subtitle}</T>
            <View style={{ marginTop: 24, gap: 16 }}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] (web auth submit button). */
export function AuthButton({ title, onPress, loading, disabled }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.9 : 1 })}>
      <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}>
        {loading ? <ActivityIndicator color="#fff" /> : <T size={15} weight="semibold" color="#fff">{title}</T>}
      </LinearGradient>
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const s = tone === 'error' ? { bg: '#FEF2F2', fg: '#B91C1C' } : tone === 'warn' ? { bg: '#FFFBEB', fg: '#92400E' } : { bg: '#ECFDF5', fg: '#047857' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
      <T size={14} color={s.fg}>{children}</T>
    </View>
  );
}
