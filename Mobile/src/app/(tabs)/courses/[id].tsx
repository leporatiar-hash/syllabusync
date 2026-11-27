import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { DeadlinesTab } from '@/components/course/deadlines-tab';
import { InfoTab } from '@/components/course/info-tab';
import { NotesTab } from '@/components/course/notes-tab';
import { StudyTab } from '@/components/course/study-tab';
import { Spinner, T } from '@/components/web';
import { C, getCourseColor } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { localToday } from '@/lib/dates';
import type { CourseDeadline, CourseDetail } from '@/lib/types';

type Tab = 'deadlines' | 'study' | 'info' | 'notes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'deadlines', label: 'Due' },
  { key: 'study', label: 'Study' },
  { key: 'info', label: 'Info' },
  { key: 'notes', label: 'Notes' },
];

/** iOS segmented control. */
function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.slate200, borderRadius: 10, padding: 2 }}>
      {TABS.map(({ key, label }) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => { if (!on) { Haptics.selectionAsync(); onChange(key); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: on ? C.white : 'transparent' }, on ? { shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : null]}>
            <T size={14} weight={on ? 'semibold' : 'medium'} color={C.slate900}>{label}</T>
          </Pressable>
        );
      })}
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
  const color = getCourseColor(data?.id, data?.color);

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg }}>
      <BackBar label="Courses" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        {!data ? <Spinner /> : (
          <>
            <View style={{ gap: 6, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.accent }} />
                <T size={13} weight="semibold" color={C.slate500} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {[data.code, data.semester].filter(Boolean).join(' · ') || 'Course'}
                </T>
              </View>
              <T size={28} weight="bold" color={C.slate900} style={{ lineHeight: 34, letterSpacing: -0.6 }}>{data.name}</T>
              <T size={15} color={C.slate500}>
                {remaining === 0 ? 'Nothing left to do' : `${remaining} ${remaining === 1 ? 'deadline' : 'deadlines'} left`}
              </T>
            </View>

            <Segmented value={tab} onChange={setTab} />

            {tab === 'deadlines' ? <DeadlinesTab courseId={data.id} accent={color.accent} deadlines={data.deadlines} setDeadlines={setDeadlines} onSyllabusUploaded={reload} /> : null}
            {tab === 'study' ? <StudyTab course={data} onGenerated={reload} /> : null}
            {tab === 'info' ? <InfoTab info={data.course_info} courseName={data.name} /> : null}
            {tab === 'notes' ? <NotesTab courseId={data.id} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
