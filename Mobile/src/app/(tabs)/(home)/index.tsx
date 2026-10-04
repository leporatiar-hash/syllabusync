import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, CalendarDays, Check, ChevronRight, Copy, Layers, MessageCircle, RefreshCw, Share2, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';

import { Card, DashedBox, GradientButton, IconSquare, OutlineButton, PageBackground, Spinner, T, TypeChip } from '@/components/web';
import { C, normalizeType } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth';
import { WEB_URL } from '@/lib/config';
import { addDaysYmd, formatDeadlineDate, localToday } from '@/lib/dates';
import { presentPaywall, purchasesEnabled } from '@/lib/purchases';
import type { Course, Subscription } from '@/lib/types';

type Entry = { id: string; deadline_id: string; course_name: string | null; course_code: string | null; date: string; time: string | null; type: string; title: string };
type LmsConnection = { id: string; provider: string };

const SETUP_DISMISSED_KEY = 'cm-setup-dismissed';

export default function Home() {
  const { me, refreshMe } = useAuth();
  // Same source as the web Home: deadlines the student has added to their calendar.
  const entries = useApi<Entry[]>('/calendar-entries');
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

  const today = localToday();
  const { upcoming, dueThisWeek } = useMemo(() => {
    const list = (entries.data ?? []).filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const weekEnd = addDaysYmd(today, 6);
    return { upcoming: list.slice(0, 8), dueThisWeek: list.filter((d) => d.date <= weekEnd).length };
  }, [entries.data, today]);

  const hasLms = (lms.data?.length ?? 0) > 0;
  const providers = [...new Set((lms.data ?? []).map((c) => (c.provider === 'ical' ? 'iCal' : 'Canvas')))].join(' + ');
  const setupItems = [
    { label: 'Connect your LMS', description: 'Sync your calendar and deadlines automatically', done: hasLms, onPress: () => WebBrowser.openBrowserAsync(`${WEB_URL}/settings`) },
    { label: 'Add your courses', description: 'Create your course list for the semester', done: (courses.data?.length ?? 0) > 0, onPress: () => router.navigate('/courses') },
    { label: 'Upload a syllabus', description: 'Let AI extract all deadlines from your syllabus PDF', done: (courses.data ?? []).some((c) => c.deadline_count > 0), onPress: () => router.navigate('/courses') },
  ];
  const doneCount = setupItems.filter((i) => i.done).length;
  const isPro = sub.data?.is_pro ?? me?.subscription.is_pro;
  const referralLink = referral.data?.referral_code ? `https://tryclassmate.com/signup?ref=${referral.data.referral_code}` : '';
  const loading = entries.loading && !entries.data;
  const refreshing = entries.refreshing;
  const refreshAll = () => Promise.all([entries.refresh(), courses.refresh(), lms.refresh(), sub.refresh()]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <PageBackground gradient>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40, gap: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}>
        {!isPro && purchasesEnabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E0E7FF', backgroundColor: '#EEF2FF', padding: 16 }}>
            <Sparkles size={18} color={C.brand} />
            <T size={15} color={C.slate800} style={{ flex: 1 }}>
              <T size={15} weight="medium" color={C.slate900}>Upgrade to Pro</T> — unlimited AI generations, AI chat & more
            </T>
            <OutlineButton title="Upgrade to Pro" size="sm" color={C.indigo} onPress={async () => { if (await presentPaywall()) { await refreshMe(); sub.reload(); } }} />
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
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald }} />
              <T size={12} weight="medium" color={C.slate600}>{providers} synced</T>
            </View>
          ) : null}
        </View>

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
              <T size={12} color={C.slate500} style={{ marginTop: 4, textAlign: 'center' }}>Upload a syllabus and we&apos;ll pull out every due date.</T>
              <GradientButton title="Go to My Courses" size="sm" style={{ marginTop: 16 }} onPress={() => router.navigate('/courses')} />
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
                      <T size={14} weight="medium" color={C.slate800} numberOfLines={2}>{d.title}</T>
                      <T size={12} color={C.slate500} numberOfLines={1}>{d.course_code || d.course_name}{' · '}{normalizeType(d.type)}</T>
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

        {lms.data && !hasLms ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconSquare icon={RefreshCw} bg="#EEF2FF" fg={C.brand} size={32} radius={8} />
              <T size={14} weight="semibold" color={C.slate900}>Sync your school calendar</T>
            </View>
            <T size={12} color={C.slate500} style={{ marginTop: 8 }}>Import assignments from Canvas or an iCal feed. Upload syllabi first so deadlines match your courses.</T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <GradientButton title="Connect Canvas" size="sm" style={{ flex: 1 }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/settings`)} />
              <OutlineButton title="iCal feed" size="sm" style={{ flex: 1 }} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/settings`)} />
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
