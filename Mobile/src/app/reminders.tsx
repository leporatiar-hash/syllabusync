import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bell, CalendarDays, Clock, GraduationCap } from 'lucide-react-native';

import { Card, GradientButton, IconSquare, OutlineButton, T } from '@/components/web';
import { C, Spacing } from '@/constants/theme';
import { registerForPush, REMINDERS_ASKED_KEY } from '@/lib/notifications';

const ITEMS = [
  { icon: Clock, title: '3 days and 1 day before', body: 'Every assignment, quiz, and project.' },
  { icon: GraduationCap, title: 'A week before exams', body: 'Enough time to actually study.' },
  { icon: CalendarDays, title: 'Sunday night brief', body: 'Your week at a glance.' },
];

/** Explains reminders before the iOS permission prompt (which can only be shown once). */
export default function Reminders() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const done = async () => {
    await SecureStore.setItemAsync(REMINDERS_ASKED_KEY, '1');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg, padding: Spacing.five, paddingBottom: insets.bottom + Spacing.four, gap: Spacing.four }}>
      <View style={{ alignItems: 'center', gap: Spacing.three, marginTop: Spacing.five }}>
        <IconSquare icon={Bell} bg={C.brand} fg="#fff" size={72} radius={20} />
        <T size={26} weight="semibold" color={C.slate900} style={{ textAlign: 'center', lineHeight: 32 }}>Never miss a deadline</T>
        <T size={15} color={C.slate500} style={{ textAlign: 'center' }}>ClassMate reminds you in the evening, before things are due.</T>
      </View>
      <Card radius={24} padding={20} style={{ gap: Spacing.four }}>
        {ITEMS.map((it) => (
          <View key={it.title} style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
            <IconSquare icon={it.icon} bg="#EEF2FF" fg={C.brand} size={36} radius={10} />
            <View style={{ flex: 1 }}>
              <T size={14} weight="semibold" color={C.slate900}>{it.title}</T>
              <T size={12} color={C.slate500}>{it.body}</T>
            </View>
          </View>
        ))}
      </Card>
      <View style={{ flex: 1 }} />
      <GradientButton
        title="Turn on reminders"
        size="lg"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await registerForPush(true);
          await done();
        }}
      />
      <OutlineButton title="Not now" onPress={done} />
      <T size={12} color={C.slate400} style={{ textAlign: 'center' }}>You can change this anytime in Settings.</T>
    </View>
  );
}
