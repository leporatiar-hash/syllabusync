import { router } from 'expo-router';
import { NotebookPen, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Card, GradientButton, IconSquare, Spinner, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { Note } from '@/lib/types';

function preview(content: string) {
  const flat = content.replace(/^#+\s+|^\s*([-*]|\d+\.|\[[ x]\])\s+/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

export function NotesTab({ courseId }: { courseId: string }) {
  const { data, loading } = useApi<Note[]>(`/courses/${courseId}/notes`);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const note = await api<Note>(`/courses/${courseId}/notes`, { method: 'POST', body: JSON.stringify({ title: '', content: '' }) });
      router.push({ pathname: '/courses/note/[noteId]', params: { noteId: note.id, courseId } });
    } catch (e) {
      Alert.alert('Couldn’t create note', e instanceof Error ? e.message : '');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card radius={24} padding={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={18} weight="semibold" color={C.slate900}>Notes</T>
        <GradientButton title="New note" size="sm" icon={<Plus size={14} color="#fff" />} loading={creating} onPress={create} />
      </View>
      {loading && !data ? <Spinner /> : !data?.length ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <IconSquare icon={NotebookPen} bg={C.slate100} fg={C.slate500} size={56} radius={28} />
          <T size={15} weight="semibold" color={C.slate900} style={{ marginTop: 12 }}>No notes yet</T>
          <T size={13} color={C.slate500} style={{ marginTop: 4, textAlign: 'center' }}>Take notes for this class right here. They save automatically.</T>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {data.map((n, i) => (
            <Pressable key={n.id} onPress={() => router.push({ pathname: '/courses/note/[noteId]', params: { noteId: n.id, courseId } })} style={({ pressed }) => ({ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100, opacity: pressed ? 0.7 : 1 })}>
              <T size={15} weight="medium" color={C.slate900} numberOfLines={1}>{n.title || 'Untitled note'}</T>
              {n.content ? <T size={13} color={C.slate500} numberOfLines={2} style={{ marginTop: 2 }}>{preview(n.content)}</T> : null}
              <T size={12} color={C.slate400} style={{ marginTop: 4 }}>{new Date(n.updated_at.endsWith('Z') ? n.updated_at : `${n.updated_at}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</T>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}
