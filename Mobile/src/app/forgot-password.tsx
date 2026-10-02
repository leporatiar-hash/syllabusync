import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { publicPost } from '@/lib/api';

export default function ForgotPassword() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await publicPost('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Spacing.five, gap: Spacing.four }}>
      {sent ? (
        <Text variant="secondary">If an account exists for {email.trim()}, we’ve emailed a link to reset your password. Open it, set a new password, then sign in here.</Text>
      ) : (
        <>
          <Text variant="secondary">Enter your email and we’ll send you a reset link.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" autoComplete="email" autoFocus />
          {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
          <Button title="Send reset link" onPress={submit} loading={busy} disabled={!email} />
        </>
      )}
    </ScrollView>
  );
}
