import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';

import { Button, Field, Text } from '@/components/ui';
import { Spacing, Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

// Same options as the web signup form, so referral_source analytics line up.
const SOURCES = ['ChatGPT', 'Google', 'A friend', 'Professor / class', 'TikTok / social', 'Other'];

export default function Signup() {
  const t = useTheme();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      await signUp(email, password, source ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: Spacing.five, gap: Spacing.four }}>
        <Field label="School email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 6 characters" />
        <View style={{ gap: Spacing.two }}>
          <Text variant="caption">How did you hear about ClassMate? (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {SOURCES.map((s) => {
              const on = source === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSource(on ? null : s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? Brand : t.card, borderWidth: 1, borderColor: on ? Brand : t.border }}>
                  <Text variant="secondary" style={{ color: on ? '#fff' : t.text }}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        <Button title="Create account" onPress={submit} loading={busy} disabled={!email || !password} />
        <Text variant="caption" style={{ textAlign: 'center' }}>
          By continuing you agree to the{' '}
          <Link href="https://www.tryclassmate.com/terms" style={{ color: t.tint }}>Terms</Link> and{' '}
          <Link href="https://www.tryclassmate.com/privacy" style={{ color: t.tint }}>Privacy Policy</Link>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
