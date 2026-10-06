import * as Haptics from 'expo-haptics';
import { Calendar, Check, ChevronRight, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Card, Eyebrow, IconSquare, OutlineButton, Pill, T, TypeBadge } from '@/components/web';
import { C } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatDeadlineDate, groupDeadlines, localToday } from '@/lib/dates';
import type { CourseDeadline } from '@/lib/types';
import { pickAndUploadSyllabus } from '@/lib/upload';

/** Port of Frontend/components/DeadlineList.tsx plus the syllabus strip under it. */
export function DeadlinesTab({
  courseId,
  deadlines,
  setDeadlines,
  onSyllabusUploaded,
}: {
  courseId: string;
  deadlines: CourseDeadline[];
  setDeadlines: (fn: (prev: CourseDeadline[]) => CourseDeadline[]) => void;
  onSyllabusUploaded: () => void;
}) {
  const today = localToday();
  const visible = deadlines.filter((d) => !d.recurring);
  const groups = groupDeadlines(visible, today);
  const unsaved = visible.filter((d) => !d.saved_to_calendar).length;
  const saved = visible.length - unsaved;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
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

  const setSaved = async (d: CourseDeadline, save: boolean) => {
    setBusyId(d.id);
    try {
      await api(`/deadlines/${d.id}/save-to-calendar`, { method: save ? 'POST' : 'DELETE' });
      patch(d.id, { saved_to_calendar: save });
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const saveAll = async () => {
    setBulk(true);
    for (const d of visible.filter((x) => !x.saved_to_calendar)) {
      try {
        await api(`/deadlines/${d.id}/save-to-calendar`, { method: 'POST' });
        patch(d.id, { saved_to_calendar: true });
      } catch {}
    }
    setBulk(false);
  };

  const row = (d: CourseDeadline, i: number) => (
    <View key={d.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100 }}>
      <Pressable
        onPress={() => toggleComplete(d)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: d.completed }}
        accessibilityLabel={`Mark ${d.title || 'deadline'} as ${d.completed ? 'not done' : 'done'}`}
        style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: d.completed ? C.brand : C.slate300, backgroundColor: d.completed ? C.brand : C.white, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        {d.completed ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="medium" color={d.completed ? C.slate400 : C.slate900} style={d.completed ? { textDecorationLine: 'line-through' } : undefined}>{d.title || 'Untitled deadline'}</T>
        {d.description ? <T size={14} color={C.slate500} numberOfLines={2} style={{ marginTop: 2 }}>{d.description}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 6, marginTop: 6 }}>
          <T size={12} weight="medium" color={C.slate700}>{formatDeadlineDate(d.date, today)}</T>
          {d.time ? <T size={12} color={C.slate400}>{d.time}</T> : null}
          <TypeBadge type={d.type} />
          {d.saved_to_calendar ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Check size={13} color={C.green} strokeWidth={2.5} />
              <T size={12} weight="medium" color={C.green}>On your calendar</T>
              <Pressable onPress={() => setSaved(d, false)} disabled={busyId === d.id} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                <T size={12} weight="medium" color={C.slate400}>{busyId === d.id ? 'Removing…' : 'Remove'}</T>
              </Pressable>
            </View>
          ) : (
            <OutlineButton
              size="sm"
              title={busyId === d.id ? 'Saving…' : 'Add to calendar'}
              color={C.slate600}
              disabled={busyId === d.id}
              icon={busyId === d.id ? undefined : <Calendar size={13} color={C.slate600} />}
              onPress={() => setSaved(d, true)}
            />
          )}
        </View>
      </View>
    </View>
  );

  const section = (label: string, items: CourseDeadline[]) =>
    items.length ? (
      <View style={{ marginTop: 20 }}>
        <Eyebrow color={C.slate400} tracking={1.9}>{label}</Eyebrow>
        <View style={{ marginTop: 4 }}>{items.map(row)}</View>
      </View>
    ) : null;

  return (
    <View style={{ gap: 16 }}>
      <Card radius={24} padding={20}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <T size={18} weight="semibold" color={C.slate900} style={{ marginRight: 4 }}>Timeline</T>
          <Pill bg={C.greenBg} fg={C.green}>{saved} on calendar</Pill>
          {unsaved > 0 ? <Pill bg={C.orangeBg} fg={C.orange}>{unsaved} not saved</Pill> : null}
        </View>
        {unsaved > 0 ? (
          <Pressable onPress={saveAll} disabled={bulk} style={({ pressed }) => ({ alignSelf: 'flex-start', marginTop: 12, backgroundColor: C.brand, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, opacity: bulk ? 0.5 : pressed ? 0.85 : 1 })}>
            <T size={14} weight="semibold" color="#fff">{bulk ? 'Adding…' : `Add ${unsaved} to calendar`}</T>
          </Pressable>
        ) : null}
        {visible.length === 0 ? <T size={14} color={C.slate500} style={{ marginTop: 16 }}>No deadlines yet. Upload the syllabus and they’ll appear here.</T> : null}
        {section('This week', groups.week)}
        {section('Later', groups.later)}
        {groups.earlier.length ? (
          <View style={{ marginTop: 20 }}>
            <Pressable onPress={() => setShowEarlier((s) => !s)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ChevronRight size={12} color={C.slate400} style={{ transform: [{ rotate: showEarlier ? '90deg' : '0deg' }] }} />
              <Eyebrow color={C.slate400} tracking={1.9}>{`Earlier (${groups.earlier.length})`}</Eyebrow>
            </Pressable>
            {showEarlier ? <View style={{ marginTop: 4 }}>{groups.earlier.map(row)}</View> : null}
          </View>
        ) : null}
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconSquare icon={FileText} bg={C.slate100} fg={C.slate500} size={36} radius={18} />
        <View style={{ flex: 1 }}>
          <T size={14} weight="medium" color={C.slate800}>Have a syllabus?</T>
          <T size={13} color={C.slate500}>Add it to pull in every exam and assignment.</T>
        </View>
        <Pressable
          disabled={uploading}
          onPress={async () => {
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
          }}>
          {uploading ? <ActivityIndicator color={C.brand} /> : <T size={14} weight="medium" color={C.slate600}>Upload syllabus</T>}
        </Pressable>
      </Card>
    </View>
  );
}
