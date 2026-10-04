import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { PRO_ENTITLEMENT, REVENUECAT_IOS_KEY } from './config';

let configured = false;

/** True once a RevenueCat key is set for this build. Without one, upgrade UI is hidden. */
export const purchasesEnabled = Platform.OS === 'ios' && !!REVENUECAT_IOS_KEY;

/**
 * Configure RevenueCat with our user id as the app_user_id. The backend webhook
 * (/revenuecat/webhook) looks users up by this id, so it must be set before any purchase.
 */
export async function identifyPurchaser(userId: string) {
  if (!purchasesEnabled) return;
  try {
    if (!configured) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn('[purchases] identify failed', e);
  }
}

export async function resetPurchaser() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if the current user is already anonymous; nothing to do.
  }
}

/**
 * Shows the RevenueCat paywall (designed in the RevenueCat dashboard), always with a close button
 * so it can be skipped. No-op for users who already have Pro. Returns true on purchase/restore.
 */
export async function presentPaywall(): Promise<boolean> {
  if (!configured) return false;
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    displayCloseButton: true,
  });
  return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

export async function hasStorePro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch {
    return false;
  }
}

export async function openManageSubscriptions() {
  if (!configured) return;
  await Purchases.showManageSubscriptions();
}
