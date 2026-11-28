import {
  CoreBridge,
  EditorKeyboardAvoidingView,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
} from '@10play/tentap-editor';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ClipboardPaste, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, TextInput, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { Spinner, T } from '@/components/web';
import { C, F, getCourseColor } from '@/constants/theme';
import { api } from '@/lib/api';
import { docToText, textToDoc, type NoteDoc } from '@/lib/noteDoc';
import type { Note } from '@/lib/types';

type Status = 'idle' | 'saving' | 'saved' | 'error';
const TAB_BAR_SPACE = 86; // the floating tab bar covers this much when the keyboard is down
type CourseLite = { id: string; code: string | null; name: string; color: string | null };

// The editor runs in a web view: match the app's type (Inter is the app font; system as fallback).
const EDITOR_CSS = `
  * { font-family: Inter, -apple-system, system-ui, sans-serif; }
  body { margin: 0; padding: 0 2px; color: #0f172a; font-size: 17px; line-height: 1.6; background: transparent; }
  p { margin: 0 0 6px; }
  h1, h2, h3 { line-height: 1.3; margin: 14px 0 6px; } h1 { font-size: 24px; } h2 { font-size: 20px; } h3 { font-size: 18px; }
  ul, ol { padding-left: 22px; margin: 4px 0; }
  ul[data-type="taskList"] { padding-left: 2px; }
  .is-editor-empty:first-child::before, p.is-empty:first-child::before { color: #cbd5e1; }
`;

function dateLabel(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Granola-style note page: class and date on top, a big title, then a rich editor that saves on its own.
 *  Same document format as the website's editor, so a note looks the same everywhere (and Claude reads its text). */
export function NoteEditor({ noteId, backLabel }: { noteId: string; backLabel: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [course, setCourse] = useState<CourseLite | null>(null);
  useEffect(() => {
    api<Note>(`/notes/${noteId}`).then((n) => {
      setNote(n);
      api<CourseLite>(`/courses/${n.course_id}`).then(setCourse).catch(() => {});
    });
  }, [noteId]);
  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <BackBar label={backLabel} />
        <Spinner />
      </View>
    );
  }
  return <LoadedEditor note={note} course={course} backLabel={backLabel} />;
}

function LoadedEditor({ note, course, backLabel }: { note: Note; course: CourseLite | null; backLabel: string }) {
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<Status>('idle');
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ title: string; docChanged: boolean }>({ title: note.title, docChanged: false });
  const everTyped = useRef(false); // any edit to the body since the page opened

  const initial = (note.content_json as NoteDoc | null) ?? textToDoc(note.content || '');
  const editor = useEditorBridge({
    autofocus: !note.content && !!note.title,
    avoidIosKeyboard: true,
    initialContent: initial,
    onChange: () => { everTyped.current = true; schedule({ docChanged: true }); },
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(EDITOR_CSS),
      PlaceholderBridge.configureExtension({ placeholder: 'Start typing, or paste notes from anywhere' }),
    ],
  });
  const save = async () => {
    const { title: t, docChanged } = latest.current;
    setStatus('saving');
    try {
      const body: Record<string, unknown> = { title: t };
      if (docChanged) {
        latest.current.docChanged = false; // edits made while this save is in flight schedule another
        const d = (await editor.getJSON()) as NoteDoc;
        Object.assign(body, { content: docToText(d), content_json: d });
      }
      await api(`/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setStatus('saved');
    } catch {
      if (docChanged) latest.current.docChanged = true;
      setStatus('error');
    }
  };
  const schedule = (next: Partial<typeof latest.current>) => {
    latest.current = { ...latest.current, ...next };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  };

  // Leaving the page: a brand-new note nobody wrote in is removed (no blank notes piling up, and
  // Claude never opens an empty one); otherwise save anything pending.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const untouched = !note.content.trim() && !everTyped.current && latest.current.title === note.title;
    if (untouched) {
      api(`/notes/${note.id}`, { method: 'DELETE' }).catch(() => {});
      return;
    }
    if (timer.current) save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).trim();
    if (!clip) { Alert.alert('Nothing to paste', 'Copy your notes first, then tap Paste.'); return; }
    const current = (await editor.getJSON()) as NoteDoc;
    const isEmpty = !docToText(current).trim();
    const added = textToDoc(clip);
    editor.setContent(isEmpty ? added : { ...current, content: [...(current.content ?? []), ...(added.content ?? [])] });
  };

  const remove = () =>
    Alert.alert('Delete this note?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          await api(`/notes/${note.id}`, { method: 'DELETE' }).catch(() => {});
          router.back();
        },
      },
    ]);

  const color = getCourseColor(course?.id, course?.color);
  const statusText = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Couldn’t save, will retry' : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <BackBar
        label={backLabel}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <T size={13} color={status === 'error' ? C.red : C.slate400}>{statusText}</T>
            <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete note"><Trash2 size={18} color={C.slate400} /></Pressable>
          </View>
        }
      />
      <EditorKeyboardAvoidingView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {course ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.light, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent }} />
                <T size={13} weight="semibold" color={color.text}>{course.code || course.name}</T>
              </View>
            ) : null}
            <T size={13} color={C.slate400}>{dateLabel(note.created_at)}</T>
          </View>
          <TextInput
            value={title}
            onChangeText={(v) => { setTitle(v); schedule({ title: v }); }}
            placeholder="Untitled note"
            placeholderTextColor={C.slate300}
            returnKeyType="next"
            onSubmitEditing={() => editor.focus('end')}
            style={{ fontFamily: F.bold, fontSize: 28, letterSpacing: -0.5, color: C.slate900, paddingVertical: 2 }}
          />
        </View>
        <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 6 }}>
          <RichText editor={editor} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.slate100, marginBottom: keyboardUp ? 0 : TAB_BAR_SPACE }}>
          <Pressable onPress={paste} accessibilityLabel="Paste notes" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
            <ClipboardPaste size={17} color={C.brandSolid} />
            <T size={14} weight="semibold" color={C.brandSolid}>Paste</T>
          </Pressable>
          <View style={{ flex: 1 }}><Toolbar editor={editor} /></View>
        </View>
      </EditorKeyboardAvoidingView>
    </View>
  );
}
