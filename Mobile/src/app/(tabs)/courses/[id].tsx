import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Check, GraduationCap, Info, NotebookPen, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { DeadlinesTab } from '@/components/course/deadlines-tab';
import { InfoTab } from '@/components/course/info-tab';
import { NotesTab } from '@/components/course/notes-tab';
import { StudyTab } from '@/components/course/study-tab';
import { Eyebrow, PageBackground, Spinner, T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { localToday } from '@/lib/dates';
import type { CourseDeadline, CourseDetail } from '@/lib/types';

type Tab = 'deadlines' | 'study' | 'info' | 'notes';

function TabPill({ icon: Icon, label, active, onPress, badge }: { icon: LucideIcon; label: string; active: boolean; onPress: () => void; badge?: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: active ? C.white : 'transparent' }, active ? shadowSm : null]}>
      <Icon size={16} color={active ? C.slate900 : C.slate500} />
      <T size={14} weight="semibold" color={active ? C.slate900 : C.slate500}>{label}</T>
      {badge}
    </Pressable>
  );
}

function CountBadge({ n, bg, fg }: { n: number; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
      <T size={12} weight="semibold" color={fg}>{n}</T>
    </View>
  );
}

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, refreshing, refresh, reload } = useApi<CourseDetail>(`/courses/${id}`);
  const [tab, setTab] = useState<Tab>('deadlines');

  const setDeadlines = (fn: (prev: CourseDeadline[]) => CourseDeadline[]) => setData((d) => (d ? { ...d, deadlines: fn(d.deadlines) } : d));

  const today = localToday();
  const real = (data?.deadlines ?? []).filter((d) => !d.recurring);
  const remaining = real.filter((d) => !d.completed && (!d.date || d.date >= today)).length;
  const unsaved = real.filter((d) => !d.saved_to_calendar).length;
  const studyCount = data ? data.flashcard_sets.length + data.quizzes.length + data.summaries.length : 0;
  const hasInfo = !!data?.course_info && Object.keys(data.course_info).length > 0;

  return (
    <PageBackground>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <Pressable onPress={() => router.navigate('/')}><T size={14} color={C.slate500}>Home</T></Pressable>
          <T size={14} color={C.slate500} style={{ paddingHorizontal: 8 }}>/</T>
          <Pressable onPress={() => router.back()}><T size={14} color={C.slate500}>Courses</T></Pressable>
          <T size={14} color={C.slate500} style={{ paddingHorizontal: 8 }}>/</T>
          <T size={14} color={C.slate700} numberOfLines={1} style={{ flexShrink: 1 }}>{data?.name ?? 'Course'}</T>
        </View>

        {!data ? <Spinner /> : (
          <>
            <LinearGradient colors={['#E0EAFF', '#F3E8FF', '#E0F2FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[{ marginTop: 20, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 20 }, shadowSm]}>
              <Eyebrow>{data.code || 'Course'}</Eyebrow>
              <T size={24} weight="semibold" color={C.slate900} style={{ marginTop: 4, lineHeight: 31 }}>{data.name}</T>
              <T size={14} color={C.slate600} style={{ marginTop: 4 }}>{data.semester || 'Semester'}</T>
              <View style={[{ alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 }, shadowSm]}>
                <T size={14} color={C.slate600}><T size={14} weight="semibold" color={C.slate900}>{remaining}</T> deadlines remaining</T>
              </View>
            </LinearGradient>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24, marginBottom: 20 }}>
              <TabPill icon={CalendarDays} label="Deadlines" active={tab === 'deadlines'} onPress={() => setTab('deadlines')} badge={unsaved > 0 ? <CountBadge n={unsaved} bg={C.orangeBg} fg={C.orange} /> : null} />
              <TabPill icon={GraduationCap} label="Study Tools" active={tab === 'study'} onPress={() => setTab('study')} badge={studyCount > 0 ? <CountBadge n={studyCount} bg="#E0EAFF" fg={C.brand} /> : null} />
              <TabPill
                icon={Info}
                label="Course Info"
                active={tab === 'info'}
                onPress={() => setTab('info')}
                badge={hasInfo ? <View style={{ backgroundColor: '#ECFDF5', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 }}><Check size={10} color="#4ADE80" strokeWidth={3} /></View> : null}
              />
              <TabPill icon={NotebookPen} label="Notes" active={tab === 'notes'} onPress={() => setTab('notes')} />
            </View>

            {tab === 'deadlines' ? <DeadlinesTab courseId={data.id} deadlines={data.deadlines} setDeadlines={setDeadlines} onSyllabusUploaded={reload} /> : null}
            {tab === 'study' ? <StudyTab course={data} onGenerated={reload} /> : null}
            {tab === 'info' ? <InfoTab info={data.course_info} courseName={data.name} /> : null}
            {tab === 'notes' ? <NotesTab courseId={data.id} /> : null}
          </>
        )}
      </ScrollView>
    </PageBackground>
  );
}
