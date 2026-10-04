import { router } from 'expo-router';
import { Check, FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { OnboardingShell } from '@/components/onboarding-shell';
import { DashedBox, GradientButton, IconSquare, OutlineButton, T } from '@/components/web';
import { C } from '@/constants/theme';
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
      const deadlines = Array.isArray(res.data?.deadlines) ? res.data.deadlines.length : course?.deadline_count ?? 0;
      setUploaded((u) => [...u, { name: course?.name ?? 'Course', deadlines }]);
      track('syllabus_uploaded', { deadlines, source: 'onboarding' });
    } finally {
      setBusy(false);
    }
  };

  const finish = (skipped: boolean) => {
    if (skipped) track('onboarding_syllabus_skipped');
    router.push('/onboarding/ready');
  };

  return (
    <OnboardingShell
      step={2}
      title="Add a syllabus"
      subtitle="ClassMate reads it and pulls out every exam, quiz, and assignment, plus office hours, grading, and policies."
      onSkip={uploaded.length ? undefined : () => finish(true)}
      footer={
        uploaded.length ? (
          <>
            <GradientButton title="Continue" size="lg" onPress={() => finish(false)} />
            <OutlineButton title="Add another syllabus" onPress={upload} disabled={busy} />
          </>
        ) : (
          <OutlineButton title="Skip for now" onPress={() => finish(true)} />
        )
      }>
      {uploaded.map((u, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.emerald, alignItems: 'center', justifyContent: 'center' }}><Check size={14} color="#fff" strokeWidth={3} /></View>
          <T size={14} weight="medium" color="#047857" style={{ flex: 1 }}>{u.name} · {u.deadlines} deadline{u.deadlines === 1 ? '' : 's'} found</T>
        </View>
      ))}
      {!uploaded.length || busy ? (
        <DashedBox onPress={busy ? undefined : upload} style={{ minHeight: 220, backgroundColor: C.white, borderColor: '#C7D2FE' }}>
          {busy ? <ActivityIndicator color={C.brand} size="large" /> : <IconSquare icon={FileUp} bg="#EEF2FF" fg={C.brand} size={64} radius={32} />}
          <T size={16} weight="semibold" color={C.slate800} style={{ marginTop: 14 }}>{busy ? 'Reading your syllabus…' : 'Choose a syllabus'}</T>
          <T size={13} color={C.slate400} style={{ marginTop: 4, textAlign: 'center' }}>{busy ? 'About 30 seconds. Hang tight.' : 'PDF or Word, from Files, iCloud Drive, or Google Drive'}</T>
        </DashedBox>
      ) : null}
      {error ? <T size={14} color={C.red}>{error}</T> : null}
      <T size={12} color={C.slate400}>Tip: your syllabus is usually on the course page in OAKS or Canvas. Download it to Files, then pick it here.</T>
    </OnboardingShell>
  );
}
