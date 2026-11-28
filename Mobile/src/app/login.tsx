import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthButton, AuthShell, AuthSwitch, Banner } from '@/components/auth-shell';
import { WebInput } from '@/components/course-form';
import { C } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsReset, setNeedsReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setNeedsReset(false);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      if (e instanceof ApiError && e.message === 'PASSWORD_NOT_SET') setNeedsReset(true);
      else setError(e instanceof Error ? e.message : 'Could not log in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see what’s due."
      footer={<AuthSwitch prompt="New to classmate?" action="Create an account" onPress={() => router.replace('/signup')} />}>
      <WebInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" returnKeyType="next" />
      <WebInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="Your password" onSubmitEditing={submit} returnKeyType="go" />
      <View style={{ alignItems: 'flex-end', marginTop: -6 }}>
        <Link href="/forgot-password" style={{ color: C.brandSolid, fontFamily: 'Inter_500Medium', fontSize: 14, paddingVertical: 4 }}>Forgot password?</Link>
      </View>
      {needsReset ? <Banner tone="warn">Your account needs a new password. Tap “Forgot password?” to set one.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <AuthButton title={busy ? 'Logging in…' : 'Log in'} onPress={submit} loading={busy} disabled={!email || !password} />
    </AuthShell>
  );
}
