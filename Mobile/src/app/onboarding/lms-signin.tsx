import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Lock, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useQuiz } from '@/components/quiz-kit';
import { T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { CANVAS_SCRIPT, D2L_SCRIPT, type FeedMessage, redactFeed } from '@/lib/lms-feed';

const LMS = {
  oaks: { name: 'OAKS', start: 'https://lms.cofc.edu/d2l/home', script: D2L_SCRIPT },
  canvas: { name: 'Canvas', start: 'https://www.instructure.com/canvas/login', script: CANVAS_SCRIPT },
} as const;

type Phase = 'signin' | 'looking' | 'connecting' | 'manual' | 'error';

/** The LMS loads inside ClassMate. Once the student is signed in we read their own calendar feed
 *  link from the page and connect it; they never copy anything. */
export default function LmsSignIn() {
  const insets = useSafeAreaInsets();
  const { answers, set } = useQuiz();
  const lms = LMS[answers.lms === 'canvas' ? 'canvas' : 'oaks'];
  const web = useRef<WebView>(null);
  const [phase, setPhase] = useState<Phase>('signin');
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const navigatedToCalendar = useRef(false);

  const connect = async (url: string) => {
    if (done.current) return;
    done.current = true;
    setPhase('connecting');
    try {
      const r = await api<{ initial_sync?: { synced_count: number } }>('/lms/connect/ical', {
        method: 'POST',
        body: JSON.stringify({ ical_url: url.replace(/^webcal:\/\//i, 'https://') }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('lms_connected', { provider: 'ical', lms: answers.lms ?? null, method: 'auto' });
      set({ lmsSynced: r.initial_sync?.synced_count ?? 0 });
      router.back();
    } catch (e) {
      done.current = false;
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Couldn’t connect');
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: FeedMessage;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'page') {
      if (m.signedIn) setPhase((p) => (p === 'signin' ? 'looking' : p));
    } else if (m.type === 'feed') {
      if (__DEV__) console.log('[lms-feed] found', m.source, redactFeed(m.url), m.tried.join(' | '));
      connect(m.url);
    } else if (m.type === 'miss') {
      if (__DEV__) console.log('[lms-feed] miss', m.path, m.tried.join(' | '));
      // Only fall back to "tap Subscribe" once we've confirmed a real signed-in miss with a calendar to show.
      if (!m.calendar) {
        setPhase('error');
        setError('Couldn’t find your OAKS calendar automatically. Use “Paste” on the previous screen instead.');
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
    phase === 'signin' ? { text: `Sign in to ${lms.name}. ClassMate takes it from there.`, busy: false }
    : phase === 'looking' ? { text: 'Finding your calendar…', busy: true }
    : phase === 'connecting' ? { text: 'Connecting…', busy: true }
    : phase === 'manual' ? { text: 'Almost: tap Subscribe on the calendar.', busy: false }
    : { text: error ?? 'Something went wrong', busy: false };

  return (
    <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.slate100 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color={C.slate600} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Lock size={13} color={C.slate400} />
          <T size={14} weight="semibold" color={C.slate700}>{lms.name}</T>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <WebView
        ref={web}
        source={{ uri: lms.start }}
        injectedJavaScript={lms.script}
        onLoadEnd={() => web.current?.injectJavaScript(lms.script)}
        onMessage={onMessage}
        sharedCookiesEnabled
        style={{ flex: 1 }}
      />

      <Animated.View key={phase} entering={FadeIn.duration(250)} style={[{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: phase === 'error' ? '#FEF2F2' : C.slate900, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 }, shadowSm]}>
        {banner.busy ? <ActivityIndicator color="#fff" /> : null}
        <T size={15} weight="medium" color={phase === 'error' ? C.red : '#fff'} style={{ flex: 1 }}>{banner.text}</T>
      </Animated.View>
    </View>
  );
}
