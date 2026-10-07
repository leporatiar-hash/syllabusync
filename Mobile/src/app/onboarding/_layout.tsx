import { Stack, useGlobalSearchParams } from 'expo-router';

import { QuizProvider } from '@/components/quiz-kit';
import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { lmsBrand } from '@/lib/schools';

export default function OnboardingLayout() {
  const { me } = useAuth();
  const p = me?.profile;
  const { from } = useGlobalSearchParams<{ from?: string }>();
  return (
    <QuizProvider
      initial={{
        firstName: p?.full_name?.split(' ')[0] ?? '',
        school: p?.school_name ?? '',
        schoolDomain: p?.school_domain ?? null,
        year: p?.academic_year ?? '',
        // A school LMS saved on the profile means reconnecting skips straight to sign-in.
        lms: p?.lms_provider ?? null,
        lmsHost: p?.lms_host ?? null,
        lmsName: p?.lms_host ? lmsBrand(p.lms_host, p.lms_provider) : null,
        mode: from === 'app' ? 'app' : 'onboarding',
      }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.pageBg }, animation: 'slide_from_right' }} />
    </QuizProvider>
  );
}
