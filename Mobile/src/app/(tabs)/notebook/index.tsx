import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronRight, PencilLine, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenTitle, SectionHeader, TitleAction } from '@/components/app-chrome';
import { Spinner, T } from '@/components/web';
import { C, getCourseColor } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';

type ClassSlot = { course_id: string; code: string | null; name: string; color: string | null; label: string };
type ClassNow = { now: ClassSlot | null; next: ClassSlot | null };
type Recent = { recent: { id: string; course_id: string; title: string; preview: string; updated_at: string }[]; counts: Record<string, number> };

function when(iso: string) {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1 && new Date().toDateString() === d.toDateString()) return 'Today';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>{children}</View>;
}

/** The Notebook tab: write or paste notes for any class in one place. Opens straight to today's class
 *  when a class is on (times come from the syllabus), and to a new note from the "class is starting" push. */
export default function Notebook() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  const courses = useApi<Course[]>('/courses');
  const notes = useApi<Recent>('/notes?limit=12');
  const classNow = useApi<ClassNow>('/me/class-now');
  const config = useApi<{ connector_live?: boolean }>('/app/config');
  const [creating, setCreating] = useState(false);
  const started = useRef<string | null>(null);

  useFocusEffect(useCallback(() => { notes.reload(); classNow.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const newNote = useCallback(async (courseId: string, from: string) => {
    setCreating(true);
    try {
      const title = `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} class notes`;
      const note = await api<{ id: string }>(`/courses/${courseId}/notes`, { method: 'POST', body: JSON.stringify({ title, content: '' }) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      track('note_started', { from });
      router.push({ pathname: '/notebook/[noteId]', params: { noteId: note.id } });
    } catch (e) {
      Alert.alert('Couldn’t start a note', e instanceof Error ? e.message : '');
    } finally {
      setCreating(false);
    }
  }, []);

  // Opened from "PSYC 103 is starting": go straight to a fresh note for that class (once).
  useEffect(() => {
    if (start && started.current !== start) {
      started.current = start;
      newNote(start, 'class_push');
    }
  }, [start, newNote]);

  const list = courses.data ?? [];
  const lastUsed = notes.data?.recent[0]?.course_id;
  const suggested = classNow.data?.now?.course_id ?? lastUsed ?? list[0]?.id;
  const suggestedCourse = list.find((c) => c.id === suggested);

  const pickClass = (from: string) => {
    if (!list.length) { Alert.alert('Add a class first', 'Connect your LMS or add a course, then take notes for it here.'); return; }
    const labels = list.map((c) => c.code || c.name);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Which class?', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
      (i) => { if (i < labels.length) newNote(list[i].id, from); },
    );
  };

  const nowClass = classNow.data?.now;
  const nextClass = classNow.data?.next;
  const byId = Object.fromEntries(list.map((c) => [c.id, c]));

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 24 }}
        refreshControl={<RefreshControl refreshing={notes.refreshing} onRefresh={() => { notes.refresh(); classNow.refresh(); courses.refresh(); }} />}>
        <ScreenTitle title="Notebook" right={<TitleAction icon={PencilLine} label="New note" onPress={() => pickClass('title_button')} />} />

        {nowClass ? (
          <Pressable
            onPress={() => newNote(nowClass.course_id, 'in_class_card')}
            disabled={creating}
            style={({ pressed }) => ({ backgroundColor: C.white, borderRadius: 20, borderCurve: 'continuous', padding: 18, gap: 12, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
              <T size={13} weight="semibold" color="#047857">In class now · {nowClass.label}</T>
            </View>
            <T size={22} weight="bold" color={C.slate900} style={{ letterSpacing: -0.4 }}>{nowClass.code || nowClass.name}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: C.slate50, borderWidth: 1, borderColor: C.slate200, paddingHorizontal: 14, paddingVertical: 13 }}>
              <PencilLine size={18} color={C.brandSolid} />
              <T size={16} weight="medium" color={C.brandSolid}>{creating ? 'Starting…' : 'Take notes for this class'}</T>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => (suggestedCourse ? newNote(suggestedCourse.id, 'quick_start') : pickClass('quick_start'))}
            onLongPress={() => pickClass('quick_start_pick')}
            disabled={creating}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 15, opacity: pressed ? 0.85 : 1 })}>
            <PencilLine size={18} color={C.slate400} />
            <T size={16} color={C.slate400} style={{ flex: 1 }}>{creating ? 'Starting…' : suggestedCourse ? `Start a note for ${suggestedCourse.code || suggestedCourse.name}` : 'Start a note'}</T>
            {nextClass ? <T size={12} color={C.slate400}>Next: {nextClass.code || nextClass.name} {nextClass.label.split(' - ')[0]}</T> : null}
          </Pressable>
        )}

        {courses.loading && !courses.data ? <Spinner /> : list.length ? (
          <View>
            <SectionHeader>Your classes</SectionHeader>
            <Group>
              {list.map((c, i) => {
                const color = getCourseColor(c.id, c.color);
                const n = notes.data?.counts[c.id] ?? 0;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id, tab: 'notes' } })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? C.slate50 : C.white })}>
                    {i ? <View style={{ position: 'absolute', top: 0, left: 38, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.accent }} />
                    <T size={16} color={C.slate900} numberOfLines={1} style={{ flex: 1 }}>{c.code || c.name}</T>
                    <T size={14} color={C.slate400}>{n === 1 ? '1 note' : `${n} notes`}</T>
                    <ChevronRight size={16} color={C.slate300} />
                  </Pressable>
                );
              })}
            </Group>
          </View>
        ) : null}

        {notes.data?.recent.length ? (
          <View>
            <SectionHeader>Recent</SectionHeader>
            <Group>
              {notes.data.recent.map((n, i) => {
                const c = byId[n.course_id];
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => router.push({ pathname: '/notebook/[noteId]', params: { noteId: n.id } })}
                    style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 12, gap: 3, backgroundColor: pressed ? C.slate50 : C.white })}>
                    {i ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
                    <T size={16} weight="medium" color={C.slate900} numberOfLines={1}>{n.title || 'Untitled note'}</T>
                    <T size={13} color={C.slate500} numberOfLines={1}>{[c?.code || c?.name, when(n.updated_at)].filter(Boolean).join(' · ')}{n.preview ? ` · ${n.preview}` : ''}</T>
                  </Pressable>
                );
              })}
            </Group>
          </View>
        ) : notes.data ? (
          <View style={{ alignItems: 'center', paddingVertical: 12, gap: 6 }}>
            <T size={15} weight="semibold" color={C.slate800}>Your notes, one place per class</T>
            <T size={14} color={C.slate500} style={{ textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>Type during class or paste notes from anywhere. They save on their own.</T>
          </View>
        ) : null}

        {config.data?.connector_live ? (
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.white, borderRadius: 16, padding: 16, opacity: pressed ? 0.85 : 1 })}>
            <Sparkles size={20} color={C.indigo} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} weight="semibold" color={C.slate900}>Study with Claude or ChatGPT</T>
              <T size={13} color={C.slate500} style={{ lineHeight: 18 }}>Connect classmate once and they can see your classes, deadlines and these notes, and quiz you from them.</T>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
