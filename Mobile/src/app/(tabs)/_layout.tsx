import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef } from 'react';

import { AppHeader, WebTabBar } from '@/components/app-chrome';
import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { notificationPermission, REMINDERS_ASKED_KEY } from '@/lib/notifications';

const SCREEN_ROUTES = { home: '/', calendar: '/calendar', courses: '/courses', chat: '/chat', settings: '/settings' } as const;

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
        router.replace('/onboarding/name');
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
    const screen = response.notification.request.content.data?.screen as keyof typeof SCREEN_ROUTES | undefined;
    if (screen && SCREEN_ROUTES[screen]) router.navigate(SCREEN_ROUTES[screen]);
  }, [response]);
}

export default function TabsLayout() {
  useFirstRunPrompts();
  useNotificationTaps();
  return (
    <Tabs
      tabBar={(props) => <WebTabBar {...props} />}
      screenOptions={{ header: () => <AppHeader />, sceneStyle: { backgroundColor: C.pageBg } }}>
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="chat" />
    </Tabs>
  );
}
