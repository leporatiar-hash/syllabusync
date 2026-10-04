import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef } from 'react';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { notificationPermission, REMINDERS_ASKED_KEY } from '@/lib/notifications';
import { presentPaywall, purchasesEnabled } from '@/lib/purchases';

const SCREEN_ROUTES = { home: '/', calendar: '/calendar', courses: '/courses', chat: '/chat', settings: '/settings' } as const;

/** First run after sign-in: post-signup paywall (skippable), then the reminders explainer once. */
function useFirstRunPrompts() {
  const { justSignedUp, clearJustSignedUp, refreshMe } = useAuth();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (justSignedUp) {
        clearJustSignedUp();
        if (purchasesEnabled) {
          try {
            if (await presentPaywall()) await refreshMe();
          } catch {}
        }
      }
      const asked = await SecureStore.getItemAsync(REMINDERS_ASKED_KEY);
      if (!asked && (await notificationPermission()) === 'undetermined') router.push('/reminders');
    })();
  }, [justSignedUp, clearJustSignedUp, refreshMe]);
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
    <NativeTabs tintColor={Brand}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="school" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="chat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
