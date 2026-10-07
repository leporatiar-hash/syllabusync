import * as Haptics from 'expo-haptics';
import { Check, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { advance, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { SchoolLogo } from '@/components/school-logo';
import { T } from '@/components/web';
import { C, F, shadowSm } from '@/constants/theme';
import { api } from '@/lib/api';
import { type School, schoolLms, searchSchools, suggestSchool } from '@/lib/schools';

function SchoolRow({ school, selected, onPress, index }: { school: School; selected: boolean; onPress: () => void; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 35).duration(260)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderCurve: 'continuous',
          borderWidth: 2, borderColor: selected ? C.brand : 'transparent', backgroundColor: selected ? '#F2F6FF' : C.white,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }, shadowSm]}>
        <SchoolLogo domain={school.domain} name={school.name} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="semibold" color={C.slate900} numberOfLines={2}>{school.name}</T>
          <T size={13} color={C.slate400} numberOfLines={1}>{school.domain}</T>
        </View>
        {selected ? <Check size={20} color={C.brand} strokeWidth={3} /> : null}
      </Pressable>
    </Animated.View>
  );
}

export default function SchoolStep() {
  const { answers, set } = useQuiz();
  const [suggested, setSuggested] = useState<School | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Their .edu email usually tells us; gmail etc. just get the search box.
    suggestSchool().then(setSuggested).catch(() => {});
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchSchools(term).catch(() => [] as School[]);
      if (live) {
        setResults(r.slice(0, 8));
        setSearching(false);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const choose = (school: School | null, typedName?: string) => {
    Haptics.selectionAsync();
    const name = school?.name ?? typedName ?? '';
    const changed = (school?.domain ?? null) !== answers.schoolDomain;
    set({ school: name, schoolDomain: school?.domain ?? null, ...(changed ? { lms: null, lmsHost: null, lmsName: null } : {}) });
    if (school) schoolLms(school.domain); // start LMS detection now; the LMS step picks it up
    api('/me/profile', { method: 'POST', body: JSON.stringify({ school_name: name, school_domain: school?.domain ?? undefined }) }).catch(() => {});
    advance('year');
  };

  const first = answers.firstName.trim();
  const term = q.trim();
  const shown = term ? results : [];
  const exact = shown.some((s) => s.name.toLowerCase() === term.toLowerCase());

  return (
    <QuizScreen title={first ? `Hey ${first}. Where do you go?` : 'Where do you go?'} subtitle={suggested ? undefined : 'Search by name or abbreviation, like CofC or UGA.'} align="top">
      {suggested && !term ? (
        <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 8 }}>
          <T size={13} weight="semibold" color={C.slate400} style={{ letterSpacing: 0.6 }}>FROM YOUR EMAIL</T>
          <Pressable
            onPress={() => choose(suggested)}
            style={({ pressed }) => [{
              alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 18, borderRadius: 24, borderCurve: 'continuous',
              backgroundColor: C.white, borderWidth: 2, borderColor: answers.schoolDomain === suggested.domain ? C.brand : C.slate200,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }, shadowSm]}>
            <SchoolLogo domain={suggested.domain} name={suggested.name} size={72} />
            <T size={20} weight="bold" color={C.slate900} style={{ textAlign: 'center' }}>{suggested.name}</T>
            <View style={{ borderRadius: 999, backgroundColor: C.brand, paddingHorizontal: 18, paddingVertical: 9 }}>
              <T size={15} weight="semibold" color="#fff">That’s me</T>
            </View>
          </Pressable>
          <T size={13} weight="semibold" color={C.slate400} style={{ letterSpacing: 0.6, marginTop: 12 }}>OR SEARCH</T>
        </Animated.View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 16, borderWidth: 2, borderColor: term ? C.brand : C.slate200, paddingHorizontal: 14 }}>
        <Search size={18} color={term ? C.brand : C.slate400} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Your school"
          placeholderTextColor={C.slate300}
          autoFocus={!suggested}
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, fontFamily: F.medium, fontSize: 18, color: C.slate900, paddingVertical: 14 }}
        />
        {searching ? <ActivityIndicator color={C.slate400} /> : term ? (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search"><X size={18} color={C.slate400} /></Pressable>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        {shown.map((s, i) => (
          <SchoolRow key={s.domain} school={s} index={i} selected={answers.schoolDomain === s.domain} onPress={() => choose(s)} />
        ))}
        {term && !searching && !exact ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <Pressable onPress={() => choose(null, term)} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <T size={15} weight="medium" color={C.slate500}>
                {shown.length ? 'Not here? ' : 'No matches. '}
                <T size={15} weight="semibold" color={C.brand}>Use “{term}”</T>
              </T>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </QuizScreen>
  );
}
