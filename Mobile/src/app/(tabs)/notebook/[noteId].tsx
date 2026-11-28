import { useLocalSearchParams } from 'expo-router';

import { NoteEditor } from '@/components/note-editor';

export default function NotebookNoteScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  return <NoteEditor noteId={noteId} backLabel="Notebook" />;
}
