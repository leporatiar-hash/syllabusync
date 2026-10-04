import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { registerForPush, REMINDERS_ASKED_KEY } from '@/lib/notifications';

const ITEMS = [
  { icon: 'clock', title: '3 days and 1 day before', body: 'Every assignment, quiz, and project.' },
  { icon: 'graduationcap', title: 'A week before exams', body: 'Enough time to actually study.' },
  { icon: 'calendar', title: 'Sunday night brief', body: 'Your week at a glance.' },
] as const;

/** Explains reminders before the iOS permission prompt (which can only be shown once). */
export default function Reminders() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const done = async () => {
    await SecureStore.setItemAsync(REMINDERS_ASKED_KEY, '1');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background, padding: Spacing.five, paddingBottom: insets.bottom + Spacing.four, gap: Spacing.four }}>
      <View style={{ alignItems: 'center', gap: Spacing.three, marginTop: Spacing.five }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell.badge.fill" size={36} color="#fff" />
        </View>
        <Text variant="title" style={{ textAlign: 'center' }}>Never miss a deadline</Text>
        <Text variant="secondary" style={{ textAlign: 'center' }}>ClassMate reminds you in the evening, before things are due.</Text>
      </View>
      <Card style={{ padding: Spacing.four, gap: Spacing.four }}>
        {ITEMS.map((it) => (
          <View key={it.title} style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
            <Icon name={it.icon} size={22} color={t.tint} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{it.title}</Text>
              <Text variant="caption">{it.body}</Text>
            </View>
          </View>
        ))}
      </Card>
      <View style={{ flex: 1 }} />
      <Button
        title="Turn on reminders"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await registerForPush(true);
          await done();
        }}
      />
      <Button title="Not now" variant="secondary" onPress={done} />
      <Text variant="caption" style={{ textAlign: 'center' }}>You can change this anytime in Settings.</Text>
    </View>
  );
}
