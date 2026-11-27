import * as Haptics from 'expo-haptics';
import { Check, ChevronRight, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { SectionHeader } from '@/components/app-chrome';
import { IconSquare, T } from '@/components/web';
import { C } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatDeadlineDate, formatTime, groupDeadlines, localToday } from '@/lib/dates';
import { cleanTitle, notableType, TYPE_TAG } from '@/lib/format';
import type { CourseDeadline } from '@/lib/types';
import { pickAndUploadSyllabus } from '@/lib/upload';

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>{children}</View>;
}

/** The course's deadlines (this week / later / earlier) and the syllabus row under them. */
export function DeadlinesTab({
  courseId,
  accent,
  deadlines,
  setDeadlines,
  onSyllabusUploaded,
}: {
  courseId: string;
  accent: string;
  deadlines: CourseDeadline[];
  setDeadlines: (fn: (prev: CourseDeadline[]) => CourseDeadline[]) => void;
  onSyllabusUploaded: () => void;
}) {
  const today = localToday();
  // The LMS owns this course's due dates; the syllabus row pitches course info instead.
  const lmsBacked = deadlines.some((d) => d.source === 'ical' || d.source === 'canvas');
  const visible = deadlines.filter((d) => !d.recurring);
  const groups = groupDeadlines(visible, today);
  const [showEarlier, setShowEarlier] = useState(groups.week.length + groups.later.length === 0);
  const [uploading, setUploading] = useState(false);

  const patch = (id: string, change: Partial<CourseDeadline>) => setDeadlines((prev) => prev.map((d) => (d.id === id ? { ...d, ...change } : d)));

  const toggleComplete = async (d: CourseDeadline) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patch(d.id, { completed: !d.completed });
    try {
      await api(`/deadlines/${d.id}/complete`, { method: 'PATCH' });
    } catch {
      patch(d.id, { completed: d.completed });
    }
  };

  const row = (d: CourseDeadline, i: number) => {
    const tag = notableType(d.type, d.title);
    const time = formatTime(d.time);
    return (
      <Pressable
        key={d.id}
        onPress={() => toggleComplete(d)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: d.completed }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14, paddingRight: 16, paddingVertical: 12, backgroundColor: pressed ? C.slate50 : C.white })}>
        {i ? <View style={{ position: 'absolute', top: 0, left: 50, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
        <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 1, borderWidth: d.completed ? 0 : 2, borderColor: accent, backgroundColor: d.completed ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {d.completed ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T size={16} weight="medium" color={d.completed ? C.slate400 : C.slate900} style={[{ lineHeight: 21 }, d.completed ? { textDecorationLine: 'line-through' } : null]}>{cleanTitle(d.title)}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {tag && !d.completed ? (
              <View style={{ backgroundColor: TYPE_TAG[tag].bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                <T size={11} weight="semibold" color={TYPE_TAG[tag].fg}>{tag.toUpperCase()}</T>
              </View>
            ) : null}
            <T size={13} color={C.slate500}>{formatDeadlineDate(d.date, today)}{time ? ` · ${time}` : ''}</T>
          </View>
        </View>
      </Pressable>
    );
  };

  const section = (label: string, items: CourseDeadline[]) =>
    items.length ? (
      <View>
        <SectionHeader>{label}</SectionHeader>
        <Group>{items.map(row)}</Group>
      </View>
    ) : null;

  const upload = async () => {
    setUploading(true);
    try {
      const res = await pickAndUploadSyllabus(`/courses/${courseId}/syllabus`);
      if (res && !res.ok) Alert.alert('Upload failed', res.error);
      if (res?.ok) {
        onSyllabusUploaded();
        if (res.data?.lms_backed) {
          const extra = res.data.deadlines_added ? ` Also added ${res.data.deadlines_added} exam${res.data.deadlines_added === 1 ? '' : 's'} your LMS didn’t list.` : '';
          Alert.alert('Syllabus added', `Professor contact, office hours and policies are saved. Due dates stay synced from your LMS.${extra}`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ gap: 22 }}>
      {visible.length === 0 ? (
        <Group>
          <T size={15} color={C.slate500} style={{ padding: 16, lineHeight: 21 }}>
            {lmsBacked ? 'Nothing coming up. New due dates from your LMS show up here on their own.' : 'No deadlines yet. Upload the syllabus and they’ll appear here.'}
          </T>
        </Group>
      ) : null}
      {section('This week', groups.week)}
      {section('Later', groups.later)}
      {groups.earlier.length ? (
        <View>
          <Pressable onPress={() => setShowEarlier((s) => !s)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, marginBottom: 8 }}>
            <T size={13} weight="semibold" color={C.slate500} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{`Earlier (${groups.earlier.length})`}</T>
            <ChevronRight size={14} color={C.slate500} style={{ transform: [{ rotate: showEarlier ? '90deg' : '0deg' }] }} />
          </Pressable>
          {showEarlier ? <Group>{groups.earlier.map(row)}</Group> : null}
        </View>
      ) : null}

      <Group>
        <Pressable onPress={upload} disabled={uploading} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? C.slate50 : C.white })}>
          <IconSquare icon={FileText} bg="#EAF1FF" fg={C.brandSolid} size={34} radius={9} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="medium" color={C.slate900}>{lmsBacked ? 'Add the syllabus' : 'Upload the syllabus'}</T>
            <T size={13} color={C.slate500} style={{ lineHeight: 18 }}>
              {lmsBacked ? 'Professor email, office hours and grading policy. Due dates stay synced from your LMS.' : 'Pulls in every exam and assignment.'}
            </T>
          </View>
          {uploading ? <ActivityIndicator color={C.brandSolid} /> : <ChevronRight size={18} color={C.slate300} />}
        </Pressable>
      </Group>
    </View>
  );
}
