import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { Button, Card, Icon, Row, SectionHeader, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APP_VERSION, WEB_URL } from '@/lib/config';
import { openManageSubscriptions, presentPaywall, purchasesEnabled, restorePurchases } from '@/lib/purchases';
import type { Subscription } from '@/lib/types';

/** The webhook lands a moment after StoreKit confirms; poll briefly so the UI flips to Pro. */
async function waitForPro(reload: () => Promise<Subscription>) {
  for (let i = 0; i < 8; i++) {
    const s = await reload();
    if (s.is_pro) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export default function Settings() {
  const t = useTheme();
  const { me, signOut, refreshMe } = useAuth();
  const { data: sub, setData: setSub, refreshing, refresh } = useApi<Subscription>('/me/subscription');
  const [busy, setBusy] = useState<'upgrade' | 'restore' | 'delete' | null>(null);

  const reloadSub = async () => {
    const s = await api<Subscription>('/me/subscription');
    setSub(s);
    return s;
  };

  const upgrade = async () => {
    setBusy('upgrade');
    try {
      if (await presentPaywall()) {
        const ok = await waitForPro(reloadSub);
        await refreshMe();
        if (!ok) Alert.alert('Purchase received', 'Pro will unlock in a moment. Pull down to refresh if it doesn’t.');
      }
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
      if (found) await waitForPro(reloadSub);
      Alert.alert(found ? 'Purchases restored' : 'Nothing to restore', found ? 'ClassMate Pro is active.' : 'No App Store subscription was found for this Apple ID.');
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    const iapNote = sub?.billing_source === 'app_store'
      ? '\n\nYour App Store subscription is billed by Apple. Cancel it in Settings → Apple ID → Subscriptions so you aren’t charged again.'
      : '';
    Alert.alert(
      'Delete account?',
      `This permanently deletes your account, courses, deadlines, notes, and study sets. This can’t be undone.${iapNote}`,
      [
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
      ],
    );
  };

  const isPro = sub?.is_pro ?? me?.subscription.is_pro;
  const planDetail = !sub
    ? ''
    : sub.billing_source === 'app_store'
      ? `Billed through the App Store${sub.iap_expires_at ? ` · renews ${new Date(sub.iap_expires_at).toLocaleDateString()}` : ''}`
      : sub.billing_source === 'stripe'
        ? 'Billed on tryclassmate.com'
        : sub.billing_source === 'founding'
          ? 'Founding member'
          : `${sub.chat_messages_used}/${sub.chat_messages_max ?? '∞'} chat messages this week · ${sub.ai_generations_used}/${sub.ai_generations_max ?? '∞'} AI generations this month`;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <SectionHeader title="Account" />
      <Card>
        <Row last>
          <Icon name="person.crop.circle.fill" size={36} color={t.tint} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{me?.profile?.full_name || 'ClassMate student'}</Text>
            <Text variant="caption">{me?.profile?.email}</Text>
          </View>
        </Row>
      </Card>

      <SectionHeader title="Plan" />
      <Card style={{ padding: Spacing.four, gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Icon name={isPro ? 'star.circle.fill' : 'star.circle'} size={24} color={isPro ? '#F59E0B' : t.textSecondary} />
          <Text variant="headline">{isPro ? 'ClassMate Pro' : 'Free plan'}</Text>
        </View>
        {planDetail ? <Text variant="caption">{planDetail}</Text> : null}
        {!isPro && purchasesEnabled ? (
          <Button title="Upgrade to Pro" onPress={upgrade} loading={busy === 'upgrade'} />
        ) : null}
        {isPro && sub?.billing_source === 'app_store' ? (
          <Button title="Manage subscription" variant="secondary" onPress={openManageSubscriptions} />
        ) : null}
      </Card>
      {purchasesEnabled && sub?.billing_source !== 'stripe' ? (
        <Card style={{ marginTop: Spacing.two }}>
          <Row last onPress={busy ? undefined : restore}>
            <Text style={{ color: t.tint, flex: 1 }}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
          </Row>
        </Card>
      ) : null}

      <SectionHeader title="More on the web" />
      <Card>
        {[
          ['Add courses & upload syllabi', '/courses'],
          ['Connect Canvas or iCal', '/settings'],
          ['Flashcards, quizzes & notes', '/study-studio'],
        ].map(([label, path], i, arr) => (
          <Row key={path} last={i === arr.length - 1} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`)}>
            <Text style={{ flex: 1 }}>{label}</Text>
            <Icon name="arrow.up.right" size={14} />
          </Row>
        ))}
      </Card>

      <SectionHeader title="About" />
      <Card>
        <Row onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}><Text style={{ flex: 1 }}>Privacy Policy</Text><Icon name="chevron.right" size={14} /></Row>
        <Row onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}><Text style={{ flex: 1 }}>Terms of Service</Text><Icon name="chevron.right" size={14} /></Row>
        <Row last><Text style={{ flex: 1 }}>Version</Text><Text variant="secondary">{APP_VERSION}</Text></Row>
      </Card>

      <View style={{ gap: Spacing.three, marginTop: Spacing.five }}>
        <Button title="Sign out" variant="secondary" onPress={signOut} />
        <Button title="Delete account" variant="destructive" onPress={confirmDelete} loading={busy === 'delete'} />
      </View>
    </ScrollView>
  );
}
