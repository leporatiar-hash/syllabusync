import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { CalendarDays, Check, ChevronRight, Copy, FileText, RefreshCw, Share2, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';

import { ScreenTitle, SectionHeader } from '@/components/app-chrome';
import { usePaywall } from '@/components/paywall';
import { GradientButton, IconSquare, Spinner, T } from '@/components/web';
import { C, getCourseColor } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDaysYmd, daysUntil, formatTime, localToday, parseYmd } from '@/lib/dates';
import { cleanTitle, notableType, relativeDays, TYPE_TAG } from '@/lib/format';
import { onLmsSynced } from '@/lib/lms-sync';
import { purchasesEnabled } from '@/lib/purchases';
import type { Course, Deadline, Subscription } from '@/lib/types';

type LmsConnection = { id: string; provider: string; status?: 'ok' | 'broken' };
type Dated = Deadline & { date: string };

const SETUP_DISMISSED_KEY = 'cm-setup-dismissed';
const DAYS_SHOWN = 14;

/** Minutes after midnight for "11:59 PM"-style times (untimed items sort first). */
function timeKey(t: string | null | undefined): number {
  const m = (t ?? '').match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return -1;
  let h = Number(m[1]) % 12;
  if ((m[3] ?? '').toUpperCase() === 'PM' || (!m[3] && Number(m[1]) >= 12)) h += 12;
  return h * 60 + Number(m[2]);
}

function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return 'Today';
  if (ymd === addDaysYmd(today, 1)) return 'Tomorrow';
  return parseYmd(ymd).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** White rounded card used for grouped lists. */
function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>{children}</View>;
}

export default function Home() {
  const { me } = useAuth();
  const { openPaywall } = usePaywall();
  // All upcoming deadlines (syllabus + LMS + to-dos).
  const today = localToday();
  const entries = useApi<Deadline[]>(`/deadlines?from=${today}&to=${addDaysYmd(today, 120)}`);
  const courses = useApi<Course[]>('/courses');
  const lms = useApi<LmsConnection[]>('/lms/connections');
  const sub = useApi<Subscription>('/me/subscription');
  const referral = useApi<{ referral_code: string; referral_count: number }>('/me/referral');
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SETUP_DISMISSED_KEY).then((v) => setSetupDismissed(v === '1'));
  }, []);

  const tomorrow = addDaysYmd(today, 1);
  const weekEnd = addDaysYmd(today, 6);
  const horizon = addDaysYmd(today, DAYS_SHOWN - 1);
  const sections = useMemo(() => {
    const list = (entries.data ?? [])
      .filter((d): d is Dated => !!d.date && d.date >= today && !d.recurring)
      .sort((a, b) => a.date.localeCompare(b.date) || timeKey(a.time) - timeKey(b.time));
    const open = list.filter((d) => !d.completed);
    // One section per day for the next two weeks; everything after that is a count + link.
    const byDay = new Map<string, Dated[]>();
    for (const d of list) if (d.date <= horizon) byDay.set(d.date, [...(byDay.get(d.date) ?? []), d]);
    return {
      days: [...byDay.entries()],
      laterCount: open.filter((d) => d.date > horizon).length,
      soon: open.filter((d) => d.date <= tomorrow).length,
      thisWeek: open.filter((d) => d.date <= weekEnd).length,
      next: open[0] ?? null,
      any: open.length > 0,
    };
  }, [entries.data, today, tomorrow, weekEnd, horizon]);

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
  const refreshAll = () => Promise.all([entries.refresh(), courses.refresh(), lms.refresh(), sub.refresh()]);
  const { reload: reloadEntries, setData: setEntries } = entries;
  const { reload: reloadCourses } = courses;
  useEffect(() => onLmsSynced(() => { reloadEntries(); reloadCourses(); }), [reloadEntries, reloadCourses]);

  const toggle = async (d: Deadline) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const flip = (prev: Deadline[] | null) => prev?.map((x) => (x.id === d.id ? { ...x, completed: !x.completed } : x)) ?? prev;
    setEntries(flip);
    try {
      await api(`/deadlines/${d.id}/complete`, { method: 'PATCH' });
    } catch {
      setEntries(flip);
    }
  };

  const firstName = (me?.profile?.full_name ?? '').trim().split(/\s+/)[0];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const nextIn = sections.next ? daysUntil(sections.next.date) : 0;
  const summary =
    sections.soon > 0
      ? `${sections.soon} due in the next 48 hours.${sections.thisWeek > sections.soon ? ` ${sections.thisWeek} this week.` : ''}`
      : sections.thisWeek > 0
        ? `${sections.thisWeek} due this week. The next one is ${relativeDays(nextIn)}.`
        : sections.any
          ? `Nothing due this week. Next up ${relativeDays(nextIn)}.`
          : 'Nothing coming up.';

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 24 }} refreshControl={<RefreshControl refreshing={entries.refreshing} onRefresh={refreshAll} />}>
        <View>
          <ScreenTitle eyebrow={dateLabel} title="Today" />
          {!loading ? (
            <T size={17} color={C.slate600} style={{ lineHeight: 23 }}>
              {firstName ? <T size={17} weight="semibold" color={C.slate900}>Hi {firstName}. </T> : null}
              {summary}
            </T>
          ) : null}
          {hasLms ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: lmsBroken ? C.red : C.emerald }} />
              <T size={13} weight="medium" color={C.slate500}>{lmsBroken ? `${providers} not syncing` : `${providers} synced`}</T>
            </View>
          ) : null}
        </View>

        {lmsBroken ? (
          <Group>
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconSquare icon={RefreshCw} bg="#FEF2F2" fg={C.red} size={40} radius={10} />
                <View style={{ flex: 1 }}>
                  <T size={16} weight="semibold" color={C.slate900}>Your LMS stopped syncing</T>
                  <T size={13} color={C.slate500}>New and changed due dates aren’t coming through</T>
                </View>
              </View>
              <GradientButton title="Reconnect" onPress={() => { track('lms_reconnect_tapped', { from: 'home_card' }); router.push('/onboarding/lms?from=app'); }} />
            </View>
          </Group>
        ) : null}

        {lms.data && !hasLms ? (
          <Group>
            <Row
              icon={<IconSquare icon={RefreshCw} bg="#EAF1FF" fg={C.brandSolid} size={36} radius={9} />}
              title="Connect your LMS"
              subtitle="Canvas, Blackboard or Brightspace: every due date, kept up to date"
              onPress={() => connectLms('home_card')}
            />
          </Group>
        ) : null}

        {loading ? (
          <Spinner />
        ) : sections.days.length === 0 ? (
          <Group>
            <View style={{ alignItems: 'center', padding: 28, gap: 6 }}>
              <IconSquare icon={CalendarDays} bg={C.slate100} fg={C.slate400} size={48} radius={24} />
              <T size={16} weight="semibold" color={C.slate800} style={{ marginTop: 6 }}>{sections.any ? 'All caught up' : 'No upcoming deadlines'}</T>
              <T size={14} color={C.slate500} style={{ textAlign: 'center' }}>
                {hasLms ? 'New due dates from your LMS show up here on their own.' : 'Connect your LMS and every due date shows up here.'}
              </T>
            </View>
          </Group>
        ) : (
          <View style={{ gap: 22 }}>
            {sections.days.map(([day, items]) => (
              <View key={day}>
                <SectionHeader>{dayLabel(day, today)}</SectionHeader>
                <Group>
                  {items.map((d, i) => (
                    <DeadlineRow key={d.id} d={d} first={i === 0} onToggle={() => toggle(d)} />
                  ))}
                </Group>
              </View>
            ))}
            {sections.laterCount > 0 ? (
              <Pressable onPress={() => router.navigate('/calendar')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
                <T size={15} weight="medium" color={C.brandSolid}>{sections.laterCount} more after that in Calendar</T>
                <ChevronRight size={16} color={C.brandSolid} />
              </Pressable>
            ) : null}
          </View>
        )}

        {hasLms && courses.data && missingSyllabus.length > 0 ? (
          <View>
            <SectionHeader>Add your syllabi</SectionHeader>
            <Group>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <IconSquare icon={FileText} bg="#EAF1FF" fg={C.brandSolid} size={32} radius={8} />
                <T size={13} color={C.slate500} style={{ flex: 1, lineHeight: 18 }}>
                  Professor emails, office hours and grading policies. Due dates stay synced from your LMS.
                </T>
              </View>
              {missingSyllabus.slice(0, 4).map((c) => (
                <Row
                  key={c.id}
                  first={false}
                  icon={<View style={{ width: 10, height: 10, borderRadius: 5, marginHorizontal: 11, backgroundColor: getCourseColor(c.id, c.color).accent }} />}
                  title={c.code || c.name}
                  trailing="Add"
                  onPress={() => { track('syllabus_nudge_tapped', { from: 'home_card' }); router.navigate(`/courses/${c.id}`); }}
                />
              ))}
            </Group>
            {missingSyllabus.length > 4 ? <T size={13} color={C.slate400} style={{ marginTop: 6, paddingHorizontal: 4 }}>+{missingSyllabus.length - 4} more in Courses</T> : null}
          </View>
        ) : null}

        {!setupDismissed && doneCount < 3 ? (
          <View>
            <SectionHeader right={
              <Pressable hitSlop={10} accessibilityLabel="Dismiss" onPress={() => { setSetupDismissed(true); SecureStore.setItemAsync(SETUP_DISMISSED_KEY, '1'); }}>
                <X size={16} color={C.slate400} />
              </Pressable>
            }>{`Finish setting up · ${doneCount} of 3`}</SectionHeader>
            <Group>
              {setupItems.map((item, i) => (
                <Row
                  key={item.label}
                  first={i === 0}
                  disabled={item.done}
                  icon={item.done ? (
                    <View style={{ width: 22, height: 22, borderRadius: 11, marginHorizontal: 5, backgroundColor: C.emerald, alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#fff" strokeWidth={3} /></View>
                  ) : (
                    <View style={{ width: 22, height: 22, borderRadius: 11, marginHorizontal: 5, borderWidth: 2, borderColor: C.slate300 }} />
                  )}
                  title={item.label}
                  subtitle={item.done ? undefined : item.description}
                  muted={item.done}
                  onPress={item.onPress}
                />
              ))}
            </Group>
          </View>
        ) : null}

        {(!isPro && purchasesEnabled) || referralLink ? (
          <Group>
            {!isPro && purchasesEnabled ? (
              <Row
                icon={<IconSquare icon={Sparkles} bg="#EEF2FF" fg={C.indigo} size={32} radius={8} />}
                title="ClassMate Pro"
                subtitle="Alerts when a date moves, plus earlier exam reminders"
                onPress={async () => { if (await openPaywall('home_banner')) sub.reload(); }}
              />
            ) : null}
            {referralLink ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: !isPro && purchasesEnabled ? 1 : 0, borderTopColor: C.slate100 }}>
                <IconSquare icon={Share2} bg={C.slate100} fg={C.slate500} size={32} radius={8} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="medium" color={C.slate900}>Share with friends</T>
                  {referral.data && referral.data.referral_count > 0 ? <T size={13} color={C.slate500}>{referral.data.referral_count} joined</T> : null}
                </View>
                <Pressable
                  accessibilityLabel="Copy invite link"
                  onPress={async () => { await Clipboard.setStringAsync(referralLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  hitSlop={6}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center' }}>
                  {copied ? <Check size={15} color={C.green} /> : <Copy size={15} color={C.slate600} />}
                </Pressable>
                <Pressable
                  onPress={() => Share.share({ message: `I use ClassMate to keep track of every deadline. Try it: ${referralLink}` })}
                  style={({ pressed }) => ({ borderRadius: 999, backgroundColor: pressed ? C.slate200 : C.slate100, paddingHorizontal: 14, paddingVertical: 8 })}>
                  <T size={14} weight="semibold" color={C.brandSolid}>Share</T>
                </Pressable>
              </View>
            ) : null}
          </Group>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** One deadline: course-colour check circle, full-width title, then course and time. Tap the row
 *  to open its course; tap the circle to check it off. */
function DeadlineRow({ d, first, onToggle }: { d: Dated; first: boolean; onToggle: () => void }) {
  const accent = getCourseColor(d.course_id, d.course_color).accent;
  const time = formatTime(d.time);
  const tag = notableType(d.type, d.title);
  const course = d.course_code || d.course_name || 'To-do';
  return (
    <Pressable
      onPress={() => (d.course_id ? router.navigate(`/courses/${d.course_id}`) : onToggle())}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14, paddingRight: 16, paddingVertical: 12, backgroundColor: pressed ? C.slate50 : C.white })}>
      {!first ? <View style={{ position: 'absolute', top: 0, left: 50, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
      <Pressable onPress={onToggle} hitSlop={12} style={{ paddingTop: 1 }} accessibilityRole="checkbox" accessibilityState={{ checked: d.completed }} accessibilityLabel={`Mark ${cleanTitle(d.title)} done`}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: d.completed ? 0 : 2, borderColor: accent, backgroundColor: d.completed ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {d.completed ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
        </View>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T size={16} weight="medium" color={d.completed ? C.slate400 : C.slate900} numberOfLines={2} style={[{ lineHeight: 21 }, d.completed ? { textDecorationLine: 'line-through' } : null]}>
          {cleanTitle(d.title)}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tag && !d.completed ? (
            <View style={{ backgroundColor: TYPE_TAG[tag].bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
              <T size={11} weight="semibold" color={TYPE_TAG[tag].fg}>{tag.toUpperCase()}</T>
            </View>
          ) : null}
          <T size={13} color={C.slate500} numberOfLines={1} style={{ flexShrink: 1 }}>
            {course}{time ? ` · ${time}` : ''}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

/** Generic tappable list row with chevron. */
function Row({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
  first = true,
  disabled,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress: () => void;
  first?: boolean;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? C.slate50 : C.white })}>
      {!first ? <View style={{ position: 'absolute', top: 0, left: 58, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="medium" color={muted ? C.slate400 : C.slate900} numberOfLines={1} style={muted ? { textDecorationLine: 'line-through' } : undefined}>{title}</T>
        {subtitle ? <T size={13} color={C.slate500} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {trailing ? <T size={15} color={C.brandSolid}>{trailing}</T> : null}
      {!disabled ? <ChevronRight size={18} color={C.slate300} /> : null}
    </Pressable>
  );
}
