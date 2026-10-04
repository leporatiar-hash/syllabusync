import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Check, ChevronRight, FileText, HelpCircle, Layers, Sparkles, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Card, DashedBox, GradientButton, IconSquare, T } from '@/components/web';
import { C } from '@/constants/theme';
import { apiRaw, errorMessage } from '@/lib/api';
import { presentPaywall, purchasesEnabled } from '@/lib/purchases';
import type { CourseDetail } from '@/lib/types';

type Kind = 'flashcards' | 'quiz' | 'summary';
const OPTIONS: { kind: Kind; title: string; body: string; icon: typeof Layers; color: string }[] = [
  { kind: 'flashcards', title: 'Flashcards', body: 'Generate 10-20 question/answer cards', icon: Layers, color: C.brand },
  { kind: 'quiz', title: 'Mini Quiz', body: 'Generate 5-10 multiple choice questions', icon: HelpCircle, color: C.lavender },
  { kind: 'summary', title: 'Summary Notes', body: 'AI-generated study summaries', icon: FileText, color: '#38BDF8' },
];
const ENDPOINT: Record<Kind, (id: string) => string> = {
  flashcards: (id) => `/courses/${id}/flashcards`,
  quiz: (id) => `/courses/${id}/generate-quiz`,
  summary: (id) => `/courses/${id}/summaries`,
};

export function StudyTab({ course, onGenerated }: { course: CourseDetail; onGenerated: () => void }) {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selected, setSelected] = useState<Record<Kind, boolean>>({ flashcards: true, quiz: true, summary: true });
  const [busy, setBusy] = useState<Kind | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      if ((res.assets[0].size ?? 0) > 10 * 1024 * 1024) return Alert.alert('File too large', 'Max 10MB.');
      setFile(res.assets[0]);
    }
  };

  const generate = async () => {
    if (!file) return;
    for (const kind of OPTIONS.map((o) => o.kind).filter((k) => selected[k])) {
      setBusy(kind);
      const body = new FormData();
      body.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      const r = await apiRaw(ENDPOINT[kind](course.id), { method: 'POST', body });
      if (!r.ok) {
        setBusy(null);
        const msg = await errorMessage(r);
        if (r.status === 403 && purchasesEnabled) {
          Alert.alert('You’ve hit the free limit', msg, [
            { text: 'Not now', style: 'cancel' },
            { text: 'See Pro', onPress: () => presentPaywall().then((ok) => ok && onGenerated()) },
          ]);
        } else Alert.alert('Couldn’t generate', msg);
        onGenerated();
        return;
      }
    }
    setBusy(null);
    setFile(null);
    onGenerated();
  };

  const tools = [
    ...course.flashcard_sets.map((s) => ({ id: s.id, kind: 'flashcards' as const, title: s.name, meta: `${s.card_count} cards`, at: s.created_at })),
    ...course.quizzes.map((q) => ({ id: q.id, kind: 'quiz' as const, title: q.name, meta: `${q.question_count} questions`, at: q.created_at })),
    ...course.summaries.map((s) => ({ id: s.id, kind: 'summary' as const, title: s.title, meta: 'Summary', at: s.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const iconFor = (k: Kind) => OPTIONS.find((o) => o.kind === k)!;
  const anySelected = Object.values(selected).some(Boolean);

  return (
    <View style={{ gap: 16 }}>
      <Card radius={24} padding={20}>
        <View style={{ alignItems: 'center' }}>
          <IconSquare icon={Sparkles} bg="#EEF2FF" fg={C.brand} size={56} radius={28} />
          <T size={22} weight="semibold" color={C.slate900} style={{ marginTop: 12 }}>Study Tools</T>
          <T size={14} color={C.slate500} style={{ textAlign: 'center', marginTop: 4 }}>Upload study materials to generate AI-powered learning aids.</T>
        </View>

        <DashedBox onPress={pick} style={{ marginTop: 20, paddingVertical: 32 }}>
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate100, alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={22} color={C.slate500} />
          </View>
          {file ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <T size={15} weight="medium" color={C.slate800} numberOfLines={1} style={{ maxWidth: 220 }}>{file.name}</T>
              <Pressable onPress={() => setFile(null)} hitSlop={8}><X size={16} color={C.slate400} /></Pressable>
            </View>
          ) : (
            <T size={15} weight="medium" color={C.slate700} style={{ marginTop: 12 }}>Tap to choose a file</T>
          )}
          <T size={12} color={C.slate400} style={{ marginTop: 4 }}>Accepts: PDF, DOCX, TXT, PNG, JPG (max 10MB)</T>
        </DashedBox>

        <T size={14} weight="medium" color={C.slate700} style={{ marginTop: 20, marginBottom: 8 }}>What would you like to generate?</T>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o) => {
            const on = selected[o.kind];
            const Icon = o.icon;
            return (
              <Pressable key={o.kind} onPress={() => setSelected({ ...selected, [o.kind]: !on })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.slate200, borderRadius: 12, padding: 14 }}>
                <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: on ? '#0A84FF' : C.white, borderWidth: on ? 0 : 1.5, borderColor: C.slate300, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon size={16} color={o.color} />
                    <T size={15} weight="medium" color={C.slate900}>{o.title}</T>
                  </View>
                  <T size={12} color={C.slate500} style={{ marginTop: 2 }}>{o.body}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
        <GradientButton
          title={busy ? `Generating ${iconFor(busy).title.toLowerCase()}…` : 'Generate Study Tools'}
          icon={busy ? undefined : <Sparkles size={16} color="#fff" />}
          size="lg"
          loading={false}
          disabled={!file || !anySelected || !!busy}
          style={{ marginTop: 20 }}
          onPress={generate}
        />
      </Card>

      {tools.length ? (
        <Card radius={24} padding={20}>
          <T size={18} weight="semibold" color={C.slate900} style={{ marginBottom: 8 }}>Your Study Tools</T>
          {tools.map((t, i) => {
            const o = iconFor(t.kind);
            return (
              <Pressable
                key={`${t.kind}-${t.id}`}
                onPress={() => router.push({ pathname: `/courses/${t.kind}/[toolId]` as never, params: { toolId: t.id, courseId: course.id } } as never)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100, opacity: pressed ? 0.7 : 1 })}>
                <IconSquare icon={o.icon} bg={t.kind === 'flashcards' ? '#E0EAFF' : t.kind === 'quiz' ? '#F3E8FF' : '#E0F2FE'} fg={o.color} />
                <View style={{ flex: 1 }}>
                  <T size={14} weight="medium" color={C.slate800} numberOfLines={2}>{t.title}</T>
                  <T size={12} color={C.slate500}>{t.meta}</T>
                </View>
                <ChevronRight size={16} color={C.slate300} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}
