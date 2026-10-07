import { router } from 'expo-router';
import { CircleSlash, Globe, LayoutGrid, Lock, MonitorSmartphone, Palette, Sun } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { advance, ChoiceCard, type Lms, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { SchoolLogo } from '@/components/school-logo';
import { BrandLoader, T } from '@/components/web';
import { C, F, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { identifyLms, type LmsOption, schoolLms } from '@/lib/schools';

const OPTIONS: { value: Lms; label: string; sublabel?: string; icon: typeof Palette; color: string; bg: string }[] = [
  { value: 'canvas', label: 'Canvas', icon: Palette, color: '#E24A3B', bg: '#FDE8E6' },
  { value: 'brightspace', label: 'Brightspace', sublabel: 'D2L', icon: Sun, color: '#F97316', bg: '#FFEDD5' },
  { value: 'blackboard', label: 'Blackboard', icon: LayoutGrid, color: '#334155', bg: '#F1F5F9' },
  { value: 'other', label: 'Something else', sublabel: 'Moodle, Google Classroom…', icon: MonitorSmartphone, color: '#5B8DEF', bg: '#E0EAFF' },
  { value: 'none', label: 'My classes don’t use one', icon: CircleSlash, color: '#94A3B8', bg: '#F1F5F9' },
];

const PROVIDER_LABEL = { brightspace: 'Brightspace', canvas: 'Canvas' } as const;

export default function LmsStep() {
  const { answers, set } = useQuiz();
  const domain = answers.schoolDomain;
  // A school LMS saved on the profile (reconnecting from the app) needs no detection.
  const saved: LmsOption | null =
    answers.lmsHost && (answers.lms === 'brightspace' || answers.lms === 'canvas')
      ? { provider: answers.lms, host: answers.lmsHost, name: answers.lmsName ?? PROVIDER_LABEL[answers.lms], source: 'profile' }
      : null;
  const [options, setOptions] = useState<LmsOption[] | null>(saved ? [saved] : domain ? null : []);
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState<'brightspace' | 'canvas' | null>(null);
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (saved || !domain) return;
    let live = true;
    schoolLms(domain).then((o) => {
      if (!live) return;
      setOptions(o);
      track('lms_detected', { domain, found: o.map((x) => x.provider).join(',') || 'none' });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const pick = (o: LmsOption) => {
    set({ lms: o.provider, lmsHost: o.host, lmsName: o.name });
    api('/me/profile', { method: 'POST', body: JSON.stringify({ lms_provider: o.provider, lms_host: o.host }) }).catch(() => {});
    advance('connect');
  };

  const chooseManual = (value: Lms) => {
    setError(null);
    if (value === 'brightspace' || value === 'canvas') {
      setAsking(value);
      return;
    }
    set({ lms: value, lmsHost: null, lmsName: null });
    if (value === 'none') {
      track('onboarding_lms_skipped', { reason: 'no_lms' });
      if (answers.mode === 'app') router.replace('/');
      else advance('syllabus');
    } else advance('connect');
  };

  const checkAddress = async () => {
    setChecking(true);
    setError(null);
    try {
      const o = await identifyLms(address);
      track('lms_address_entered', { provider: o.provider, matched: o.provider === asking });
      pick(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t check that address.');
    } finally {
      setChecking(false);
    }
  };

  // 1. Still looking up the school's LMS
  if (options === null) {
    return (
      <QuizScreen title="">
        <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', gap: 18, paddingVertical: 40 }}>
          <SchoolLogo domain={domain} name={answers.school || 'School'} size={64} />
          <BrandLoader size={40} label={`Finding ${answers.school || 'your school'}’s LMS…`} />
        </Animated.View>
      </QuizScreen>
    );
  }

  // 2. They picked Canvas/Brightspace themselves: ask where they sign in
  if (asking) {
    const example = asking === 'canvas' ? 'canvas.school.edu or school.instructure.com' : 'd2l.school.edu or school.brightspace.com';
    return (
      <QuizScreen
        title={`Where do you sign in to ${PROVIDER_LABEL[asking]}?`}
        subtitle="The web address you go to for your classes. We’ll check it."
        onSkip={() => { set({ lms: asking, lmsHost: null, lmsName: null }); advance('connect'); }}
        skipLabel="I don’t know"
        footer={<QuizButton title="Continue" disabled={!address.trim()} loading={checking} onPress={checkAddress} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 16, borderWidth: 2, borderColor: error ? C.red : C.brand, paddingHorizontal: 14 }}>
          <Globe size={18} color={C.slate400} />
          <TextInput
            value={address}
            onChangeText={(v) => { setAddress(v); setError(null); }}
            placeholder={example}
            placeholderTextColor={C.slate300}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => address.trim() && checkAddress()}
            style={{ flex: 1, fontFamily: F.medium, fontSize: 17, color: C.slate900, paddingVertical: 14 }}
          />
        </View>
        {error ? <T size={14} color={C.red}>{error}</T> : null}
        <Pressable onPress={() => setAsking(null)} hitSlop={8} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <T size={14} weight="medium" color={C.slate500}>Pick a different LMS</T>
        </Pressable>
      </QuizScreen>
    );
  }

  // 3. Found it: one big "that's it"
  const best = options[0];
  if (best && !showAll) {
    const alt = options[1];
    return (
      <QuizScreen
        title="Found your LMS"
        footer={<QuizButton title={`Yes, sign in to ${best.name}`} onPress={() => { track('lms_detected_confirmed', { provider: best.provider, host: best.host }); pick(best); }} />}
        onSkip={() => setShowAll(true)}
        skipLabel="That’s not it">
        <Animated.View entering={ZoomIn.springify().damping(14)} style={[{ alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 28, borderCurve: 'continuous', paddingVertical: 30, paddingHorizontal: 20 }, shadowSm]}>
          <SchoolLogo domain={domain} name={answers.school || best.name} size={76} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <T size={15} color={C.slate500} style={{ textAlign: 'center' }}>{answers.school}</T>
            <T size={26} weight="bold" color={C.slate900} style={{ textAlign: 'center' }}>{best.name}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.slate50, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Lock size={12} color={C.slate400} />
            <T size={13} color={C.slate500}>{best.host}</T>
          </View>
        </Animated.View>
        {alt ? (
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Pressable onPress={() => pick(alt)} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <T size={15} weight="medium" color={C.slate500}>
                We use <T size={15} weight="semibold" color={C.brand}>{alt.name}</T> instead
              </T>
            </Pressable>
          </Animated.View>
        ) : null}
      </QuizScreen>
    );
  }

  // 4. Couldn't tell (or it was wrong): pick from the list
  return (
    <QuizScreen title="Where do your classes live?" subtitle={domain && !best ? `We couldn’t tell what ${answers.school} uses.` : undefined}>
      {OPTIONS.map((o, i) => (
        <ChoiceCard
          key={o.value}
          index={i}
          icon={o.icon}
          color={o.color}
          bg={o.bg}
          label={o.label}
          sublabel={o.sublabel}
          selected={answers.lms === o.value}
          onPress={() => chooseManual(o.value)}
        />
      ))}
    </QuizScreen>
  );
}
