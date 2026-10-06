import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ArrowRight, CalendarDays, Check, ChevronRight, Copy, FileText, Layers, MessageCircle, RefreshCw, Share2, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';

import { Card, DashedBox, GradientButton, IconSquare, OutlineButton, PageBackground, Spinner, T, TypeChip } from '@/components/web';
import { C, getCourseColor, normalizeType } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { track } from '@/lib/analytics';
import { addDaysYmd, formatDeadlineDate, localToday } from '@/lib/dates';
import { onLmsSynced } from '@/lib/lms-sync';
import { usePaywall } from '@/components/paywall';
import { purchasesEnabled } from '@/lib/purchases';
import type { Course, Deadline, Subscription } from '@/lib/types';

type LmsConnection = { id: string; provider: string; status?: 'ok' | 'broken' };

const SETUP_DISMISSED_KEY = 'cm-setup-dismissed';

export default function Home() {
  const { me } = useAuth();
  const { openPaywall } = usePaywall();
  // All upcoming deadlines (syllabus + LMS + to-dos). The web Home only lists ones saved to the
  // calendar, which shows almost nothing right after onboarding when deadlines arrive via iCal/syllabus.
  const today = localToday();
  const entries = useApi<Deadline[]>(`/deadlines?from=${today}&to=${addDaysYmd(today, 120)}`);
  const courses = useApi<Course[]>('/courses');
  const lms = useApi<LmsConnection[]>('/lms/connections');
  const sub = useApi<Subscription>('/me/subscription');
  const referral = useApi<{ referral_code: string; referral_count: number }>('/me/referral');
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [tryHidden, setTryHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SETUP_DISMISSED_KEY).then((v) => setSetupDismissed(v === '1'));
  }, []);

  const { upcoming, dueThisWeek } = useMemo(() => {
    const list = (entries.data ?? [])
      .filter((d): d is Deadline & { date: string } => !!d.date && d.date >= today && !d.completed && !d.recurring)
      .sort((a, b) => a.date.localeCompare(b.date));
    const weekEnd = addDaysYmd(today, 6);
    return { upcoming: list.slice(0, 8), dueThisWeek: list.filter((d) => d.date <= weekEnd).length };
  }, [entries.data, today]);

  const hasLms = (lms.data?.length ?? 0) > 0;
  const lmsBroken = (lms.data ?? []).some((c) => c.status === 'broken');
  const providers = [...new Set((lms.data ?? []).map((c) => (c.provider === 'ical' ? 'LMS' : 'Canvas')))].join(' + ');
  const connectLms = (from: string) => {
    track('lms_nudge_tapped', { from });
    router.push('/onboarding/lms?from=app');
  };
  // Once the LMS owns due dates, a syllabus is for what the LMS doesn't have: contacts, office hours, policies.
  const missingSyllabus = (courses.data ?? []).filter((c) => !c.has_syllabus);
  const setupItems = [
    { label: 'Connect your LMS', description: 'Every due date, kept up to date automatically', done: hasLms, onPress: () => connectLms('checklist') },
    { label: 'Add your courses', description: 'Create your course list for the semester', done: (courses.data?.length ?? 0) > 0, onPress: () => router.navigate('/courses') },
    { label: 'Upload a syllabus', description: 'Professor emails, office hours and policies', done: (courses.data ?? []).some((c) => c.has_syllabus), onPress: () => router.navigate('/courses') },
  ];
  const doneCount = setupItems.filter((i) => i.done).length;
  const isPro = sub.data?.is_pro ?? me?.subscription.is_pro;
  const referralLink = referral.data?.referral_code ? `https://tryclassmate.com/signup?ref=${referral.data.referral_code}` : '';
  const loading = entries.loading && !entries.data;
  const refreshing = entries.refreshing;
  const refreshAll = () => Promise.all([entries.refresh(), courses.refresh(), lms.refresh(), sub.refresh()]);
  const { reload: reloadEntries } = entries;
  const { reload: reloadCourses } = courses;
  useEffect(() => onLmsSynced(() => { reloadEntries(); reloadCourses(); }), [reloadEntries, reloadCourses]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <PageBackground gradient>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40, gap: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}>
        {!isPro && purchasesEnabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E0E7FF', backgroundColor: '#EEF2FF', padding: 16 }}>
            <Sparkles size={18} color={C.brand} />
            <T size={15} color={C.slate800} style={{ flex: 1 }}>
              <T size={15} weight="medium" color={C.slate900}>Upgrade to Pro</T> — unlimited flashcards, quizzes & summaries, more AI chat
            </T>
            <OutlineButton title="Upgrade to Pro" size="sm" color={C.indigo} onPress={async () => { if (await openPaywall('home_banner')) sub.reload(); }} />
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          <T size={14} weight="medium" color={C.slate500}>{todayLabel}</T>
          <T size={30} weight="semibold" color={C.slate900} style={{ lineHeight: 36, letterSpacing: -0.5 }}>Welcome back</T>
          {!loading ? (
            <T size={16} color={C.slate600} style={{ marginTop: 4 }}>
              {dueThisWeek === 0 ? 'Nothing due in the next 7 days.' : `You have ${dueThisWeek} ${dueThisWeek === 1 ? 'thing' : 'things'} due in the next 7 days.`}
            </T>
          ) : null}
          {hasLms ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lmsBroken ? C.red : C.emerald }} />
              <T size={12} weight="medium" color={C.slate600}>{lmsBroken ? `${providers} not syncing` : `${providers} synced`}</T>
            </View>
          ) : null}
        </View>

        {lmsBroken ? (
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconSquare icon={RefreshCw} bg={C.white} fg={C.red} size={40} radius={12} />
              <View style={{ flex: 1 }}>
                <T size={17} weight="semibold" color={C.slate900}>Your LMS stopped syncing</T>
                <T size={13} color={C.slate600}>New and changed due dates aren’t coming through</T>
              </View>
            </View>
            <GradientButton title="Reconnect" onPress={() => { track('lms_reconnect_tapped', { from: 'home_card' }); router.push('/onboarding/lms?from=app'); }} />
          </View>
        ) : null}

        {lms.data && !hasLms ? (
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#EEF2FF', padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconSquare icon={RefreshCw} bg={C.white} fg={C.brand} size={40} radius={12} />
              <View style={{ flex: 1 }}>
                <T size={17} weight="semibold" color={C.slate900}>Connect your LMS</T>
                <T size={13} color={C.slate600}>OAKS, Canvas and more</T>
              </View>
            </View>
            <T size={14} color={C.slate700} style={{ lineHeight: 20 }}>
              Pull in every due date, and stay right when professors move them. You’re only seeing what you’ve added by hand right now.
            </T>
            <GradientButton title="Connect in 30 seconds" onPress={() => connectLms('home_card')} />
          </View>
        ) : null}

        {hasLms && courses.data && missingSyllabus.length > 0 ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconSquare icon={FileText} bg="#EEF2FF" fg={C.brand} size={36} radius={10} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="semibold" color={C.slate900}>Add your syllabi</T>
                <T size={12} color={C.slate500}>{missingSyllabus.length} of {courses.data.length} courses still need one</T>
              </View>
            </View>
            <T size={13} color={C.slate600} style={{ marginTop: 10, lineHeight: 19 }}>
              Professor emails, office hours and grading policies, ready when you ask ClassMate. Due dates stay synced from your LMS.
            </T>
            <View style={{ marginTop: 8 }}>
              {missingSyllabus.slice(0, 4).map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => { track('syllabus_nudge_tapped', { from: 'home_card' }); router.navigate(`/courses/${c.id}`); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100, backgroundColor: pressed ? C.slate50 : 'transparent' })}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getCourseColor(c.id, c.color).accent }} />
                  <T size={14} weight="medium" color={C.slate800} numberOfLines={1} style={{ flex: 1 }}>{c.code || c.name}</T>
                  <T size={13} weight="medium" color={C.brand}>Add</T>
                  <ChevronRight size={16} color={C.slate300} />
                </Pressable>
              ))}
              {missingSyllabus.length > 4 ? <T size={12} color={C.slate400}>+{missingSyllabus.length - 4} more in Courses</T> : null}
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={16} weight="semibold" color={C.slate900}>Upcoming deadlines</T>
            {upcoming.length > 0 ? (
              <Pressable onPress={() => router.navigate('/calendar')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T size={14} weight="medium" color={C.brand}>View calendar</T>
                <ArrowRight size={14} color={C.brand} />
              </Pressable>
            ) : null}
          </View>
          {loading ? (
            <Spinner />
          ) : upcoming.length === 0 ? (
            <DashedBox style={{ marginTop: 16 }}>
              <IconSquare icon={CalendarDays} bg={C.slate100} fg={C.slate400} size={48} radius={24} />
              <T size={14} weight="semibold" color={C.slate700} style={{ marginTop: 12 }}>No upcoming deadlines yet</T>
              {hasLms ? (
                <T size={12} color={C.slate500} style={{ marginTop: 4, textAlign: 'center' }}>Your LMS is synced. New due dates show up here on their own.</T>
              ) : (
                <>
                  <T size={12} color={C.slate500} style={{ marginTop: 4, textAlign: 'center' }}>Connect your LMS and every due date shows up here.</T>
                  <GradientButton title="Connect your LMS" size="sm" style={{ marginTop: 16 }} onPress={() => connectLms('empty_state')} />
                </>
              )}
            </DashedBox>
          ) : (
            <View style={{ marginTop: 8 }}>
              {upcoming.map((d, i) => {
                const label = formatDeadlineDate(d.date, today);
                const soon = label === 'Today' || label === 'Tomorrow';
                return (
                  <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100 }}>
                    <TypeChip type={d.type} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T size={14} weight="medium" color={C.slate800} numberOfLines={2}>{d.title || 'Untitled'}</T>
                      <T size={12} color={C.slate500} numberOfLines={1}>{d.course_code || d.course_name || 'To do'}{' · '}{normalizeType(d.type)}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T size={14} weight={soon ? 'semibold' : 'medium'} color={soon ? C.rose : C.slate700}>{label}</T>
                      {d.time ? <T size={12} color={C.slate400}>{d.time}</T> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {!setupDismissed && doneCount < 3 ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View>
                <T size={14} weight="semibold" color={C.slate900}>Finish setting up</T>
                <T size={12} color={C.slate500} style={{ marginTop: 2 }}>{doneCount} of 3 done</T>
              </View>
              <Pressable hitSlop={10} accessibilityLabel="Dismiss" onPress={() => { setSetupDismissed(true); SecureStore.setItemAsync(SETUP_DISMISSED_KEY, '1'); }}>
                <X size={16} color={C.slate400} />
              </Pressable>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.slate100, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ width: `${(doneCount / 3) * 100}%`, height: '100%', backgroundColor: C.brand, borderRadius: 3 }} />
            </View>
            <View style={{ marginTop: 12, gap: 4 }}>
              {setupItems.map((item) => (
                <Pressable key={item.label} disabled={item.done} onPress={item.onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, backgroundColor: pressed ? C.slate50 : 'transparent' })}>
                  {item.done ? (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.emerald, alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" strokeWidth={3} /></View>
                  ) : (
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.slate300 }} />
                  )}
                  {item.done ? (
                    <T size={14} color={C.slate400} style={{ textDecorationLine: 'line-through', flex: 1 }}>{item.label}</T>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <T size={14} weight="medium" color={C.slate800}>{item.label}</T>
                      <T size={12} color={C.slate500}>{item.description}</T>
                    </View>
                  )}
                  {!item.done ? <ChevronRight size={16} color={C.slate300} /> : null}
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {!tryHidden ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={14} weight="semibold" color={C.slate900}>Try these</T>
              <Pressable onPress={() => setTryHidden(true)} hitSlop={8}><T size={12} color={C.slate400}>Hide</T></Pressable>
            </View>
            {[
              { icon: Sparkles, title: 'Study guide', body: 'Turn a syllabus or unit into a guide', onPress: () => router.navigate('/courses') },
              { icon: Layers, title: 'Flashcards', body: 'Generate a set from your materials', onPress: () => router.navigate('/courses') },
              { icon: MessageCircle, title: 'Chat', body: 'Ask what’s due and what to start first', onPress: () => router.navigate('/chat') },
            ].map((it) => (
              <Pressable key={it.title} onPress={it.onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: pressed ? C.slate50 : 'transparent' })}>
                <IconSquare icon={it.icon} bg="#EEF2FF" fg={C.brand} size={32} radius={8} />
                <View style={{ flex: 1 }}>
                  <T size={14} weight="medium" color={C.slate800}>{it.title}</T>
                  <T size={12} color={C.slate500}>{it.body}</T>
                </View>
                <ChevronRight size={16} color={C.slate300} />
              </Pressable>
            ))}
            {!isPro ? <T size={12} color={C.slate400} style={{ marginTop: 6 }}>Free plan: {sub.data?.ai_generations_max ?? 50} AI generations/month</T> : null}
          </Card>
        ) : null}

        {referralLink ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconSquare icon={Share2} bg={C.slate100} fg={C.slate500} size={32} radius={8} />
              <View style={{ flex: 1 }}>
                <T size={14} weight="semibold" color={C.slate900}>Share with friends</T>
                {referral.data && referral.data.referral_count > 0 ? <T size={12} color={C.slate500}>{referral.data.referral_count} joined</T> : null}
              </View>
              <Pressable
                accessibilityLabel="Copy invite link"
                onPress={async () => { await Clipboard.setStringAsync(referralLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center' }}>
                {copied ? <Check size={14} color={C.green} /> : <Copy size={14} color={C.slate500} />}
              </Pressable>
              <OutlineButton title="Share" size="sm" color={C.slate600} onPress={() => Share.share({ message: `I use ClassMate to keep track of every deadline. Try it: ${referralLink}` })} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </PageBackground>
  );
}
