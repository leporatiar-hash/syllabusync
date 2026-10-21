import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Lock, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { QuizButton, useQuiz } from '@/components/quiz-kit';
import { BrandLoader, T } from '@/components/web';
import { C, getCourseColor, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { syncLms } from '@/lib/lms-sync';
import { CANVAS_SCRIPT, D2L_SCRIPT, type FeedMessage, redactFeed } from '@/lib/lms-feed';
import { confirmLms, lmsBrand, lmsStartUrl } from '@/lib/schools';
import type { Course } from '@/lib/types';

/** The school's own LMS (from "Where do you go?"), falling back to OAKS for old sessions. */
function lmsFor(provider: string | null, host: string | null, name: string | null) {
  const p = provider === 'canvas' ? 'canvas' : 'brightspace';
  const h = host ?? (p === 'canvas' ? 'canvas.instructure.com' : 'lms.cofc.edu');
  return { provider: p, host: h, name: name ?? lmsBrand(h, p), start: lmsStartUrl(p, h), script: p === 'canvas' ? CANVAS_SCRIPT : D2L_SCRIPT } as const;
}

type Phase = 'signin' | 'looking' | 'connecting' | 'done' | 'manual' | 'error';

const close = () => (router.canGoBack() ? router.back() : router.replace('/onboarding/connect'));

/** The LMS loads inside ClassMate. Once the student is signed in we read their own calendar feed
 *  link from the page and connect it; they never copy anything. */
export default function LmsSignIn() {
  const insets = useSafeAreaInsets();
  const { answers, set } = useQuiz();
  const [lms] = useState(() => lmsFor(answers.lms, answers.lmsHost, answers.lmsName));
  const web = useRef<WebView>(null);
  const [phase, setPhase] = useState<Phase>('signin');
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const navigatedToCalendar = useRef(false);
  const [result, setResult] = useState<{
    count: number;
    courses: Course[];
  } | null>(null);
  // One event per step, so the funnel shows exactly where connects fail at each school.
  const opened = useRef(0);
  const stepsSeen = useRef(new Set<string>());
  const phaseRef = useRef<Phase>('signin');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const step = (name: string, extra: Record<string, string | number | boolean | null> = {}) => {
    if (stepsSeen.current.has(name)) return;
    stepsSeen.current.add(name);
    track('lms_connect_step', { step: name, lms: answers.lms ?? null, host: lms.host, seconds: Math.round((Date.now() - opened.current) / 1000), ...extra });
  };
  useEffect(() => {
    const start = Date.now();
    opened.current = start;
    step('opened');
    // Leaving before it's connected is the drop-off we most need to see.
    return () => {
      if (phaseRef.current !== 'done') track('lms_connect_step', { step: 'closed', at: phaseRef.current, lms: answers.lms ?? null, seconds: Math.round((Date.now() - start) / 1000) });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cover the page while it loads so a blank SSO redirect never looks broken.
  const [pageLoading, setPageLoading] = useState(true);
  useEffect(() => {
    if (!pageLoading) return;
    const t = setTimeout(() => setPageLoading(false), 15000); // never trap them behind the loader
    return () => clearTimeout(t);
  }, [pageLoading]);

  const connect = async (url: string) => {
    if (done.current) return;
    done.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('connecting');
    let count = 0;
    try {
      const r = await api<{ initial_sync?: { synced_count: number } }>('/lms/connect/ical', {
        method: 'POST',
        body: JSON.stringify({
          ical_url: url.replace(/^webcal:\/\//i, 'https://'),
        }),
      });
      count = r.initial_sync?.synced_count ?? 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Connected on an earlier try: that's still a success for the student.
      if (!/already connected/i.test(msg)) {
        done.current = false;
        step('connect_failed', { error: msg.slice(0, 120) });
        setPhase('error');
        setError(msg || 'Couldn’t connect');
        return;
      }
    }
    syncLms(true); // a reconnect with the same link clears a stale "not syncing" state
    // Remember it on their profile, and for classmates at the same school.
    if (answers.schoolDomain) confirmLms(answers.schoolDomain, lms.provider, lms.host);
    const list = await api<Course[]>('/courses').catch(() => [] as Course[]);
    if (!count) count = list.reduce((n, c) => n + (c.deadline_count || 0), 0);
    setResult({ count, courses: list });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    step('connected', { items: count, courses: list.length });
    track('lms_connected', {
      provider: 'ical',
      lms: answers.lms ?? null,
      method: 'auto',
    });
    setPhase('done');
  };

  const retry = () => {
    done.current = false;
    navigatedToCalendar.current = false;
    setError(null);
    setPhase('signin');
    setPageLoading(true);
    web.current?.reload();
  };

  // The celebration already happened here, so skip the connect step's own "synced" card.
  const finish = () => {
    set({ lmsSynced: result?.count ?? 0 });
    router.replace(answers.mode === 'app' ? '/' : '/onboarding/alerts');
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: FeedMessage;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      setPageLoading(false);
      step('page_ready');
    } else if (m.type === 'page') {
      if (m.signedIn) {
        step('signed_in');
        setPhase((p) => (p === 'signin' ? 'looking' : p));
      }
    } else if (m.type === 'feed') {
      if (__DEV__) console.log('[lms-feed] found', m.source, redactFeed(m.url), m.tried.join(' | '));
      // `tried` holds paths + status codes only (no tokens): it says which method found it.
      step('feed_found', { source: m.source, tried: m.tried.join(' | ').slice(0, 300) });
      connect(m.url);
    } else if (m.type === 'miss') {
      if (__DEV__) console.log('[lms-feed] miss', m.path, m.tried.join(' | '));
      step('feed_missed', { tried: m.tried.join(' | ').slice(0, 300), has_calendar: !!m.calendar });
      // Only fall back to "tap Subscribe" once we've confirmed a real signed-in miss with a calendar to show.
      if (!m.calendar) {
        setPhase('error');
        setError(`Couldn’t find your ${lms.name} calendar automatically. Go back and paste your calendar link instead.`);
        return;
      }
      // Couldn't find it on our own: open the real calendar once so one tap on Subscribe finishes it.
      setPhase('manual');
      const target = m.calendar;
      if (!navigatedToCalendar.current && !m.path.startsWith(target)) {
        navigatedToCalendar.current = true;
        web.current?.injectJavaScript(`location.href=${JSON.stringify(target)}; true;`);
      }
    }
  };

  const banner =
    phase === 'signin'
      ? {
          text: `Sign in to ${lms.name}. ClassMate takes it from there.`,
          busy: false,
        }
      : phase === 'manual'
        ? { text: 'Almost: tap Subscribe on the calendar.', busy: false }
        : { text: error ?? 'Something went wrong', busy: false };

  return (
    <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.slate100,
        }}
      >
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityLabel="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: C.slate100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color={C.slate600} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Lock size={13} color={C.slate400} />
          <T size={14} weight="semibold" color={C.slate700}>
            {lms.name}
          </T>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={web}
          source={{ uri: lms.start }}
          injectedJavaScript={lms.script}
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => web.current?.injectJavaScript(lms.script)}
          onError={() => setPageLoading(false)}
          onMessage={onMessage}
          sharedCookiesEnabled
          style={{ flex: 1 }}
        />

        {phase === 'looking' || phase === 'connecting' || phase === 'done' || (pageLoading && phase === 'signin') ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: C.slate50,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 16,
            }}
          >
            {phase === 'signin' ? (
              <BrandLoader size={56} label={`Opening ${lms.name}…`} />
            ) : phase === 'looking' ? (
              <BrandLoader size={56} label="You’re signed in" sublabel={`Finding your ${lms.name} calendar…`} />
            ) : phase === 'connecting' ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <BrandLoader size={56} label={`Found your ${lms.name} calendar`} sublabel="Pulling in your classes and due dates…" />
              </Animated.View>
            ) : (
              <View
                style={{
                  alignSelf: 'stretch',
                  flex: 1,
                  justifyContent: 'center',
                  gap: 18,
                }}
              >
                <Animated.View
                  entering={ZoomIn.springify().damping(12)}
                  style={{
                    alignSelf: 'center',
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: '#DCFCE7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={48} color={C.green} strokeWidth={3} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(150).duration(360)} style={{ alignItems: 'center', gap: 6 }}>
                  <T size={28} weight="bold" color={C.slate900} style={{ textAlign: 'center' }}>
                    {lms.name} is connected
                  </T>
                  <T size={16} color={C.slate500} style={{ textAlign: 'center' }}>
                    {result?.count ? `${result.count} ${result.count === 1 ? 'due date' : 'due dates'} pulled in. ` : ''}
                    New ones show up on their own.
                  </T>
                </Animated.View>
                {result?.courses.length ? (
                  <Animated.View
                    entering={FadeInDown.delay(300).duration(360)}
                    style={[
                      {
                        backgroundColor: C.white,
                        borderRadius: 20,
                        padding: 14,
                        gap: 10,
                      },
                      shadowSm,
                    ]}
                  >
                    {result.courses.slice(0, 5).map((c) => (
                      <View
                        key={c.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: getCourseColor(c.id, c.color).accent,
                          }}
                        />
                        <T size={15} weight="medium" color={C.slate800} numberOfLines={1} style={{ flex: 1 }}>
                          {c.code || c.name}
                        </T>
                        <T size={13} color={C.slate400}>
                          {c.deadline_count}
                        </T>
                      </View>
                    ))}
                    {result.courses.length > 5 ? (
                      <T size={13} color={C.slate400}>
                        +{result.courses.length - 5} more
                      </T>
                    ) : null}
                  </Animated.View>
                ) : null}
                <Animated.View
                  entering={FadeInDown.delay(420).duration(360)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Lock size={12} color={C.slate400} />
                  <T size={13} color={C.slate400}>
                    Read-only. ClassMate never changes anything in {lms.name}.
                  </T>
                </Animated.View>
                <View style={{ marginTop: 8 }}>
                  <QuizButton title="Continue" onPress={finish} />
                </View>
              </View>
            )}
          </Animated.View>
        ) : (
          <Animated.View
            key={phase}
            entering={FadeIn.duration(250)}
            style={[
              {
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: insets.bottom + 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: phase === 'error' ? '#FEF2F2' : C.slate900,
                borderRadius: 18,
                paddingHorizontal: 16,
                paddingVertical: 14,
              },
              shadowSm,
            ]}
          >
            {banner.busy ? <ActivityIndicator color="#fff" /> : null}
            <T size={15} weight="medium" color={phase === 'error' ? C.red : '#fff'} style={{ flex: 1 }}>
              {banner.text}
            </T>
            {phase === 'error' ? (
              <Pressable onPress={retry} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: C.white }}>
                <T size={14} weight="semibold" color={C.red}>Try again</T>
              </Pressable>
            ) : null}
          </Animated.View>
        )}
      </View>
    </View>
  );
}
