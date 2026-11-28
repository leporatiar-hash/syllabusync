import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, BookOpen, CalendarDays, Check, FileText, GraduationCap, MessageCircle, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';

/** Small white card used inside the illustrations. */
function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', padding: 14 }, shadowSm, style]}>{children}</View>;
}

function Row({ color, title, meta, tag }: { color: string; title: string; meta: string; tag?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color }} />
      <View style={{ flex: 1 }}>
        <T size={14} weight="semibold" color={C.slate900}>{title}</T>
        <T size={12} color={C.slate500}>{meta}</T>
      </View>
      {tag ? (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
          <T size={10} weight="semibold" color="#B91C1C">{tag}</T>
        </View>
      ) : null}
    </View>
  );
}

/** 1. Your LMS flows in on its own. */
function SyncArt() {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {['Canvas', 'Brightspace', 'Blackboard'].map((n) => (
          <View key={n} style={{ backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.slate200 }}>
            <T size={12} weight="semibold" color={C.slate600}>{n}</T>
          </View>
        ))}
      </View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={12} color="#059669" strokeWidth={3} />
          </View>
          <T size={13} weight="semibold" color="#059669">Synced from your LMS</T>
        </View>
        <Row color="#5B8DEF" title="Problem Set 6" meta="FINC 303 · Tomorrow · 11:59 PM" />
        <Row color="#F472B6" title="Midterm Exam" meta="PSYC 103 · Thu · 9:30 AM" tag="EXAM" />
        <Row color="#2DD4BF" title="Lab Report 3" meta="CHEM 111 · Fri · 5:00 PM" />
      </Card>
    </View>
  );
}

/** 2. Reminders before it's urgent. */
function RemindArt() {
  const note = (title: string, body: string, when: string) => (
    <View style={[{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 12 }, shadowSm]}>
      <LogoMark size={34} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={13} weight="semibold" color={C.slate900}>{title}</T>
          <T size={11} color={C.slate400}>{when}</T>
        </View>
        <T size={13} color={C.slate600} style={{ lineHeight: 17 }}>{body}</T>
      </View>
    </View>
  );
  return (
    <View style={{ backgroundColor: '#1E293B', borderRadius: 28, padding: 14, paddingTop: 22, gap: 10 }}>
      <T size={40} weight="bold" color="#fff" style={{ textAlign: 'center', letterSpacing: -1 }}>9:41</T>
      <T size={13} color="rgba(255,255,255,0.7)" style={{ textAlign: 'center', marginBottom: 6 }}>Thursday, December 3</T>
      {note('Midterm in 7 days', 'Your PSYC 103 midterm is next Thursday. Good time to start reviewing.', 'now')}
      {note('Due tomorrow', 'Problem Set 6 (FINC 303) is due at 11:59 PM.', '6:00 PM')}
    </View>
  );
}

/** 3. Calendar and to-dos. */
function WeekArt() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dots: Record<number, string[]> = { 1: ['#5B8DEF'], 4: ['#F472B6'], 5: ['#2DD4BF', '#94A3B8'] };
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <CalendarDays size={15} color={C.brandSolid} />
          <T size={13} weight="semibold" color={C.slate900}>December</T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {days.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4, width: 30 }}>
              <T size={11} color={C.slate400}>{d}</T>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 5 ? C.brandSolid : 'transparent' }}>
                <T size={13} weight="semibold" color={i === 5 ? '#fff' : C.slate700}>{6 + i}</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                {(dots[i] ?? []).map((c, k) => <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />)}
              </View>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <T size={12} weight="semibold" color={C.slate500} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Friday, Dec 11</T>
        <Row color="#2DD4BF" title="Lab Report 3" meta="CHEM 111 · 5:00 PM" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={11} color="#fff" strokeWidth={3} />
          </View>
          <T size={14} weight="semibold" color={C.slate400} style={{ textDecorationLine: 'line-through' }}>Buy blue books</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 10 }}>
          <Plus size={15} color={C.brandSolid} />
          <T size={13} weight="semibold" color={C.brandSolid}>Add an assignment or to-do</T>
        </View>
      </Card>
    </View>
  );
}

/** 4. Each course: deadlines, syllabus info, notes, study tools. */
function CourseArt() {
  const tabs = ['Due', 'Study', 'Info', 'Notes'];
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F472B6' }} />
            <T size={11} weight="semibold" color={C.slate500} style={{ letterSpacing: 0.5 }}>PSYC 103 · FALL 2026</T>
          </View>
          <T size={20} weight="bold" color={C.slate900}>Intro to Psychology</T>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: C.slate200, borderRadius: 9, padding: 2 }}>
          {tabs.map((t, i) => (
            <View key={t} style={{ flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 7, backgroundColor: i === 1 ? C.white : 'transparent' }}>
              <T size={12} weight={i === 1 ? 'semibold' : 'medium'} color={C.slate900}>{t}</T>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['Flashcards', '#EDE9FE', '#7C3AED'], ['Practice quiz', '#E0EAFF', '#2563EB'], ['Summary', '#D1FAE5', '#059669']].map(([label, bg, fg]) => (
            <View key={label} style={{ flex: 1, backgroundColor: bg, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <T size={12} weight="semibold" color={fg}>{label}</T>
            </View>
          ))}
        </View>
      </Card>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={17} color={C.brandSolid} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={14} weight="semibold" color={C.slate900}>PSYC103_Syllabus.pdf</T>
          <T size={12} color={C.slate500}>Found 3 exams, office hours and grading policy</T>
        </View>
        <Check size={18} color="#059669" strokeWidth={3} />
      </Card>
    </View>
  );
}

/** 5. Ask classmate. */
function ChatArt() {
  const bubble = (q: string) => (
    <View style={{ alignSelf: 'flex-end', backgroundColor: '#EEF0FF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '82%' }}>
      <T size={13} color={C.slate800}>{q}</T>
    </View>
  );
  const answer = (a: string) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <LogoMark size={22} />
      <T size={13} color={C.slate700} style={{ flex: 1, lineHeight: 18 }}>{a}</T>
    </View>
  );
  return (
    <Card style={{ gap: 12 }}>
      {bubble('When is my next exam?')}
      {answer('Your PSYC 103 midterm is Thursday at 9:30 AM. Chapters 4–7 are on it, per your syllabus.')}
      {bubble('What should I start first?')}
      {answer('Start Problem Set 6. It’s due tomorrow, then review for the midterm over the weekend.')}
    </Card>
  );
}

const PAGES: { icon: typeof Bell; kicker: string; title: string; body: string; art: () => ReactNode }[] = [
  {
    icon: GraduationCap,
    kicker: 'Connect once',
    title: 'Every due date, in one place',
    body: 'Pick your school and sign in to your LMS once. Assignments, quizzes and exams show up on their own and stay up to date.',
    art: SyncArt,
  },
  {
    icon: Bell,
    kicker: 'Get reminded',
    title: 'A heads-up before it’s urgent',
    body: 'A reminder the night before things are due, so nothing sneaks up on you. Pro adds a week’s notice for exams and a plan every Sunday.',
    art: RemindArt,
  },
  {
    icon: CalendarDays,
    kicker: 'Plan your week',
    title: 'Your calendar and to-dos',
    body: 'See every class on one calendar, color-coded. Tap + to add your own assignments and to-dos, and check things off as you go.',
    art: WeekArt,
  },
  {
    icon: BookOpen,
    kicker: 'Each class',
    title: 'Everything for a class, in one tab',
    body: 'Upload a syllabus and classmate pulls out exams, office hours and grading. Take notes and turn them into flashcards, quizzes and summaries.',
    art: CourseArt,
  },
  {
    icon: MessageCircle,
    kicker: 'Ask classmate',
    title: 'Ask anything about your classes',
    body: 'Get answers from your own deadlines, syllabi and notes: what’s due, what to start first, when your next exam is.',
    art: ChatArt,
  },
];

/** "How classmate works": five swipeable pages. Shown once before onboarding, and from Settings. */
export default function HowItWorks() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const fromOnboarding = next === 'onboarding';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  useEffect(() => { track('how_it_works_viewed', { from: fromOnboarding ? 'onboarding' : 'settings' }); }, [fromOnboarding]);

  const finish = (skipped: boolean) => {
    track('how_it_works_done', { page: page + 1, skipped });
    if (fromOnboarding) router.replace('/onboarding/name');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const go = (i: number) => {
    Haptics.selectionAsync();
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LogoMark size={28} />
          <T size={16} weight="bold" color={C.slate900}>classmate</T>
        </View>
        {!last ? (
          <Pressable onPress={() => finish(true)} hitSlop={12} accessibilityRole="button">
            <T size={16} weight="medium" color={C.slate500}>Skip</T>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}>
        {PAGES.map(({ icon: Icon, kicker, title, body, art: Art }, i) => (
          <ScrollView key={title} style={{ width }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 24 }} showsVerticalScrollIndicator={false}>
            <View style={{ minHeight: 300, justifyContent: 'center' }}>
              {page === i ? <Animated.View entering={FadeInDown.duration(380)}><Art /></Animated.View> : <Art />}
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon size={15} color={C.brandSolid} />
                <T size={13} weight="semibold" color={C.brandSolid} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{kicker}</T>
              </View>
              <T size={28} weight="bold" color={C.slate900} style={{ lineHeight: 34, letterSpacing: -0.6 }}>{title}</T>
              <T size={16} color={C.slate500} style={{ lineHeight: 23 }}>{body}</T>
            </View>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, gap: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <Pressable key={p.title} onPress={() => go(i)} hitSlop={6}>
              <View style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? C.brandSolid : C.slate300 }} />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (last ? finish(false) : go(page + 1))}
          style={({ pressed }) => ({ height: 54, borderRadius: 16, borderCurve: 'continuous', backgroundColor: C.brandSolid, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.88 : 1 })}>
          <T size={17} weight="semibold" color="#fff">{last ? (fromOnboarding ? 'Get started' : 'Done') : 'Next'}</T>
        </Pressable>
      </View>
    </View>
  );
}
