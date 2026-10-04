import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthButton, AuthShell, Banner } from '@/components/auth-shell';
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
    <AuthShell title="Welcome back" subtitle="Get back to studying">
      <WebInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" />
      <WebInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="Enter your password" onSubmitEditing={submit} returnKeyType="go" />
      <AuthButton title={busy ? 'Logging in...' : 'Log in'} onPress={submit} loading={busy} disabled={!email || !password} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Link href="/signup" style={{ color: C.brand, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Create an account</Link>
        <Link href="/forgot-password" style={{ color: C.slate500, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Forgot password?</Link>
      </View>
      {needsReset ? <Banner tone="warn">Your account needs a new password. Tap “Forgot password?” to set one.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </AuthShell>
  );
}
