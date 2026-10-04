import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, View } from 'react-native';

import { WebInput } from '@/components/course-form';
import { OnboardingShell } from '@/components/onboarding-shell';
import { GradientButton, T } from '@/components/web';
import { C } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD'];
// Most students are at CofC today; one tap fills it in. Anyone else types their school.
const SUGGESTED = ['College of Charleston'];

export default function SchoolStep() {
  const { me, refreshMe } = useAuth();
  const [name, setName] = useState(me?.profile?.full_name ?? '');
  const [school, setSchool] = useState(me?.profile?.school_name ?? '');
  const [year, setYear] = useState(me?.profile?.academic_year ?? '');
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setBusy(true);
    try {
      await api('/me/profile', {
        method: 'POST',
        body: JSON.stringify({ email: me?.profile?.email, full_name: name.trim() || null, school_name: school.trim() || null, academic_year: year || null, school_type: 'University' }),
      });
      track('onboarding_school_saved', { school: school.trim() || null });
      refreshMe();
      router.push('/onboarding/calendar');
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell
      step={0}
      title="Let’s set up your semester"
      subtitle="Takes about a minute. Then every deadline you have is in one place."
      footer={<GradientButton title="Continue" size="lg" loading={busy} disabled={!school.trim()} onPress={next} />}>
      <WebInput label="Your name" placeholder="First and last name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <View style={{ gap: 8 }}>
        <WebInput label="School" placeholder="e.g. College of Charleston" value={school} onChangeText={setSchool} autoCorrect={false} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED.filter((s) => s !== school).map((s) => (
            <Pressable key={s} onPress={() => setSchool(s)} style={{ borderRadius: 999, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6 }}>
              <T size={13} weight="medium" color={C.brand}>{s}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <T size={14} weight="medium" color={C.slate700}>Year <T size={14} color={C.slate400}>(optional)</T></T>
        <Pressable
          onPress={() => ActionSheetIOS.showActionSheetWithOptions({ options: [...YEARS, 'Cancel'], cancelButtonIndex: YEARS.length }, (i) => i < YEARS.length && setYear(YEARS[i]))}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.white }}>
          <T size={15} color={year ? C.slate900 : C.slate400}>{year || 'Select...'}</T>
          <ChevronDown size={16} color={C.slate500} />
        </Pressable>
      </View>
    </OnboardingShell>
  );
}
