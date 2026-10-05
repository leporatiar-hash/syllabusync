import * as Haptics from 'expo-haptics';
import { Check, FileUp, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { goTo, QuizButton, QuizScreen } from '@/components/quiz-kit';
import { T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { pickAndUploadSyllabus } from '@/lib/upload';

type Uploaded = { name: string; deadlines: number };

export default function SyllabusStep() {
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await pickAndUploadSyllabus('/upload');
      if (!res) return;
      if (!res.ok) return setError(res.error);
      const course = res.data?.course;
      if (!course) return setError(res.data?.debug?.message ?? 'We couldn’t read that file. Try a PDF with selectable text.');
      const deadlines = Array.isArray(res.data?.deadlines) ? res.data.deadlines.length : 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUploaded((u) => [...u, { name: course.name ?? 'Course', deadlines }]);
      track('syllabus_uploaded', { deadlines, source: 'onboarding' });
    } finally {
      setBusy(false);
    }
  };

  const total = uploaded.reduce((n, u) => n + u.deadlines, 0);

  return (
    <QuizScreen
      title={uploaded.length ? `${total} deadline${total === 1 ? '' : 's'} found` : 'Drop in a syllabus'}
      subtitle={uploaded.length ? undefined : 'We’ll pull out every exam and assignment.'}
      onSkip={uploaded.length ? undefined : () => { track('onboarding_syllabus_skipped'); goTo('ready'); }}
      skipLabel="Skip for now"
      footer={uploaded.length ? <QuizButton title="See my semester" onPress={() => goTo('ready')} /> : undefined}>
      {uploaded.map((u, i) => (
        <Animated.View key={i} entering={FadeInUp.springify()} style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 18, padding: 16 }, shadowSm]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={20} color={C.green} strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={16} weight="semibold" color={C.slate900} numberOfLines={1}>{u.name}</T>
            <T size={13} color={C.slate500}>{u.deadlines} deadline{u.deadlines === 1 ? '' : 's'} added</T>
          </View>
        </Animated.View>
      ))}

      <Animated.View entering={FadeInDown.delay(120).duration(380)}>
        <Pressable
          onPress={busy ? undefined : upload}
          style={({ pressed }) => [{
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minHeight: uploaded.length ? 96 : 220,
            borderRadius: 24,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#C7D2FE',
            backgroundColor: pressed ? '#EEF2FF' : C.white,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          }]}>
          {busy ? (
            <>
              <ActivityIndicator color={C.brand} size="large" />
              <T size={16} weight="semibold" color={C.slate800}>Reading your syllabus…</T>
              <T size={13} color={C.slate400}>About 30 seconds</T>
            </>
          ) : uploaded.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Plus size={18} color={C.brand} />
              <T size={16} weight="semibold" color={C.brand}>Add another syllabus</T>
            </View>
          ) : (
            <>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
                <FileUp size={32} color="#fff" />
              </View>
              <T size={18} weight="semibold" color={C.slate900}>Choose a file</T>
              <T size={13} color={C.slate400}>PDF or Word</T>
            </>
          )}
        </Pressable>
      </Animated.View>
      {error ? <T size={14} color={C.red}>{error}</T> : null}
    </QuizScreen>
  );
}
