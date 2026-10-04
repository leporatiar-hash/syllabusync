import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { Card, GradientButton, OutlineButton, PageBackground, Spinner, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';

type Q = { id: string; question: string; options: string[] };
type Quiz = { id: string; name: string; questions: Q[] };
type Result = { score: number; total: number; percentage: number; results: { question_id: string; user_answer: string; correct_answer: string; is_correct: boolean; explanation: string }[] };

const letter = (opt: string, i: number) => opt.match(/^\s*([A-D])\)/)?.[1] ?? 'ABCD'[i];
const label = (opt: string) => opt.replace(/^\s*[A-D]\)\s*/, '');

export default function QuizScreen() {
  const { toolId } = useLocalSearchParams<{ toolId: string }>();
  const { data } = useApi<Quiz>(`/quizzes/${toolId}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<Result>(`/quizzes/${toolId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
      Haptics.notificationAsync(r.percentage >= 70 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      setResult(r);
    } catch (e) {
      Alert.alert('Couldn’t submit', e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  const byQ = Object.fromEntries((result?.results ?? []).map((r) => [r.question_id, r]));

  return (
    <PageBackground>
      <BackBar label="Study Tools" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {!data ? <Spinner /> : (
          <>
            <T size={22} weight="semibold" color={C.slate900}>{data.name}</T>
            {result ? (
              <Card radius={24} padding={20} style={{ alignItems: 'center', backgroundColor: result.percentage >= 70 ? '#ECFDF5' : '#FFF7ED' }}>
                <T size={36} weight="bold" color={result.percentage >= 70 ? C.green : C.orange}>{Math.round(result.percentage)}%</T>
                <T size={14} color={C.slate600}>{result.score} of {result.total} correct</T>
              </Card>
            ) : null}
            {data.questions.map((q, qi) => {
              const r = byQ[q.id];
              return (
                <Card key={q.id} radius={24} padding={20}>
                  <T size={12} weight="semibold" color={C.slate400} style={{ letterSpacing: 1.5 }}>QUESTION {qi + 1}</T>
                  <T size={16} weight="medium" color={C.slate900} style={{ marginTop: 6, lineHeight: 23 }}>{q.question}</T>
                  <View style={{ gap: 8, marginTop: 14 }}>
                    {q.options.map((opt, i) => {
                      const L = letter(opt, i);
                      const chosen = answers[q.id] === L;
                      const correct = r && r.correct_answer === L;
                      const wrongPick = r && chosen && !r.is_correct;
                      const border = correct ? C.green : wrongPick ? C.red : chosen ? C.brand : C.slate200;
                      const bg = correct ? '#ECFDF5' : wrongPick ? '#FEF2F2' : chosen ? '#EEF2FF' : C.white;
                      return (
                        <Pressable key={L} disabled={!!result} onPress={() => { Haptics.selectionAsync(); setAnswers({ ...answers, [q.id]: L }); }} style={{ flexDirection: 'row', gap: 10, borderWidth: 1.5, borderColor: border, backgroundColor: bg, borderRadius: 12, padding: 12 }}>
                          <T size={14} weight="semibold" color={chosen || correct ? border : C.slate400}>{L}</T>
                          <T size={14} color={C.slate800} style={{ flex: 1 }}>{label(opt)}</T>
                        </Pressable>
                      );
                    })}
                  </View>
                  {r?.explanation ? <T size={13} color={C.slate600} style={{ marginTop: 12, lineHeight: 19 }}>{r.explanation}</T> : null}
                </Card>
              );
            })}
            {result ? (
              <OutlineButton title="Try again" onPress={() => { setResult(null); setAnswers({}); }} />
            ) : (
              <GradientButton title={`Submit (${Object.keys(answers).length}/${data.questions.length})`} size="lg" loading={busy} disabled={!Object.keys(answers).length} onPress={submit} />
            )}
          </>
        )}
      </ScrollView>
    </PageBackground>
  );
}
