import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Bell, BellRing, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePaywall } from '@/components/paywall';
import { type Goal, QuizButton, useQuiz } from '@/components/quiz-kit';
import { LoadingScreen, T, TypeChip } from '@/components/web';
import { C, getCourseColor, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { addDaysYmd, formatDeadlineDate, localToday } from '@/lib/dates';
import { notificationPermission, registerForPush, REMINDERS_ASKED_KEY } from '@/lib/notifications';
import type { Course, Deadline } from '@/lib/types';

/** One line that ties their answer from the goals question to what they now have. */
const GOAL_LINES: Record<Goal, string> = {
  deadlines: 'No more surprise due dates.',
  procrastinating: 'We’ll nudge you 3 days out, so nothing slips.',
  exams: 'Exam reminders land a week early.',
  understanding: 'Turn any reading into flashcards.',
  overwhelmed: 'Everything’s in one place now.',
};

const PAYWALL_LINES: Partial<Record<Goal, string>> = {
  exams: 'Flashcards and practice quizzes from your own notes.',
  understanding: 'Summaries and flashcards for every reading.',
  procrastinating: 'Turn “I should study” into 10 minutes of flashcards.',
};

function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return;
    let raf = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / 700));
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <T size={44} weight="bold" color="#fff" style={{ lineHeight: 50 }}>{n}</T>;
}

export default function ReadyStep() {
  const insets = useSafeAreaInsets();
  const { answers } = useQuiz();
  const { openPaywall } = usePaywall();
  const { refreshMe } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [upcoming, setUpcoming] = useState<Deadline[]>([]);
  const [permission, setPermission] = useState('undetermined');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const today = localToday();
      const [c, d] = await Promise.all([
        api<Course[]>('/courses').catch(() => [] as Course[]),
        api<Deadline[]>(`/deadlines?from=${today}&to=${addDaysYmd(today, 120)}`).catch(() => [] as Deadline[]),
      ]);
      const real = d.filter((x) => !x.recurring && !x.completed);
      setCourses(c);
      setUpcoming(real);
      setPermission(await notificationPermission());
      if (c.length || real.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('dashboard_revealed', { courses: c.length, deadlines: real.length });
    })();
  }, []);

  const enableReminders = async () => {
    await registerForPush(true);
    const p = await notificationPermission();
    setPermission(p);
    track('push_permission', { granted: p === 'granted', source: 'onboarding' });
    await SecureStore.setItemAsync(REMINDERS_ASKED_KEY, '1');
  };

  const finish = async () => {
    setBusy(true);
    await SecureStore.setItemAsync(REMINDERS_ASKED_KEY, '1');
    await api('/me/complete-onboarding', { method: 'POST' }).catch(() => {});
    await refreshMe().catch(() => {});
    if (answers.alertPlan === undefined && ((courses?.length ?? 0) > 0 || upcoming.length > 0)) {
      const line = answers.goals.map((g) => PAYWALL_LINES[g]).find(Boolean);
      await openPaywall('onboarding', line);
    }
    router.replace('/');
  };

  if (!courses) {
    return <LoadingScreen label="Building your semester…" />;
  }
  const empty = courses.length === 0 && upcoming.length === 0;
  const name = answers.firstName.trim();
  const goalLine = answers.goals.length ? GOAL_LINES[answers.goals[0]] : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 28, paddingHorizontal: 24, paddingBottom: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <T size={15} weight="semibold" color="rgba(255,255,255,0.8)" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>{empty ? 'You’re in' : 'All set'}</T>
            <T size={32} weight="bold" color="#fff" style={{ marginTop: 6, lineHeight: 38, letterSpacing: -0.6 }}>
              {empty ? `Welcome${name ? `, ${name}` : ''}` : `${name ? `${name}, your` : 'Your'} semester is ready`}
            </T>
          </Animated.View>
          {!empty ? (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              {[[courses.length, courses.length === 1 ? 'course' : 'courses', 150], [upcoming.length, upcoming.length === 1 ? 'deadline' : 'deadlines', 300]].map(([n, label, d]) => (
                <Animated.View key={String(label)} entering={ZoomIn.delay(Number(d)).springify()} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                  <CountUp to={Number(n)} delay={Number(d)} />
                  <T size={15} weight="medium" color="rgba(255,255,255,0.9)">{label}</T>
                </Animated.View>
              ))}
            </View>
          ) : (
            <T size={16} color="rgba(255,255,255,0.9)" style={{ marginTop: 10, lineHeight: 22 }}>Add classes any time from Home.</T>
          )}
        </LinearGradient>

        <View style={{ padding: 20, gap: 14 }}>
          {goalLine && !empty ? (
            <Animated.View entering={FadeInDown.delay(450).duration(380)}>
              <T size={17} weight="semibold" color={C.slate800} style={{ lineHeight: 23 }}>{goalLine}</T>
            </Animated.View>
          ) : null}

          {courses.length ? (
            <Animated.View entering={FadeInDown.delay(520).duration(380)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {courses.slice(0, 6).map((c) => {
                const col = getCourseColor(c.id, c.color);
                return (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: col.light, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col.accent }} />
                    <T size={13} weight="semibold" color={C.slate700}>{c.code || c.name}</T>
                  </View>
                );
              })}
            </Animated.View>
          ) : null}

          {upcoming.length ? (
            <Animated.View entering={FadeInDown.delay(600).duration(380)} style={[{ backgroundColor: C.white, borderRadius: 24, padding: 18 }, shadowSm]}>
              <T size={15} weight="semibold" color={C.slate900}>Up next</T>
              {upcoming.slice(0, 3).map((d, i) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, marginTop: i ? 12 : 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100 }}>
                  <TypeChip type={d.type} />
                  <View style={{ flex: 1 }}>
                    <T size={15} weight="medium" color={C.slate800} numberOfLines={1}>{d.title}</T>
                    <T size={12} color={C.slate500}>{d.course_code || d.course_name || 'To do'}</T>
                  </View>
                  <T size={13} weight="semibold" color={formatDeadlineDate(d.date) === 'Today' || formatDeadlineDate(d.date) === 'Tomorrow' ? C.rose : C.slate600}>{formatDeadlineDate(d.date)}</T>
                </View>
              ))}
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(680).duration(380)}>
            {permission === 'granted' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderRadius: 20, padding: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.emerald, alignItems: 'center', justifyContent: 'center' }}><BellRing size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="semibold" color="#047857">Reminders are on</T>
                  <T size={13} color="#047857">Before every deadline</T>
                </View>
                <Check size={20} color={C.emerald} strokeWidth={3} />
              </View>
            ) : permission === 'undetermined' ? (
              <Pressable onPress={enableReminders} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 2, borderColor: C.brand, transform: [{ scale: pressed ? 0.98 : 1 }] }, shadowSm]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}><Bell size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="semibold" color={C.slate900}>Turn on reminders</T>
                  <T size={13} color={C.slate500}>Free, before every deadline</T>
                </View>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        <QuizButton title={empty ? 'Go to ClassMate' : 'Let’s go'} loading={busy} onPress={finish} />
      </View>
    </View>
  );
}
