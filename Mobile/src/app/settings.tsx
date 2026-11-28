import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BellOff, ChevronRight, Star } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/app-chrome';
import { BackBar } from '@/components/back-bar';
import { Avatar, T } from '@/components/web';
import { C, F } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APP_VERSION, WEB_URL } from '@/lib/config';
import { notificationPermission, registerForPush, type NotificationSettings } from '@/lib/notifications';
import { usePaywall } from '@/components/paywall';
import { openManageSubscriptions, purchasesEnabled, restorePurchases } from '@/lib/purchases';
import type { Subscription } from '@/lib/types';

// Same options as Frontend/app/settings/page.tsx.
const SCHOOL_TYPES = ['High School', 'Community College', 'University', 'Graduate School'];
const ACADEMIC_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD'];
const NAMING = [
  { value: 'simple', label: 'Simple', hint: 'Short labels, e.g. "Quiz 1", "HW 1 Due"' },
  { value: 'descriptive', label: 'Descriptive', hint: 'Full topic/reading/page detail from the syllabus' },
];

const SUPPORT_EMAIL = 'hello@tryclassmate.com';

function Group({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <View>
      <View style={{ backgroundColor: C.white, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}>{children}</View>
      {footer ? <T size={12} color={C.slate500} style={{ marginTop: 6, paddingHorizontal: 16, lineHeight: 17 }}>{footer}</T> : null}
    </View>
  );
}

/** One settings row: label on the left, value / control on the right, hairline above all but the first. */
function Row({ label, detail, value, right, onPress, first, danger, center }: {
  label: string; detail?: string; value?: string; right?: ReactNode; onPress?: () => void; first?: boolean; danger?: boolean; center?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed && onPress ? C.slate50 : C.white })}>
      {!first ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        <T size={16} color={danger ? '#DC2626' : C.slate900}>{label}</T>
        {detail ? <T size={13} color={C.slate500} style={{ marginTop: 1, lineHeight: 17 }}>{detail}</T> : null}
      </View>
      {value !== undefined ? <T size={16} color={C.slate400} numberOfLines={1} style={{ maxWidth: '55%' }}>{value || 'Not set'}</T> : null}
      {right}
      {onPress && !right && !center ? <ChevronRight size={17} color={C.slate300} /> : null}
    </Pressable>
  );
}

/** A row whose value is edited in place; saves when editing ends. */
function TextRow({ label, value, placeholder, onSave, first }: { label: string; value: string; placeholder: string; onSave: (v: string) => void; first?: boolean }) {
  const [text, setText] = useState(value);
  // Save an unfinished edit if the user leaves the screen without pressing Done.
  const latest = useRef({ text, value, onSave });
  useEffect(() => { latest.current = { text, value, onSave }; });
  useEffect(() => () => {
    const { text: t, value: v, onSave: save } = latest.current;
    if (t.trim() !== v) save(t.trim());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16 }}>
      {!first ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
      <T size={16} color={C.slate900} style={{ width: 92 }}>{label}</T>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => { if (text.trim() !== value) onSave(text.trim()); }}
        maxLength={80}
        placeholder={placeholder}
        placeholderTextColor={C.slate300}
        returnKeyType="done"
        style={{ flex: 1, textAlign: 'right', fontFamily: F.regular, fontSize: 16, color: C.slate600, paddingVertical: 12 }}
      />
    </View>
  );
}

function pick(title: string, options: string[], onChange: (v: string) => void) {
  ActionSheetIOS.showActionSheetWithOptions({ options: [...options, 'Cancel'], cancelButtonIndex: options.length, title }, (i) => i < options.length && onChange(options[i]));
}

/** The web's "Profile & Settings" page, plus the phone-only pieces: App Store plan, reminders, legal. */
export default function Settings() {
  const { me, signOut, refreshMe } = useAuth();
  const { openPaywall } = usePaywall();
  const sub = useApi<Subscription>('/me/subscription');
  const prefs = useApi<NotificationSettings>('/me/notification-settings');
  const [permission, setPermission] = useState('undetermined');
  const [form, setForm] = useState(() => {
    const p = me?.profile;
    return { full_name: p?.full_name ?? '', school_name: p?.school_name ?? '', school_type: p?.school_type ?? '', academic_year: p?.academic_year ?? '', major: p?.major ?? '', naming_style: p?.naming_style || 'simple' };
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'upgrade' | 'restore' | 'delete' | null>(null);

  useFocusEffect(useCallback(() => { notificationPermission().then(setPermission); }, []));

  const lms = useApi<{ id: string; provider: string; status?: 'ok' | 'broken' }[]>('/lms/connections');
  const saveField = async (change: Partial<typeof form>) => {
    const next = { ...form, ...change };
    setForm(next);
    setSaving(true);
    try {
      await api('/me/profile', { method: 'POST', body: JSON.stringify({ ...next, email: me?.profile?.email }) });
      await refreshMe();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key: keyof NotificationSettings, value: boolean) => {
    if (!prefs.data) return;
    const before = prefs.data;
    const next = { ...before, [key]: value };
    prefs.setData(next);
    try {
      await api('/me/notification-settings', { method: 'PUT', body: JSON.stringify(next) });
    } catch {
      prefs.setData(before);
    }
  };

  const waitForPro = async () => {
    for (let i = 0; i < 8; i++) {
      const s = await api<Subscription>('/me/subscription');
      sub.setData(s);
      if (s.is_pro) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const upgrade = async () => {
    setBusy('upgrade');
    try {
      if (await openPaywall('upgrade')) sub.setData(await api<Subscription>('/me/subscription'));
    } catch (e) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const found = await restorePurchases();
      if (found) await waitForPro();
      Alert.alert(found ? 'Purchases restored' : 'Nothing to restore', found ? 'classmate Pro is active.' : 'No App Store subscription was found for this Apple ID.');
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    const iap = sub.data?.billing_source === 'app_store' ? '\n\nYour App Store subscription is billed by Apple. Cancel it in Settings → Apple ID → Subscriptions so you aren’t charged again.' : '';
    Alert.alert('Delete account?', `This permanently deletes your account, courses, deadlines, notes, and study sets. This can’t be undone.${iap}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await api('/auth/delete-account', { method: 'DELETE' });
            await signOut();
          } catch (e) {
            Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Please try again.');
            setBusy(null);
          }
        },
      },
    ]);
  };

  const s = sub.data;
  const isPro = s?.is_pro ?? me?.subscription.is_pro;
  const planDetail = !s ? '' : s.billing_source === 'app_store' && s.is_trial && s.iap_expires_at
    ? `Free trial · ends ${new Date(s.iap_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, then billed through the App Store`
    : s.billing_source === 'app_store'
    ? `Billed through the App Store${s.iap_expires_at ? ` · renews ${new Date(s.iap_expires_at).toLocaleDateString()}` : ''}`
    : s.billing_source === 'stripe' ? 'Billed on tryclassmate.com'
    : s.billing_source === 'founding' ? 'Founding member'
    : `${s.chat_messages_used}/${s.chat_messages_max ?? '∞'} chat messages this week · ${s.ai_generations_used}/${s.ai_generations_max ?? '∞'} AI generations this month`;

  const hasLms = (lms.data?.length ?? 0) > 0;
  const lmsBroken = (lms.data ?? []).some((c) => c.status === 'broken');
  const namingHint = NAMING.find((n) => n.value === form.naming_style)?.hint;

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg }}>
      <BackBar label="Back" right={saving ? <ActivityIndicator color={C.slate400} style={{ marginRight: 8 }} /> : undefined} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 64, gap: 26 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <T size={34} weight="bold" color={C.slate900} style={{ letterSpacing: -0.8, lineHeight: 41, paddingHorizontal: 4 }}>Settings</T>

          <Group>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <Avatar name={form.full_name || me?.profile?.email} size={56} />
              <View style={{ flex: 1 }}>
                <T size={19} weight="semibold" color={C.slate900}>{form.full_name || 'Add your name'}</T>
                <T size={14} color={C.slate500} numberOfLines={1}>{me?.profile?.email}</T>
              </View>
            </View>
          </Group>

          <View>
            <SectionHeader>Profile</SectionHeader>
            <Group>
              <TextRow first label="Name" value={form.full_name} placeholder="Your name" onSave={(v) => saveField({ full_name: v })} />
              <TextRow label="School" value={form.school_name} placeholder="Your school" onSave={(v) => saveField({ school_name: v })} />
              <Row label="Year" value={form.academic_year} onPress={() => pick('Academic year', ACADEMIC_YEARS, (v) => saveField({ academic_year: v }))} />
              <Row label="School type" value={form.school_type} onPress={() => pick('School type', SCHOOL_TYPES, (v) => saveField({ school_type: v }))} />
              <TextRow label="Major" value={form.major} placeholder="e.g. Finance" onSave={(v) => saveField({ major: v })} />
            </Group>
          </View>

          <View>
            <SectionHeader>Your LMS</SectionHeader>
            <Group footer={hasLms ? 'Due dates sync from your LMS every few hours.' : 'Connect once and every due date shows up here, kept up to date.'}>
              <Row
                first
                label={!hasLms ? 'Not connected' : lmsBroken ? 'Stopped syncing' : 'Connected'}
                detail={lmsBroken ? 'New and changed due dates aren’t coming through' : undefined}
                right={<T size={16} weight="medium" color={C.brandSolid}>{!hasLms ? 'Connect' : lmsBroken ? 'Reconnect' : 'Change'}</T>}
                onPress={() => router.push('/onboarding/lms?from=app')}
              />
            </Group>
          </View>

          <View>
            <SectionHeader>Reminders</SectionHeader>
            <Group>
              {permission !== 'granted' ? (
                <Pressable onPress={async () => { if (permission === 'denied') return Linking.openSettings(); await registerForPush(true); setPermission(await notificationPermission()); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <BellOff size={18} color={C.red} />
                  <View style={{ flex: 1 }}>
                    <T size={16} color={C.slate900}>Notifications are off</T>
                    <T size={13} color={C.slate500}>{permission === 'denied' ? 'Tap to turn them on in iOS Settings' : 'Tap to turn them on'}</T>
                  </View>
                  <ChevronRight size={17} color={C.slate300} />
                </Pressable>
              ) : null}
              {([['deadlines', 'Deadlines', '3 days and 1 day before each one'], ['exams', 'Exams', 'A week before every exam'], ['weekly', 'Weekly brief', 'Sunday evening'], ['class_notes', 'Class notes', 'A nudge to take notes when class starts']] as const).map(([key, label, detail], i) => (
                <Row key={key} first={i === 0 && permission === 'granted'} label={label} detail={detail}
                  right={<Switch value={prefs.data?.[key] ?? true} disabled={!prefs.data} onValueChange={(v) => togglePref(key, v)} trackColor={{ true: C.brandSolid }} />} />
              ))}
            </Group>
          </View>

          <View>
            <SectionHeader>Plan</SectionHeader>
            <Group footer={planDetail || undefined}>
              <Row first label={isPro ? (s?.is_trial ? 'classmate Pro (trial)' : 'classmate Pro') : 'Free plan'} right={<Star size={18} color={isPro ? '#F59E0B' : C.slate300} fill={isPro ? '#F59E0B' : 'transparent'} />} />
              {!isPro && (purchasesEnabled || __DEV__) ? (
                <Row label={busy === 'upgrade' ? 'Opening…' : 'Upgrade to Pro'} detail="Alerts when a date moves, earlier exam reminders" onPress={upgrade} />
              ) : null}
              {isPro && s?.billing_source === 'app_store' ? <Row label="Manage subscription" onPress={openManageSubscriptions} /> : null}
              {purchasesEnabled && s?.billing_source !== 'stripe' ? <Row label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'} onPress={busy ? undefined : restore} /> : null}
            </Group>
          </View>

          <View>
            <SectionHeader>Deadline names from syllabi</SectionHeader>
            <Group footer={namingHint}>
              {NAMING.map((n, i) => (
                <Row key={n.value} first={i === 0} label={n.label} onPress={() => saveField({ naming_style: n.value })}
                  right={form.naming_style === n.value ? <T size={17} weight="semibold" color={C.brandSolid}>✓</T> : <View style={{ width: 12 }} />} />
              ))}
            </Group>
          </View>

          <View>
            <SectionHeader>About</SectionHeader>
            <Group>
              <Row first label="How classmate works" onPress={() => router.push('/how-it-works')} />
              <Row label="Contact support" detail={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
              <Row label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
              <Row label="Terms of Service" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)} />
              <Row label="Version" value={APP_VERSION} />
            </Group>
          </View>

          <Group>
            <Row first center label="Log out" onPress={signOut} />
          </Group>

          <Group footer="Permanently deletes your account, courses, deadlines, notes and study sets. This can’t be undone.">
            <Row first center danger label={busy === 'delete' ? 'Deleting…' : 'Delete account'} onPress={busy === 'delete' ? undefined : confirmDelete} />
          </Group>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
