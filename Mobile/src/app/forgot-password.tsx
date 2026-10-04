import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthButton, AuthShell, Banner } from '@/components/auth-shell';
import { WebInput } from '@/components/course-form';
import { T } from '@/components/web';
import { C } from '@/constants/theme';
import { publicPost } from '@/lib/api';

export default function ForgotPassword() {
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

  const back = <Link href="/login" style={{ color: C.brand, fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center' }}>Back to log in</Link>;

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If an account exists for ${email.trim()}, we’ve sent a link to reset your password.`}>
        <T size={14} color={C.slate600}>Open the link, set a new password, then log in here.</T>
        {back}
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we’ll send you a reset link.">
      <WebInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" autoComplete="email" placeholder="you@school.edu" />
      <AuthButton title={busy ? 'Sending...' : 'Send reset link'} onPress={submit} loading={busy} disabled={!email} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {back}
    </AuthShell>
  );
}
