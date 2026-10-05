import { Building2, GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { advance, ChoiceCard, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { C, F } from '@/constants/theme';

const COFC = 'College of Charleston';

export default function SchoolStep() {
  const { answers, set } = useQuiz();
  const [other, setOther] = useState(!!answers.school && answers.school !== COFC);
  const name = answers.firstName.trim();
  return (
    <QuizScreen
      title={name ? `Hey ${name}. Where do you go?` : 'Where do you go?'}
      footer={other ? <QuizButton title="Next" disabled={!answers.school.trim()} onPress={() => advance('year', 0)} /> : undefined}>
      <ChoiceCard
        index={0}
        icon={GraduationCap}
        color="#7A1E2C"
        bg="#F9E8EA"
        label={COFC}
        sublabel="Charleston, SC"
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
      {other ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <TextInput
            value={answers.school}
            onChangeText={(v) => set({ school: v })}
            placeholder="Your school’s name"
            placeholderTextColor={C.slate300}
            autoFocus
            autoCorrect={false}
            style={{ fontFamily: F.medium, fontSize: 18, color: C.slate900, backgroundColor: C.white, borderRadius: 16, borderWidth: 2, borderColor: C.brand, paddingHorizontal: 16, paddingVertical: 14 }}
          />
        </Animated.View>
      ) : null}
    </QuizScreen>
  );
}
