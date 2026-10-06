import PostHog from 'posthog-react-native';

// Same PostHog project as the web app, identified by the same user id, so one funnel
// covers both platforms. Disabled when no key is set (local dev).
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

const client = KEY ? new PostHog(KEY, { host: HOST, captureAppLifecycleEvents: true }) : null;

/** Funnel events. Keep names stable; dashboards depend on them. */
export type AnalyticsEvent =
  | 'signup'
  | 'onboarding_school_saved'
  | 'onboarding_goals'
  | 'lms_connected'
  | 'onboarding_lms_opened'
  | 'onboarding_lms_skipped'
  | 'onboarding_lms_skip_tapped'
  | 'onboarding_lms_skip_reversed'
  | 'lms_nudge_tapped'
  | 'syllabus_nudge_tapped'
  | 'lms_foreground_sync'
  | 'lms_connect_step'
  | 'lms_reconnect_tapped'
  | 'syllabus_uploaded'
  | 'onboarding_syllabus_skipped'
  | 'dashboard_revealed'
  | 'push_permission'
  | 'paywall_viewed'
  | 'paywall_cta_clicked'
  | 'paywall_dismissed'
  | 'subscription_purchased'
  | 'purchase_restored'
  | 'chat_message'
  | 'limit_hit';

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean | null>) {
  try {
    client?.capture(event, { platform: 'ios_app', ...props });
  } catch {}
}

export function identify(userId: string, email?: string | null) {
  try {
    client?.identify(userId, email ? { email } : undefined);
  } catch {}
}

export function resetAnalytics() {
  try {
    client?.reset();
  } catch {}
}
