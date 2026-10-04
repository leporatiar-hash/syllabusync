import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

// Show reminders even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Set once the reminders explainer has been answered, so it's only shown once per install. */
export const REMINDERS_ASKED_KEY = 'cm-reminders-asked';

let registeredToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function notificationPermission() {
  return (await Notifications.getPermissionsAsync()).status;
}

/**
 * Ask for permission (only prompts if the user hasn't decided yet), get this device's Expo push
 * token, and register it with the backend along with the device timezone so reminders arrive
 * in the evening local time. Safe to call on every launch; returns false if not possible.
 */
export async function registerForPush(prompt = true): Promise<boolean> {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' && prompt) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    const id = projectId();
    if (!id) {
      // No EAS project yet (set by `eas init`): push needs it, so skip quietly in dev.
      if (__DEV__) console.warn('[push] no EAS projectId; run `npx eas-cli init` to enable push');
      return false;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await api('/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    registeredToken = token;
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[push] registration failed', e);
    return false;
  }
}

/** Called on sign-out so the next person to use this phone doesn't get your reminders. */
export async function unregisterPush() {
  if (!registeredToken) return;
  try {
    await api('/me/push-token', { method: 'DELETE', body: JSON.stringify({ token: registeredToken }) });
  } catch {}
  registeredToken = null;
}

export type NotificationSettings = { deadlines: boolean; exams: boolean; weekly: boolean };
