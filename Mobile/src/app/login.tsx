import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      if (e instanceof ApiError && e.message === 'PASSWORD_NOT_SET') {
        setError('Your account needs a new password. Tap “Forgot password?” to set one.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not sign in');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: Spacing.five, paddingTop: insets.top + Spacing.five, gap: Spacing.four }}>
        <View style={{ gap: Spacing.two, marginBottom: Spacing.four }}>
          <Text variant="title" style={{ fontSize: 34 }}>ClassMate</Text>
          <Text variant="secondary">Every deadline from every syllabus, in one place.</Text>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
        <Link href="/forgot-password" style={{ color: t.tint, textAlign: 'center', fontSize: 16, padding: Spacing.two }}>
          Forgot password?
        </Link>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text variant="secondary">New to ClassMate?</Text>
          <Link href="/signup" style={{ color: t.tint, fontSize: 15, fontWeight: '600' }}>Create an account</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
