import { BellRing, CalendarClock, CalendarDays, Check, Moon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { usePaywall } from '@/components/paywall';
import { advance, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { notificationPermission, registerForPush } from '@/lib/notifications';
import { purchasesEnabled } from '@/lib/purchases';
import type { Subscription } from '@/lib/types';

/**
 * Right after the LMS connects: how closely should ClassMate watch it? Framed as a preference, not
 * a sales screen. "The basics" (free) and "Keep me in the loop" (Pro) are equal choices; the price
 * is a quiet line on the Pro card. Mirrors the tiers in Backend/main.py _build_user_reminders.
 */
type Plan = 'basic' | 'loop';

function promoLabel(ymd?: string | null) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Option({ selected, onPress, title, tag, lines, footnote, index }: {
  selected: boolean; onPress: () => void; title: string; tag: string;
  lines: { icon: typeof BellRing; text: string }[]; footnote?: string | null; index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 90).duration(320)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[{ backgroundColor: C.white, borderRadius: 22, borderCurve: 'continuous', padding: 18, gap: 12, borderWidth: 2, borderColor: selected ? C.brand : 'transparent' }, shadowSm]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? C.brand : C.slate300, backgroundColor: selected ? C.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
          </View>
          <T size={17} weight="semibold" color={C.slate900} style={{ flex: 1 }}>{title}</T>
          <View style={{ backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <T size={11} weight="semibold" color={C.brand}>{tag}</T>
          </View>
        </View>
        {lines.map(({ icon: Icon, text }) => (
          <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingLeft: 2 }}>
            <Icon size={16} color={C.slate400} style={{ marginTop: 2 }} />
            <T size={14} color={C.slate600} style={{ flex: 1, lineHeight: 20 }}>{text}</T>
          </View>
        ))}
        {footnote ? <T size={12} color={C.slate400} style={{ paddingLeft: 2 }}>{footnote}</T> : null}
      </Pressable>
    </Animated.View>
  );
}

export default function AlertsStep() {
  const { answers, set } = useQuiz();
  const { openPaywall } = usePaywall();
  const [plan, setPlan] = useState<Plan>('loop');
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Subscription>('/me/subscription').then(setSub).catch(() => {});
  }, []);

  const promo = promoLabel(sub?.promo_until);
  const alreadyPro = !!sub?.is_pro && !promo; // a real subscription, not the promo
  const lms = answers.lmsName || 'your LMS';

  const turnOn = async () => {
    setBusy(true);
    await registerForPush(true);
    const permission = await notificationPermission();
    track('alerts_plan_chosen', { plan, promo: !!promo, granted: permission === 'granted' });
    set({ alertPlan: plan });
    // Only the people who picked it see the subscription sheet, and only when it isn't already free.
    if (plan === 'loop' && !sub?.is_pro && purchasesEnabled) {
      await openPaywall('onboarding', 'Alerts the moment a due date moves, plus heads-ups before every exam.');
    }
    setBusy(false);
    advance('syllabus', 0);
  };

  return (
    <QuizScreen
      title="How closely should ClassMate watch your classes?"
      subtitle={`${lms} is connected. You can change this anytime in Settings.`}
      onSkip={() => { track('alerts_plan_skipped'); set({ alertPlan: null }); advance('syllabus', 0); }}
      skipLabel="Not now"
      footer={<QuizButton title="Turn on alerts" loading={busy} onPress={turnOn} />}>
      <Option
        index={0}
        selected={plan === 'loop'}
        onPress={() => setPlan('loop')}
        title="Keep me in the loop"
        tag={alreadyPro ? 'Included' : promo ? `Free through ${promo}` : '2 weeks free'}
        lines={[
          { icon: BellRing, text: 'The moment a professor moves a due date or posts something new' },
          { icon: CalendarClock, text: 'Heads-ups 3 days ahead, and a week before exams' },
          { icon: CalendarDays, text: 'A Sunday plan for the week ahead' },
        ]}
        footnote={alreadyPro ? null : promo ? 'Then the basics stay free. Keep this for $19.99 a semester if you want it.' : 'Then $19.99 a semester. Cancel anytime.'}
      />
      <Option
        index={1}
        selected={plan === 'basic'}
        onPress={() => setPlan('basic')}
        title="Just the basics"
        tag="Free"
        lines={[{ icon: Moon, text: 'A reminder the night before anything’s due' }]}
      />
    </QuizScreen>
  );
}
