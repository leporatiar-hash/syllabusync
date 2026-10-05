import { BatteryLow, Brain, CalendarX2, Flame, Layers, Moon } from 'lucide-react-native';

import { ChoiceCard, goTo, type Goal, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { track } from '@/lib/analytics';

// Phrased the way students actually say it. Values map to reminder/paywall copy in ready.tsx.
const GOALS: { value: Goal; label: string; icon: typeof Layers; color: string; bg: string }[] = [
  { value: 'deadlines', label: 'I find out about due dates too late', icon: CalendarX2, color: '#FB7185', bg: '#FFE4E6' },
  { value: 'procrastinating', label: 'Everything happens at 2am', icon: Moon, color: '#6366F1', bg: '#E0E7FF' },
  { value: 'exams', label: 'I cram, then forget it all', icon: Flame, color: '#FB923C', bg: '#FFEDD5' },
  { value: 'understanding', label: 'I read it twice and it doesn’t stick', icon: Brain, color: '#A78BFA', bg: '#F3E8FF' },
  { value: 'overwhelmed', label: 'Classes + work + life = no time', icon: BatteryLow, color: '#38BDF8', bg: '#E0F2FE' },
];

export default function GoalsStep() {
  const { answers, set } = useQuiz();
  const toggle = (g: Goal) => set({ goals: answers.goals.includes(g) ? answers.goals.filter((x) => x !== g) : [...answers.goals, g] });
  return (
    <QuizScreen
      title="Be honest. Which of these is you?"
      subtitle="Pick all that apply."
      footer={
        <QuizButton
          title="Next"
          disabled={!answers.goals.length}
          onPress={() => {
            track('onboarding_goals', { goals: answers.goals.join(',') });
            goTo('lms');
          }}
        />
      }>
      {GOALS.map((g, i) => (
        <ChoiceCard key={g.value} multi index={i} icon={g.icon} color={g.color} bg={g.bg} label={g.label} selected={answers.goals.includes(g.value)} onPress={() => toggle(g.value)} />
      ))}
    </QuizScreen>
  );
}
