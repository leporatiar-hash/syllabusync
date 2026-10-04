import { Link } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';

import { AuthButton, AuthShell, Banner } from '@/components/auth-shell';
import { WebInput } from '@/components/course-form';
import { T } from '@/components/web';
import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Same options as the web signup form, so referral_source analytics line up.
const SOURCES = ['ChatGPT', 'Google', 'A friend', 'Professor / class', 'TikTok / social', 'Other'];

export default function Signup() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      await signUp(email, password, source || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  const linkStyle = { color: C.brand, fontFamily: 'Inter_400Regular', fontSize: 12 } as const;

  return (
    <AuthShell title="Create account" subtitle="Join thousands of students organizing their studies">
      <WebInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" />
      <WebInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 6 characters" />
      <View style={{ gap: 6 }}>
        <T size={14} weight="medium" color={C.slate700}>How did you hear about ClassMate? <T size={14} color={C.slate400}>(optional)</T></T>
        <Pressable
          onPress={() => ActionSheetIOS.showActionSheetWithOptions({ options: [...SOURCES, 'Cancel'], cancelButtonIndex: SOURCES.length }, (i) => i < SOURCES.length && setSource(SOURCES[i]))}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
          <T size={15} color={source ? C.slate900 : C.slate400}>{source || 'Select...'}</T>
          <ChevronDown size={16} color={C.slate500} />
        </Pressable>
      </View>
      <AuthButton title={busy ? 'Creating account...' : 'Create account'} onPress={submit} loading={busy} disabled={!email || !password} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <T size={14} color={C.slate500}>Already have an account?</T>
        <Link href="/login" style={{ color: C.brand, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Log in</Link>
      </View>
      <T size={12} color={C.slate400} style={{ textAlign: 'center' }}>
        By continuing you agree to the <Link href="https://www.tryclassmate.com/terms" style={linkStyle}>Terms</Link> and <Link href="https://www.tryclassmate.com/privacy" style={linkStyle}>Privacy Policy</Link>.
      </T>
    </AuthShell>
  );
}
