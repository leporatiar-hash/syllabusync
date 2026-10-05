import { Building2, GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { advance, ChoiceCard, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { useAuth } from '@/lib/auth';
import { C, F } from '@/constants/theme';

// Suggest a school only when the student's email tells us where they go; otherwise just ask.
const SCHOOLS_BY_DOMAIN: Record<string, { name: string; place: string; color: string; bg: string }> = {
  'cofc.edu': { name: 'College of Charleston', place: 'Charleston, SC', color: '#7A1E2C', bg: '#F9E8EA' },
};

function schoolFromEmail(email?: string | null) {
  const domain = (email ?? '').toLowerCase().split('@')[1] ?? '';
  const key = Object.keys(SCHOOLS_BY_DOMAIN).find((d) => domain === d || domain.endsWith(`.${d}`));
  return key ? SCHOOLS_BY_DOMAIN[key] : null;
}

export default function SchoolStep() {
  const { answers, set } = useQuiz();
  const { me } = useAuth();
  const suggested = schoolFromEmail(me?.profile?.email);
  const COFC = suggested?.name ?? '';
  const [other, setOther] = useState(!suggested || (!!answers.school && answers.school !== COFC));
  const name = answers.firstName.trim();
  return (
    <QuizScreen
      title={name ? `Hey ${name}. Where do you go?` : 'Where do you go?'}
      footer={other ? <QuizButton title="Next" disabled={!answers.school.trim()} onPress={() => advance('year', 0)} /> : undefined}>
      {suggested ? (
        <>
          <ChoiceCard
            index={0}
            icon={GraduationCap}
            color={suggested.color}
            bg={suggested.bg}
            label={suggested.name}
            sublabel={suggested.place}
            selected={!other && answers.school === COFC}
            onPress={() => {
              setOther(false);
              set({ school: COFC });
              advance('year');
            }}
          />
          <ChoiceCard
            index={1}
            icon={Building2}
            label="Somewhere else"
            selected={other}
            onPress={() => {
              setOther(true);
              if (answers.school === COFC) set({ school: '' });
            }}
          />
        </>
      ) : null}
      {other ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <TextInput
            value={answers.school}
            onChangeText={(v) => set({ school: v })}
            placeholder="Your school’s name"
            placeholderTextColor={C.slate300}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => answers.school.trim() && advance('year', 0)}
            autoCorrect={false}
            style={{ fontFamily: F.medium, fontSize: 18, color: C.slate900, backgroundColor: C.white, borderRadius: 16, borderWidth: 2, borderColor: C.brand, paddingHorizontal: 16, paddingVertical: 14 }}
          />
        </Animated.View>
      ) : null}
    </QuizScreen>
  );
}
