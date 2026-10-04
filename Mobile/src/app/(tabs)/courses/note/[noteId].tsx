import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { PageBackground, Spinner, T } from '@/components/web';
import { C, F } from '@/constants/theme';
import { api } from '@/lib/api';
import { textToDoc } from '@/lib/noteDoc';
import type { Note } from '@/lib/types';

type Status = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Plain-text note editor. Formatting uses the same line markers the web editor exports
 * (# heading, - bullet, 1. numbered, [ ] checklist, **bold**), and every save sends the rich
 * document built from them so the note keeps its formatting in the web editor.
 */
export default function NoteEditor() {
  const { noteId } = useLocalSearchParams<{ noteId: string; courseId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: '', body: '' });

  useEffect(() => {
    api<Note>(`/notes/${noteId}`).then((n) => {
      setNote(n);
      setTitle(n.title);
      setBody(n.content);
      latest.current = { title: n.title, body: n.content };
    });
  }, [noteId]);

  const save = async () => {
    setStatus('saving');
    try {
      const { title: t, body: b } = latest.current;
      await api(`/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ title: t, content: b, content_json: textToDoc(b) }) });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const schedule = (next: { title?: string; body?: string }) => {
    latest.current = { ...latest.current, ...next };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  };

  // Flush a pending save when leaving the screen.
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      save();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = () =>
    Alert.alert('Delete this note?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          await api(`/notes/${noteId}`, { method: 'DELETE' }).catch(() => {});
          router.back();
        },
      },
    ]);

  const statusText = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Couldn’t save — will retry' : '';

  return (
    <PageBackground>
      <BackBar
        label="Notes"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <T size={12} color={status === 'error' ? C.red : C.slate400}>{statusText}</T>
            <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete note"><Trash2 size={18} color={C.slate400} /></Pressable>
          </View>
        }
      />
      {!note ? <Spinner /> : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={120}>
          <ScrollView keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 24, padding: 20, minHeight: 420 }}>
              <TextInput
                value={title}
                onChangeText={(v) => { setTitle(v); schedule({ title: v }); }}
                placeholder="Untitled note"
                placeholderTextColor={C.slate300}
                style={{ fontFamily: F.semibold, fontSize: 22, color: C.slate900, paddingVertical: 4 }}
              />
              <TextInput
                value={body}
                onChangeText={(v) => { setBody(v); schedule({ body: v }); }}
                placeholder={'Start typing…\n\nTip: # heading, - bullet, [ ] checklist, **bold**'}
                placeholderTextColor={C.slate300}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: C.slate800, marginTop: 12, minHeight: 340 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </PageBackground>
  );
}
