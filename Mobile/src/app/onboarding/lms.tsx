import { router } from 'expo-router';
import { CircleSlash, LayoutGrid, MonitorSmartphone, Palette, School } from 'lucide-react-native';

import { advance, ChoiceCard, type Lms, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { track } from '@/lib/analytics';

const OPTIONS: { value: Lms; label: string; sublabel?: string; icon: typeof School; color: string; bg: string }[] = [
  { value: 'oaks', label: 'OAKS', sublabel: 'College of Charleston', icon: School, color: '#7A1E2C', bg: '#F9E8EA' },
  { value: 'canvas', label: 'Canvas', icon: Palette, color: '#E24A3B', bg: '#FDE8E6' },
  { value: 'blackboard', label: 'Blackboard', icon: LayoutGrid, color: '#334155', bg: '#F1F5F9' },
  { value: 'other', label: 'Something else', sublabel: 'Moodle, Google Classroom…', icon: MonitorSmartphone, color: '#5B8DEF', bg: '#E0EAFF' },
  { value: 'none', label: 'My classes don’t use one', icon: CircleSlash, color: '#94A3B8', bg: '#F1F5F9' },
];

export default function LmsStep() {
  const { answers, set } = useQuiz();
  // OAKS is CofC's LMS: only lead with it for CofC students; everyone else sees it near the end.
  const sorted = answers.school === 'College of Charleston' ? OPTIONS : [...OPTIONS.slice(1, 4), OPTIONS[0], OPTIONS[4]];
  return (
    <QuizScreen title="Where do your classes live?">
      {sorted.map((o, i) => (
        <ChoiceCard
          key={o.value}
          index={i}
          icon={o.icon}
          color={o.color}
          bg={o.bg}
          label={o.label}
          sublabel={o.sublabel}
          selected={answers.lms === o.value}
          onPress={() => {
            set({ lms: o.value });
            if (o.value === 'none') {
              track('onboarding_lms_skipped', { reason: 'no_lms' });
              if (answers.mode === 'app') router.replace('/');
              else advance('syllabus');
            } else advance('connect');
          }}
        />
      ))}
    </QuizScreen>
  );
}
