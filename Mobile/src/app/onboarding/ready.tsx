import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Bell, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { OnboardingShell } from '@/components/onboarding-shell';
import { usePaywall } from '@/components/paywall';
import { Card, GradientButton, IconSquare, OutlineButton, T, TypeChip } from '@/components/web';
import { C, getCourseColor } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { addDaysYmd, formatDeadlineDate, localToday } from '@/lib/dates';
import { notificationPermission, registerForPush, REMINDERS_ASKED_KEY } from '@/lib/notifications';
import type { Course, Deadline } from '@/lib/types';

/** The payoff: their real semester, then reminders, then (only if there's value to see) the paywall. */
export default function ReadyStep() {
  const { openPaywall } = usePaywall();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [upcoming, setUpcoming] = useState<Deadline[]>([]);
  const [permission, setPermission] = useState<string>('undetermined');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const today = localToday();
      const [c, d] = await Promise.all([
        api<Course[]>('/courses').catch(() => []),
        api<Deadline[]>(`/deadlines?from=${today}&to=${addDaysYmd(today, 120)}`).catch(() => []),
      ]);
      const real = d.filter((x) => !x.recurring && !x.completed);
      setCourses(c);
      setUpcoming(real);
      setPermission(await notificationPermission());
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
    // Value first: only pitch Pro once they can see their own semester.
    if ((courses?.length ?? 0) > 0 || upcoming.length > 0) await openPaywall('onboarding');
    router.replace('/');
  };

  if (!courses) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pageBg }}><ActivityIndicator color={C.brand} /></View>;
  }
  const empty = courses.length === 0 && upcoming.length === 0;
  const thisWeek = upcoming.filter((d) => d.date && d.date <= addDaysYmd(localToday(), 6)).length;

  return (
    <OnboardingShell
      step={3}
      title={empty ? 'You’re in' : 'Your semester is ready'}
      subtitle={empty ? 'Add a course or connect your calendar anytime from Home.' : `${thisWeek} due in the next 7 days.`}
      footer={<GradientButton title="Go to my dashboard" size="lg" loading={busy} onPress={finish} />}>
      {!empty ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[[courses.length, courses.length === 1 ? 'course' : 'courses'], [upcoming.length, upcoming.length === 1 ? 'deadline' : 'deadlines']].map(([n, label]) => (
              <Card key={String(label)} radius={20} padding={18} style={{ flex: 1 }}>
                <T size={36} weight="bold" color={C.brand} style={{ lineHeight: 42 }}>{n}</T>
                <T size={14} color={C.slate600}>{label}</T>
              </Card>
            ))}
          </View>
          {courses.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {courses.slice(0, 6).map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: getCourseColor(c.id, c.color).light, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getCourseColor(c.id, c.color).accent }} />
                  <T size={12} weight="semibold" color={C.slate700}>{c.code || c.name}</T>
                </View>
              ))}
            </View>
          ) : null}
          {upcoming.length ? (
            <Card>
              <T size={14} weight="semibold" color={C.slate900}>Coming up</T>
              {upcoming.slice(0, 3).map((d, i) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100, marginTop: i ? 0 : 6 }}>
                  <TypeChip type={d.type} />
                  <View style={{ flex: 1 }}>
                    <T size={14} weight="medium" color={C.slate800} numberOfLines={1}>{d.title}</T>
                    <T size={12} color={C.slate500}>{d.course_code || d.course_name || 'To do'}</T>
                  </View>
                  <T size={13} weight="medium" color={C.slate700}>{formatDeadlineDate(d.date)}</T>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Card radius={20} padding={18} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconSquare icon={Bell} bg={permission === 'granted' ? '#ECFDF5' : '#EEF2FF'} fg={permission === 'granted' ? C.emerald : C.brand} size={40} radius={12} />
          <View style={{ flex: 1 }}>
            <T size={15} weight="semibold" color={C.slate900}>{permission === 'granted' ? 'Reminders are on' : 'Never miss a deadline'}</T>
            <T size={13} color={C.slate500}>3 days and 1 day before each deadline, a week before exams, and a Sunday brief. Free.</T>
          </View>
          {permission === 'granted' ? <Check size={18} color={C.emerald} /> : null}
        </View>
        {permission === 'undetermined' ? <OutlineButton title="Turn on reminders" color={C.brand} onPress={enableReminders} /> : null}
      </Card>
    </OnboardingShell>
  );
}
