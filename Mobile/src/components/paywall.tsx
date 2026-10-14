import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { BellRing, CalendarClock, CalendarDays, Check, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { WEB_URL } from '@/lib/config';
import { purchasesConfigured, purchasesEnabled, restorePurchases } from '@/lib/purchases';
import type { Subscription } from '@/lib/types';

/**
 * Pro = "never caught off guard" (decided 2026-10-13). Free keeps LMS sync, the calendar and a reminder
 * the day before each deadline. Pro adds change alerts, 3-day and exam-week heads-ups, the Sunday plan
 * and unlimited study tools. Mirrors _build_user_reminders in Backend/main.py and FREE_AI_GENERATION_LIMIT;
 * keep this copy in sync: Apple rejects paywalls that oversell.
 */
const BENEFITS: { icon: LucideIcon; title: string; body: string; color: string; bg: string }[] = [
  { icon: BellRing, title: 'Know the moment a date moves', body: 'When a professor changes a due date or posts something new, you hear about it that night.', color: '#5B8DEF', bg: '#E0EAFF' },
  { icon: CalendarClock, title: 'Heads-up before it’s urgent', body: '3 days before every assignment and a week before every exam, not just the night before.', color: '#A78BFA', bg: '#F3E8FF' },
  { icon: CalendarDays, title: 'Your Sunday game plan', body: 'Every Sunday night: the week ahead, your busiest day and any exams.', color: '#38BDF8', bg: '#E0F2FE' },
];

// The limits answer "what exactly do I get" in the small print; the tiles sell the outcome.
const FREE_LINE = 'Also in Pro: unlimited flashcards, quizzes & summaries. Free always includes LMS sync, your calendar and a reminder the night before.';

// Shown only when the store can't return products (Expo Go / before App Store Connect is set up).
const FALLBACK = { semester: '$19.99', monthly: '$4.99', trialDays: 14 };

export type PaywallReason = 'onboarding' | 'limit' | 'upgrade' | 'home_banner';

type PaywallCtx = { openPaywall: (reason: PaywallReason, message?: string) => Promise<boolean> };
const Ctx = createContext<PaywallCtx>({ openPaywall: async () => false });
export const usePaywall = () => useContext(Ctx);

const HEADLINES: Record<PaywallReason, string> = {
  onboarding: 'Never get caught off guard',
  limit: 'Keep the momentum going',
  upgrade: 'ClassMate Pro',
  home_banner: 'ClassMate Pro',
};

function trialLabel(pkg: PurchasesPackage | undefined, eligible: boolean) {
  const intro = pkg?.product.introPrice;
  if (!eligible || !intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits * intro.cycles;
  const unit = intro.periodUnit.toLowerCase();
  if (unit === 'week') return n === 1 ? '1-week' : `${n}-week`;
  if (unit === 'day') return n % 7 === 0 ? `${n / 7}-week` : `${n}-day`;
  if (unit === 'month') return n === 1 ? '1-month' : `${n}-month`;
  return null;
}

function PlanCard({ selected, onPress, title, price, sub, badge }: { selected: boolean; onPress: () => void; title: string; price: string; sub: string; badge?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        { borderRadius: 20, borderWidth: 2, borderColor: selected ? C.brand : C.slate200, backgroundColor: selected ? '#F2F6FF' : C.white, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ scale: pressed ? 0.98 : 1 }] },
        selected ? shadowSm : null,
      ]}>
      {badge ? (
        <View style={{ position: 'absolute', top: -11, right: 16, backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <T size={11} weight="bold" color="#fff" style={{ letterSpacing: 0.5 }}>{badge.toUpperCase()}</T>
        </View>
      ) : null}
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: selected ? 0 : 2, borderColor: C.slate300, backgroundColor: selected ? C.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T size={17} weight="semibold" color={C.slate900}>{title}</T>
        <T size={13} color={C.slate500}>{sub}</T>
      </View>
      <T size={17} weight="bold" color={C.slate900}>{price}</T>
    </Pressable>
  );
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { refreshMe } = useAuth();
  const [state, setState] = useState<{ reason: PaywallReason; message?: string } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [packages, setPackages] = useState<{ semester?: PurchasesPackage; monthly?: PurchasesPackage }>({});
  const [eligible, setEligible] = useState(true);
  const [plan, setPlan] = useState<'semester' | 'monthly'>('semester');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  // Load products once the paywall opens (cheap after the first call; RevenueCat caches offerings).
  useEffect(() => {
    if (!state || !purchasesConfigured()) return;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        // Semester Pass = a 6-month auto-renewing subscription in App Store Connect
        const semester = pkgs.find((p) => p.packageType === PACKAGE_TYPE.SIX_MONTH);
        const monthly = pkgs.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
        setPackages({ semester, monthly });
        if (semester) {
          const res = await Purchases.checkTrialOrIntroductoryPriceEligibility([semester.product.identifier]);
          setEligible(res[semester.product.identifier]?.status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE);
        }
      } catch {}
    })();
  }, [state]);

  const close = useCallback((purchased: boolean) => {
    if (!purchased && state) track('paywall_dismissed', { reason: state.reason });
    setState(null);
    resolver.current?.(purchased);
    resolver.current = null;
  }, [state]);

  const openPaywall = useCallback((reason: PaywallReason, message?: string) => {
    // Only open where purchasing can work (or in dev, to preview the design).
    if (!purchasesEnabled && !__DEV__) return Promise.resolve(false);
    track('paywall_viewed', { reason });
    setPlan('semester');
    setState({ reason, message });
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  /** The backend learns about purchases from the RevenueCat webhook, a moment after StoreKit confirms. */
  const waitForPro = async () => {
    for (let i = 0; i < 10; i++) {
      try {
        const s = await api<Subscription>('/me/subscription');
        if (s.is_pro) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const buy = async () => {
    const pkg = plan === 'semester' ? packages.semester : packages.monthly;
    track('paywall_cta_clicked', { reason: state?.reason ?? null, plan });
    if (!pkg) {
      Alert.alert('Not available yet', 'Purchases will work once the App Store listing is live.');
      return;
    }
    setBusy('buy');
    try {
      await Purchases.purchasePackage(pkg);
      track('subscription_purchased', { plan, trial: !!trialLabel(packages.semester, eligible) && plan === 'semester' });
      await waitForPro();
      await refreshMe();
      close(true);
    } catch (e) {
      if (!(e as { userCancelled?: boolean })?.userCancelled) Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const found = await restorePurchases();
      if (found) {
        track('purchase_restored');
        await waitForPro();
        await refreshMe();
        close(true);
      } else Alert.alert('Nothing to restore', 'No ClassMate subscription was found for this Apple ID.');
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const semesterPrice = packages.semester?.product.priceString ?? FALLBACK.semester;
  const monthlyPrice = packages.monthly?.product.priceString ?? FALLBACK.monthly;
  const semesterPerMonth = packages.semester?.product.pricePerMonthString ?? '$3.33';
  const savings = packages.semester && packages.monthly
    ? Math.round((1 - packages.semester.product.price / (packages.monthly.product.price * 6)) * 100)
    : 33;
  const trial = packages.semester ? trialLabel(packages.semester, eligible) : eligible ? `${FALLBACK.trialDays / 7}-week` : null;
  const showTrial = plan === 'semester' && !!trial;
  const planPrice = plan === 'semester' ? `${semesterPrice} every 6 months` : `${monthlyPrice}/month`;
  const cta = showTrial ? `Start ${trial} free trial` : `Subscribe for ${plan === 'semester' ? `${semesterPrice}` : `${monthlyPrice}/month`}`;
  const fineprint = showTrial
    ? `Free for ${trial!.replace('-', ' ')}${trial!.endsWith('week') ? 's' : ''}, then ${semesterPrice} every 6 months. Cancel anytime in Settings before the trial ends and you won’t be charged.`
    : `${planPrice}, renews automatically. Cancel anytime in Settings.`;

  return (
    <Ctx.Provider value={{ openPaywall }}>
      {children}
      <Modal visible={!!state} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => close(false)}>
        <View style={{ flex: 1, backgroundColor: C.pageBg }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} bounces={false}>
            <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 36, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable onPress={() => close(false)} hitSlop={12} accessibilityLabel="Close" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color="#fff" />
                </Pressable>
              </View>
              <Animated.View entering={FadeInDown.duration(380)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Sparkles size={14} color="#fff" />
                  <T size={12} weight="bold" color="#fff" style={{ letterSpacing: 1.2 }}>CLASSMATE PRO</T>
                </View>
                <T size={32} weight="bold" color="#fff" style={{ marginTop: 14, lineHeight: 38, letterSpacing: -0.6 }}>{state ? HEADLINES[state.reason] : ''}</T>
                {state?.message ? <T size={16} color="rgba(255,255,255,0.9)" style={{ marginTop: 8, lineHeight: 22 }}>{state.message}</T> : null}
              </Animated.View>
            </LinearGradient>

            <View style={{ paddingHorizontal: 20, marginTop: -20, gap: 10 }}>
              {BENEFITS.map((b, i) => (
                <Animated.View key={b.title} entering={FadeInDown.delay(100 + i * 70).duration(360)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 18, padding: 14 }, shadowSm]}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: b.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <b.icon size={22} color={b.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T size={15} weight="semibold" color={C.slate900}>{b.title}</T>
                    <T size={13} color={C.slate500}>{b.body}</T>
                  </View>
                </Animated.View>
              ))}
            </View>

            <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 26 }}>
              <PlanCard selected={plan === 'semester'} onPress={() => setPlan('semester')} title="Semester Pass" price={`${semesterPrice}/6 mo`} sub={`Just ${semesterPerMonth}/mo${trial ? ` · ${trial} free trial` : ''}`} badge={savings > 0 ? `Save ${savings}%` : undefined} />
              <PlanCard selected={plan === 'monthly'} onPress={() => setPlan('monthly')} title="Monthly" price={`${monthlyPrice}/mo`} sub="Cancel anytime" />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 8, backgroundColor: C.pageBg }}>
            <Pressable onPress={buy} disabled={!!busy} style={({ pressed }) => [{ borderRadius: 999, transform: [{ scale: pressed ? 0.98 : 1 }] }, shadowSm]}>
              <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 999, paddingVertical: 17, alignItems: 'center' }}>
                {busy === 'buy' ? <ActivityIndicator color="#fff" /> : <T size={17} weight="semibold" color="#fff">{cta}</T>}
              </LinearGradient>
            </Pressable>
            <T size={12} color={C.slate500} style={{ textAlign: 'center', marginTop: 8, lineHeight: 17 }}>{fineprint}</T>
            <Pressable onPress={() => close(false)} hitSlop={6} style={{ marginTop: 12, paddingVertical: 4 }}>
              <T size={15} weight="semibold" color={C.slate600} style={{ textAlign: 'center' }}>Maybe later</T>
              <T size={12} color={C.slate400} style={{ textAlign: 'center', marginTop: 2 }}>{FREE_LINE}</T>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 }}>
              <Pressable onPress={restore} disabled={!!busy}><T size={12} color={C.slate400}>{busy === 'restore' ? 'Restoring…' : 'Restore'}</T></Pressable>
              <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms`)}><T size={12} color={C.slate400}>Terms</T></Pressable>
              <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}><T size={12} color={C.slate400}>Privacy</T></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}
