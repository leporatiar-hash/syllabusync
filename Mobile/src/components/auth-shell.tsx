import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, T } from '@/components/web';
import { C } from '@/constants/theme';

/** Sign-in / sign-up layout: brand mark and promise up top, then a big title and the form on the page. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LogoMark size={40} />
            <View>
              <T size={19} weight="bold" color={C.slate900} style={{ letterSpacing: -0.4, lineHeight: 22 }}>classmate</T>
              <T size={13} color={C.slate500} style={{ lineHeight: 17 }}>Every deadline, before it sneaks up on you</T>
            </View>
          </View>

          <T size={32} weight="bold" color={C.slate900} style={{ marginTop: 44, lineHeight: 38, letterSpacing: -0.8 }}>{title}</T>
          <T size={16} color={C.slate500} style={{ marginTop: 6, lineHeight: 22 }}>{subtitle}</T>

          <View style={{ marginTop: 28, gap: 16 }}>{children}</View>

          {footer ? <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 32 }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Full-width solid primary button for auth forms. */
export function AuthButton({ title, onPress, loading, disabled }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 14,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? C.slate200 : C.brandSolid,
        opacity: pressed ? 0.88 : 1,
        marginTop: 4,
      })}>
      {loading ? <ActivityIndicator color="#fff" /> : <T size={17} weight="semibold" color={disabled ? C.slate400 : '#fff'}>{title}</T>}
    </Pressable>
  );
}

/** "New to classmate? Create an account"-style line for the bottom of auth screens. */
export function AuthSwitch({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingVertical: 8 }}>
      <T size={15} color={C.slate500}>
        {prompt} <T size={15} weight="semibold" color={C.brandSolid}>{action}</T>
      </T>
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const s = tone === 'error' ? { bg: '#FEF2F2', fg: '#B91C1C' } : tone === 'warn' ? { bg: '#FFFBEB', fg: '#92400E' } : { bg: '#ECFDF5', fg: '#047857' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
      <T size={14} color={s.fg}>{children}</T>
    </View>
  );
}
