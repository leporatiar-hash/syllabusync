import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef } from 'react';

import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useLmsForegroundSync } from '@/lib/lms-sync';
import { notificationPermission, REMINDERS_ASKED_KEY } from '@/lib/notifications';

const SCREEN_ROUTES = { home: '/', calendar: '/calendar', courses: '/courses', chat: '/chat', notebook: '/notebook', settings: '/settings', connect: '/onboarding/lms?from=app' } as const;

/** Accounts that haven't finished onboarding (new app signups; the web marks its signups done)
 *  go through it on first open. Everyone else gets asked about reminders once. */
function useFirstRunPrompts() {
  const { me, clearJustSignedUp } = useAuth();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !me) return;
    ran.current = true;
    (async () => {
      clearJustSignedUp();
      if (!me.has_completed_onboarding) {
        router.replace({ pathname: '/how-it-works', params: { next: 'onboarding' } });
        return;
      }
      const asked = await SecureStore.getItemAsync(REMINDERS_ASKED_KEY);
      if (!asked && (await notificationPermission()) === 'undetermined') router.push('/reminders');
    })();
  }, [me, clearJustSignedUp]);
}

/** Tapping a reminder opens the tab it's about (data.screen set by the backend). */
function useNotificationTaps() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = response.notification.request.content.data ?? {};
    const screen = data.screen as keyof typeof SCREEN_ROUTES | undefined;
    // "PSYC 103 is starting": open a fresh note for that class
    if (screen === 'notebook' && typeof data.course_id === 'string') router.navigate({ pathname: '/notebook', params: { start: data.course_id } });
    else if (screen && SCREEN_ROUTES[screen]) router.navigate(SCREEN_ROUTES[screen]);
  }, [response]);
}

/** The system iOS tab bar (floating glass on iOS 26). Re-tapping a tab pops it to its root natively. */
export default function TabsLayout() {
  const { me } = useAuth();
  useFirstRunPrompts();
  useNotificationTaps();
  useLmsForegroundSync(!!me);
  return (
    <NativeTabs tintColor={C.brandSolid} minimizeBehavior="automatic">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="school" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notebook">
        <NativeTabs.Trigger.Label>Notebook</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'note.text', selected: 'note.text' }} md="edit_note" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" hidden />
    </NativeTabs>
  );
}
