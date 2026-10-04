import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, T } from '@/components/web';
import { C } from '@/constants/theme';

export const ONBOARDING_STEPS = 4;

/** Full-screen onboarding step: progress bar, optional Skip, title/subtitle, content, sticky footer. */
export function OnboardingShell({
  step,
  title,
  subtitle,
  onSkip,
  footer,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  onSkip?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
        <LogoMark size={28} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: ONBOARDING_STEPS }).map((_, i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? C.brand : C.slate200 }} />
          ))}
        </View>
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={10}><T size={15} weight="medium" color={C.slate500}>Skip</T></Pressable>
        ) : <View style={{ width: 28 }} />}
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 20 }}>
          <View style={{ gap: 6 }}>
            <T size={28} weight="bold" color={C.slate900} style={{ lineHeight: 34, letterSpacing: -0.5 }}>{title}</T>
            {subtitle ? <T size={15} color={C.slate500} style={{ lineHeight: 21 }}>{subtitle}</T> : null}
          </View>
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: 10, borderTopWidth: 1, borderTopColor: C.slate100, backgroundColor: C.pageBg }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}
