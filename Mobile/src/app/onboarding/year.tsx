import { Award, BookOpen, Brain, CalendarRange, Sprout, Target } from 'lucide-react-native';
import { View } from 'react-native';

import { advance, ChoiceCard, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';

const YEARS = [
  { value: 'Freshman', label: 'Freshman', icon: Sprout, color: '#22A55A', bg: '#DCFCE7' },
  { value: 'Sophomore', label: 'Sophomore', icon: BookOpen, color: '#38BDF8', bg: '#E0F2FE' },
  { value: 'Junior', label: 'Junior', icon: Target, color: '#FB923C', bg: '#FFEDD5' },
  { value: 'Senior', label: 'Senior', icon: Award, color: '#A78BFA', bg: '#F3E8FF' },
  { value: 'Graduate', label: 'Grad student', icon: Brain, color: '#5B8DEF', bg: '#E0EAFF' },
  { value: 'Other', label: 'Something else', icon: CalendarRange, color: '#64748B', bg: '#F1F5F9' },
];

export default function YearStep() {
  const { answers, set } = useQuiz();
  const { me, refreshMe } = useAuth();

  const choose = (year: string) => {
    set({ year });
    // Save what we know so far; onboarding can be abandoned at any later step.
    api('/me/profile', {
      method: 'POST',
      body: JSON.stringify({
        email: me?.profile?.email,
        full_name: answers.firstName.trim() || null,
        school_name: answers.school.trim() || null,
        school_domain: answers.schoolDomain ?? undefined,
        academic_year: year === 'Other' ? null : year,
        school_type: year === 'Graduate' ? 'Graduate School' : 'University',
      }),
    })
      .then(() => refreshMe())
      .catch(() => {});
    track('onboarding_school_saved', { school: answers.school.trim() || null, year });
    advance('goals');
  };

  return (
    <QuizScreen title="What year are you?">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
        {YEARS.map((y, i) => (
          <ChoiceCard key={y.value} compact index={i} icon={y.icon} color={y.color} bg={y.bg} label={y.label} selected={answers.year === y.value} onPress={() => choose(y.value)} />
        ))}
      </View>
    </QuizScreen>
  );
}
