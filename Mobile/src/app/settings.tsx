import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BellOff, ChevronDown, ChevronRight, Star } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Linking, Pressable, ScrollView, Switch, View } from 'react-native';

import { AppHeader } from '@/components/app-chrome';
import { BackBar } from '@/components/back-bar';
import { WebInput } from '@/components/course-form';
import { Avatar, Card, GradientButton, OutlineButton, PageBackground, T } from '@/components/web';
import { C } from '@/constants/theme';
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

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T size={14} weight="medium" color={C.slate700}>{label}</T>
      <Pressable
        onPress={() => ActionSheetIOS.showActionSheetWithOptions({ options: [...options, 'Cancel'], cancelButtonIndex: options.length, title: label }, (i) => i < options.length && onChange(options[i]))}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.white }}>
        <T size={15} color={value ? C.slate900 : C.slate400}>{value || 'Select...'}</T>
        <ChevronDown size={16} color={C.slate500} />
      </Pressable>
    </View>
  );
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
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'upgrade' | 'restore' | 'delete' | null>(null);

  useFocusEffect(useCallback(() => { notificationPermission().then(setPermission); }, []));

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/me/profile', { method: 'POST', body: JSON.stringify({ ...form, email: me?.profile?.email }) });
      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      Alert.alert(found ? 'Purchases restored' : 'Nothing to restore', found ? 'ClassMate Pro is active.' : 'No App Store subscription was found for this Apple ID.');
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

  return (
    <PageBackground>
      <AppHeader />
      <BackBar label="Back" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 64, gap: 24 }} keyboardShouldPersistTaps="handled">
          <T size={30} weight="semibold" color={C.slate900} style={{ letterSpacing: -0.5, lineHeight: 36 }}>Profile & Settings</T>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <Avatar name={form.full_name || me?.profile?.email} size={96} />
            <View style={{ flex: 1 }}>
              <T size={18} weight="medium" color={C.slate900}>{form.full_name || 'ClassMate student'}</T>
              <T size={14} color={C.slate500} numberOfLines={1}>{me?.profile?.email}</T>
            </View>
          </View>

          <Card radius={24} padding={20} style={{ gap: 16 }}>
            <WebInput label="Full Name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
            <View style={{ gap: 6 }}>
              <WebInput label="Email" value={me?.profile?.email ?? ''} editable={false} style={{ backgroundColor: C.slate50, color: C.slate500 }} />
              <T size={12} color={C.slate400}>Email cannot be changed</T>
            </View>
            <WebInput label="School / University" value={form.school_name} onChangeText={(v) => setForm({ ...form, school_name: v })} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Select label="School Type" value={form.school_type} options={SCHOOL_TYPES} onChange={(v) => setForm({ ...form, school_type: v })} />
              <Select label="Academic Year" value={form.academic_year} options={ACADEMIC_YEARS} onChange={(v) => setForm({ ...form, academic_year: v })} />
            </View>
            <WebInput label="Major / Field of Study" placeholder="e.g. Computer Science" value={form.major} onChangeText={(v) => setForm({ ...form, major: v })} />
            <View style={{ gap: 8 }}>
              <T size={14} weight="medium" color={C.slate700}>Assignment Naming</T>
              {NAMING.map((n) => {
                const on = form.naming_style === n.value;
                return (
                  <Pressable key={n.value} onPress={() => setForm({ ...form, naming_style: n.value })} style={{ borderWidth: on ? 2 : 1, borderColor: on ? C.brand : C.slate200, backgroundColor: on ? 'rgba(91,141,239,0.05)' : C.white, borderRadius: 12, padding: 12 }}>
                    <T size={14} weight="medium" color={C.slate800}>{n.label}</T>
                    <T size={12} color={C.slate500} style={{ marginTop: 2 }}>{n.hint}</T>
                  </Pressable>
                );
              })}
            </View>
            <GradientButton title={saved ? 'Saved ✓' : 'Save Changes'} size="lg" loading={saving} onPress={saveProfile} />
          </Card>

          <Card radius={24} padding={20} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Star size={20} color={isPro ? '#F59E0B' : C.slate400} fill={isPro ? '#F59E0B' : 'transparent'} />
              <T size={16} weight="semibold" color={C.slate900}>{isPro ? (s?.is_trial ? 'ClassMate Pro (trial)' : 'ClassMate Pro') : 'Free plan'}</T>
            </View>
            {planDetail ? <T size={13} color={C.slate500}>{planDetail}</T> : null}
            {!isPro && (purchasesEnabled || __DEV__) ? <GradientButton title="Upgrade to Pro" loading={busy === 'upgrade'} onPress={upgrade} /> : null}
            {isPro && s?.billing_source === 'app_store' ? <OutlineButton title="Manage subscription" onPress={openManageSubscriptions} /> : null}
            {purchasesEnabled && s?.billing_source !== 'stripe' ? (
              <Pressable onPress={busy ? undefined : restore}><T size={14} weight="medium" color={C.brand}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</T></Pressable>
            ) : null}
          </Card>

          <Card radius={24} padding={20}>
            <T size={16} weight="semibold" color={C.slate900} style={{ marginBottom: 4 }}>Reminders</T>
            {permission !== 'granted' ? (
              <Pressable onPress={async () => { if (permission === 'denied') return Linking.openSettings(); await registerForPush(true); setPermission(await notificationPermission()); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                <BellOff size={18} color={C.red} />
                <View style={{ flex: 1 }}>
                  <T size={14} weight="medium" color={C.slate800}>Notifications are off</T>
                  <T size={12} color={C.slate500}>{permission === 'denied' ? 'Tap to turn them on in iOS Settings' : 'Tap to turn them on'}</T>
                </View>
              </Pressable>
            ) : null}
            {([['deadlines', 'Deadlines', '3 days and 1 day before each one'], ['exams', 'Exams', 'A week before every exam'], ['weekly', 'Weekly brief', 'Sunday evening']] as const).map(([key, label, detail]) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.slate100 }}>
                <View style={{ flex: 1 }}>
                  <T size={14} weight="medium" color={C.slate800}>{label}</T>
                  <T size={12} color={C.slate500}>{detail}</T>
                </View>
                <Switch value={prefs.data?.[key] ?? true} disabled={!prefs.data} onValueChange={(v) => togglePref(key, v)} trackColor={{ true: C.brand }} />
              </View>
            ))}
          </Card>

          <Card radius={24} padding={8}>
            {[
              ['Connect Canvas or iCal', '/settings'],
              ['Privacy Policy', '/privacy'],
              ['Terms of Service', '/terms'],
            ].map(([label, path], i) => (
              <Pressable key={path + label} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.slate100 }}>
                <T size={14} color={C.slate700} style={{ flex: 1 }}>{label}</T>
                <ChevronRight size={16} color={C.slate300} />
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.slate100 }}>
              <T size={14} color={C.slate700} style={{ flex: 1 }}>Version</T>
              <T size={14} color={C.slate400}>{APP_VERSION}</T>
            </View>
          </Card>

          <OutlineButton title="Log out" onPress={signOut} />

          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: C.white, padding: 20 }}>
            <T size={14} weight="semibold" color="#B91C1C">Delete Account</T>
            <T size={14} color={C.slate500} style={{ marginTop: 4, marginBottom: 16 }}>Permanently delete your account and all of your data. This cannot be undone.</T>
            <Pressable onPress={confirmDelete} disabled={busy === 'delete'} style={({ pressed }) => ({ alignSelf: 'flex-start', borderRadius: 8, backgroundColor: pressed ? '#B91C1C' : '#DC2626', paddingHorizontal: 16, paddingVertical: 10, opacity: busy === 'delete' ? 0.5 : 1 })}>
              <T size={14} weight="semibold" color="#fff">{busy === 'delete' ? 'Deleting…' : 'Delete my account'}</T>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PageBackground>
  );
}
