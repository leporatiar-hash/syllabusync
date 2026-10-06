import { Stack, useGlobalSearchParams } from 'expo-router';

import { QuizProvider } from '@/components/quiz-kit';
import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function OnboardingLayout() {
  const { me } = useAuth();
  const p = me?.profile;
  const { from } = useGlobalSearchParams<{ from?: string }>();
  return (
    <QuizProvider initial={{ firstName: p?.full_name?.split(' ')[0] ?? '', school: p?.school_name ?? '', year: p?.academic_year ?? '', mode: from === 'app' ? 'app' : 'onboarding' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.pageBg }, animation: 'slide_from_right' }} />
    </QuizProvider>
  );
}
