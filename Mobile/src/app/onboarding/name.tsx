import { TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { advance, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { C, F } from '@/constants/theme';

export default function NameStep() {
  const { answers, set } = useQuiz();
  const ok = answers.firstName.trim().length > 0;
  return (
    <QuizScreen
      back={false}
      title="First, what’s your name?"
      footer={<QuizButton title="Next" disabled={!ok} onPress={() => advance('school', 0)} />}>
      <Animated.View entering={FadeInDown.delay(120).duration(360)}>
        <TextInput
          value={answers.firstName}
          onChangeText={(v) => set({ firstName: v })}
          placeholder="First name"
          placeholderTextColor={C.slate300}
          autoFocus
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => ok && advance('school', 0)}
          style={{ fontFamily: F.semibold, fontSize: 28, color: C.slate900, backgroundColor: C.white, borderRadius: 20, borderWidth: 2, borderColor: ok ? C.brand : C.slate200, paddingHorizontal: 20, paddingVertical: 18 }}
        />
      </Animated.View>
    </QuizScreen>
  );
}
