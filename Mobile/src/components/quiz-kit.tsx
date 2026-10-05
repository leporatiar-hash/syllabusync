// Building blocks for the quiz-style onboarding: one question per screen, big tappable cards.
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Check, ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';

export const STEPS = ['name', 'school', 'year', 'goals', 'lms', 'connect', 'syllabus', 'ready'] as const;
export type Step = (typeof STEPS)[number];

export type Goal = 'deadlines' | 'exams' | 'overwhelmed' | 'procrastinating' | 'understanding';
export type Lms = 'oaks' | 'canvas' | 'blackboard' | 'other' | 'none';

type Answers = { firstName: string; school: string; year: string; goals: Goal[]; lms: Lms | null; lmsSynced: number | null };
type Ctx = { answers: Answers; set: (patch: Partial<Answers>) => void };

const AnswersCtx = createContext<Ctx | null>(null);

export function QuizProvider({ children, initial }: { children: ReactNode; initial?: Partial<Answers> }) {
  const [answers, setAnswers] = useState<Answers>({ firstName: '', school: '', year: '', goals: [], lms: null, lmsSynced: null, ...initial });
  return <AnswersCtx.Provider value={{ answers, set: (p) => setAnswers((a) => ({ ...a, ...p })) }}>{children}</AnswersCtx.Provider>;
}

export function useQuiz() {
  const ctx = useContext(AnswersCtx);
  if (!ctx) throw new Error('useQuiz must be used inside QuizProvider');
  return ctx;
}

export function goTo(step: Step) {
  router.push(`/onboarding/${step}` as never);
}

let lastProgress = 0;

function ProgressBar() {
  const path = usePathname();
  const idx = Math.max(0, STEPS.findIndex((s) => path.endsWith(`/${s}`)));
  const target = (idx + 1) / STEPS.length;
  const w = useSharedValue(lastProgress);
  useEffect(() => {
    w.value = withTiming(target, { duration: 450 });
    lastProgress = target;
  }, [target, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.slate200, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 4, overflow: 'hidden' }, style]}>
        <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

/** One quiz question: back + progress up top, the question centered on screen, buttons at the bottom. */
export function QuizScreen({
  title,
  subtitle,
  children,
  footer,
  onSkip,
  skipLabel = 'Skip',
  back = true,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onSkip?: () => void;
  skipLabel?: string;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
        {back ? (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.slate200 }}>
            <ChevronLeft size={20} color={C.slate600} />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        <ProgressBar />
        <View style={{ width: 36 }} />
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 12 }}>
          <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 6, marginBottom: 16 }}>
            <T size={32} weight="bold" color={C.slate900} style={{ lineHeight: 38, letterSpacing: -0.8 }}>{title}</T>
            {subtitle ? <T size={16} color={C.slate500} style={{ lineHeight: 22 }}>{subtitle}</T> : null}
          </Animated.View>
          {children}
        </ScrollView>
        {footer || onSkip ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 8, gap: 4 }}>
            {footer}
            {onSkip ? (
              <Pressable onPress={onSkip} hitSlop={6} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <T size={16} weight="semibold" color={C.slate500}>{skipLabel}</T>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Big tappable answer card with a colored icon tile. `index` staggers its entrance animation. */
export function ChoiceCard({
  icon: Icon,
  color = C.brand,
  bg = '#EEF2FF',
  label,
  sublabel,
  selected,
  onPress,
  index = 0,
  multi,
  compact,
}: {
  icon: LucideIcon;
  color?: string;
  bg?: string;
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress: () => void;
  index?: number;
  multi?: boolean;
  compact?: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 55).duration(360)} style={compact ? { width: '48.5%' } : undefined}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: !!selected }}
        style={({ pressed }) => [
          {
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'flex-start' : 'center',
            gap: compact ? 10 : 14,
            padding: compact ? 16 : 14,
            minHeight: compact ? 108 : undefined,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderColor: selected ? C.brand : C.slate200,
            backgroundColor: selected ? '#F2F6FF' : C.white,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
          selected ? shadowSm : null,
        ]}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: selected ? color : bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={24} color={selected ? '#fff' : color} strokeWidth={2} />
        </View>
        <View style={{ flex: compact ? undefined : 1 }}>
          <T size={17} weight="semibold" color={C.slate900}>{label}</T>
          {sublabel ? <T size={13} color={C.slate500} style={{ marginTop: 1 }}>{sublabel}</T> : null}
        </View>
        {!compact ? (
          <View style={{ width: 26, height: 26, borderRadius: multi ? 8 : 13, borderWidth: selected ? 0 : 2, borderColor: C.slate300, backgroundColor: selected ? C.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Primary pill button used at the bottom of quiz screens. */
export function QuizButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ borderRadius: 999, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, shadowSm]}>
      <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 999, paddingVertical: 17, alignItems: 'center' }}>
        <T size={17} weight="semibold" color="#fff">{loading ? 'One sec…' : title}</T>
      </LinearGradient>
    </Pressable>
  );
}

/** Tap feedback + short pause so the selected state is visible before moving on. */
export function advance(step: Step, delay = 260) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => goTo(step), delay);
}
