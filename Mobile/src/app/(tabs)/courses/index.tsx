import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CalendarDays, Pencil, Plus, Trash2, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { CourseFormModal } from '@/components/course-form';
import { DashedBox, Eyebrow, GradientButton, IconSquare, PageBackground, Spinner, T } from '@/components/web';
import { C, getCourseColor, shadowSm } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { pickAndUploadSyllabus } from '@/lib/upload';
import type { Course } from '@/lib/types';

function CircleAction({ icon: Icon, label, onPress, color = C.slate400 }: { icon: typeof Pencil; label: string; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel={label} hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }, shadowSm]}>
      <Icon size={18} color={color} strokeWidth={1.6} />
    </Pressable>
  );
}

export default function Courses() {
  const { data, setData, error, loading, refreshing, refresh, reload } = useApi<Course[]>('/courses');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadSyllabus = async () => {
    setUploading(true);
    try {
      const res = await pickAndUploadSyllabus('/upload');
      if (!res) return;
      if (!res.ok) return Alert.alert('Upload failed', res.error);
      await reload();
      const course = res.data?.course;
      if (course?.id) router.push({ pathname: '/courses/[id]', params: { id: course.id } });
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = (c: Course) =>
    Alert.alert(`Delete ${c.name}?`, 'This deletes the course and all of its deadlines, notes, and study tools. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setData((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
          try {
            await api(`/courses/${c.id}`, { method: 'DELETE' });
          } catch (e) {
            Alert.alert('Could not delete course', e instanceof Error ? e.message : '');
            reload();
          }
        },
      },
    ]);

  return (
    <PageBackground>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 28, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <T size={30} weight="semibold" color={C.slate900} style={{ lineHeight: 36, letterSpacing: -0.5 }}>Courses</T>
        <T size={16} color={C.slate600} style={{ marginTop: 6 }}>Your syllabi, deadlines, and study materials in one place.</T>
        <GradientButton title="+ Add Course" style={{ alignSelf: 'flex-start', marginTop: 16 }} onPress={() => setAdding(true)} />

        {error ? <T color={C.red} style={{ marginTop: 16 }}>{error}</T> : null}
        {loading && !data ? <Spinner /> : null}

        <View style={{ gap: 24, marginTop: 32 }}>
          {(data ?? []).map((c) => {
            const color = getCourseColor(c.id, c.color);
            return (
              <Pressable key={c.id} onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id } })} style={({ pressed }) => [{ borderRadius: 16, transform: [{ scale: pressed ? 0.99 : 1 }] }, shadowSm]}>
                <LinearGradient colors={color.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 24, minHeight: 180, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>{c.code || 'Course'}</Eyebrow>
                      <T size={18} weight="semibold" color={C.slate900} style={{ marginTop: 8, lineHeight: 26 }}>{c.name}</T>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <CircleAction icon={Pencil} label="Edit course" onPress={() => setEditing(c)} />
                      <CircleAction icon={Trash2} label="Delete course" onPress={() => confirmDelete(c)} />
                      <CircleAction icon={CalendarDays} label="Calendar" color={C.slate600} onPress={() => router.navigate('/calendar')} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <T size={12} weight="semibold" color={C.slate700}>{c.semester || 'Term TBD'}</T>
                    </View>
                    <T size={12} weight="medium" color={C.slate600}>{c.deadline_count} deadlines</T>
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}

          {data ? (
            <>
              <DashedBox onPress={uploading ? undefined : uploadSyllabus} style={{ minHeight: 180, borderColor: '#C7D2FE', backgroundColor: C.white }}>
                {uploading ? <ActivityIndicator color={C.brand} /> : <IconSquare icon={Upload} bg="#EEF2FF" fg={C.brand} size={56} radius={28} />}
                <T size={15} weight="medium" color={C.slate700} style={{ marginTop: 12 }}>{uploading ? 'Reading your syllabus…' : 'Upload a syllabus'}</T>
                <T size={12} color={C.slate400} style={{ marginTop: 4 }}>{uploading ? 'This takes about 30 seconds' : 'PDF / Word · creates the course for you'}</T>
              </DashedBox>
              <DashedBox onPress={() => setAdding(true)} style={{ minHeight: 180, backgroundColor: C.white }}>
                <IconSquare icon={Plus} bg="#EEF2FF" fg={C.brand} size={56} radius={28} />
                <T size={15} weight="medium" color={C.slate600} style={{ marginTop: 12 }}>Add Course</T>
              </DashedBox>
            </>
          ) : null}
        </View>
      </ScrollView>

      <CourseFormModal
        visible={adding}
        title="Add Course"
        submitLabel="Add Course"
        onClose={() => setAdding(false)}
        onSubmit={async (v) => {
          await api('/courses', { method: 'POST', body: JSON.stringify({ name: v.name, code: v.code || null, semester: v.semester || null }) });
          await reload();
        }}
      />
      <CourseFormModal
        visible={!!editing}
        title="Edit Course"
        submitLabel="Save changes"
        showColor
        initial={editing ? { name: editing.name, code: editing.code ?? '', semester: editing.semester ?? '', color: editing.color } : undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          if (!editing) return;
          await api(`/courses/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name: v.name, code: v.code || null, semester: v.semester || null, ...(v.color ? { color: v.color } : {}) }) });
          await reload();
        }}
      />
    </PageBackground>
  );
}
