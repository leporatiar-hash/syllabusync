import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { BellOff, CalendarX2, Check, PencilLine } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { goTo, type Lms, QuizButton, QuizScreen, useQuiz } from '@/components/quiz-kit';
import { T } from '@/components/web';
import { C, F, shadowSm } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';

type Guide = { name: string; url: string; where: string };
// `url` is where the in-app browser opens; `where` is the one thing to tap once they're signed in.
// Only used when we don't know the school's LMS address; with one, sign-in happens in the app.
const GUIDES: Record<Exclude<Lms, 'none'>, Guide> = {
  brightspace: { name: 'Brightspace', url: 'https://www.google.com/search?q=my+school+brightspace+login', where: 'Calendar → Subscribe, then copy the link' },
  canvas: { name: 'Canvas', url: 'https://www.instructure.com/canvas/login', where: 'Calendar → Calendar Feed' },
  blackboard: { name: 'Blackboard', url: 'https://www.google.com/search?q=my+school+blackboard+login', where: 'Calendar → ⚙ → Share Calendar' },
  other: { name: 'your LMS', url: 'https://www.google.com/search?q=my+school+lms+login', where: 'Calendar → Subscribe / Export' },
};

const looksLikeFeed = (s: string) => /^(https?|webcal):\/\/\S+$/i.test(s.trim()) && /(ical|\.ics|calendar|feed|webcal)/i.test(s);

export default function ConnectStep() {
  const { answers, set } = useQuiz();
  const base = GUIDES[(answers.lms && answers.lms !== 'none' ? answers.lms : 'other') as Exclude<Lms, 'none'>];
  const guide = { ...base, name: answers.lmsName ?? base.name };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [localSynced, setSynced] = useState<number | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const inApp = answers.mode === 'app';
  const synced = answers.lmsSynced ?? localSynced;
  // We know where they sign in: open it in the app and pick up the calendar link ourselves.
  const auto = (answers.lms === 'brightspace' || answers.lms === 'canvas') && !!answers.lmsHost;

  const connect = async (raw: string) => {
    const link = raw.trim().replace(/^webcal:\/\//i, 'https://');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ initial_sync?: { synced_count: number } }>('/lms/connect/ical', { method: 'POST', body: JSON.stringify({ ical_url: link }) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSynced(r.initial_sync?.synced_count ?? 0);
      set({ lmsSynced: r.initial_sync?.synced_count ?? 0 });
      track('lms_connected', { provider: 'ical', lms: answers.lms ?? null });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'That link didn’t work.');
    } finally {
      setBusy(false);
    }
  };

  /** Check the clipboard; connect if it holds a calendar link. */
  const tryClipboard = async (quiet = false) => {
    if (!(await Clipboard.hasStringAsync())) return !quiet && setError('Copy the link first, then tap again.');
    const text = (await Clipboard.getStringAsync()).trim();
    if (looksLikeFeed(text)) return connect(text);
    if (!quiet) setError('That doesn’t look like a calendar link. It usually ends in .ics.');
  };

  // OAKS/Canvas: sign in inside ClassMate and the feed link is picked up automatically.
  // Others: open the LMS; when they close it with the link copied, connect from the clipboard.
  const openLms = async () => {
    if (auto) {
      track('onboarding_lms_opened', { lms: answers.lms ?? null, method: 'auto' });
      router.push('/onboarding/lms-signin');
      return;
    }
    setError(null);
    track('onboarding_lms_opened', { lms: answers.lms ?? null });
    await WebBrowser.openBrowserAsync(guide.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    await tryClipboard(true);
  };

  // Skipping the LMS is the biggest drop-off in value, so it takes a second, honest look.
  if (confirmSkip) {
    const costs = [
      { icon: CalendarX2, text: 'When a professor moves a due date, you won’t hear about it.' },
      { icon: PencilLine, text: 'Every assignment gets typed in by hand.' },
      { icon: BellOff, text: `No reminders for anything posted in ${guide.name}.` },
    ];
    return (
      <QuizScreen
        title={`Skip ${guide.name}?`}
        subtitle="It takes about 30 seconds, and you only do it once."
        onSkip={() => { track('onboarding_lms_skipped', { reason: 'confirmed' }); goTo('syllabus'); }}
        skipLabel="Skip anyway"
        footer={<QuizButton title={`Connect ${guide.name}`} onPress={() => { track('onboarding_lms_skip_reversed', { lms: answers.lms ?? null }); setConfirmSkip(false); openLms(); }} />}>
        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={[{ backgroundColor: C.white, borderRadius: 24, padding: 18, gap: 16 }, shadowSm]}>
          {costs.map(({ icon: Icon, text }) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={C.red} />
              </View>
              <T size={15} weight="medium" color={C.slate800} style={{ flex: 1 }}>{text}</T>
            </View>
          ))}
        </Animated.View>
      </QuizScreen>
    );
  }

  if (synced !== null) {
    return (
      <QuizScreen title="You’re synced." footer={<QuizButton title="Next" onPress={() => (inApp ? router.replace('/') : goTo('syllabus'))} />}>
        <Animated.View entering={ZoomIn.springify()} style={[{ alignItems: 'center', backgroundColor: C.white, borderRadius: 28, paddingVertical: 36, gap: 6 }, shadowSm]}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Check size={36} color={C.green} strokeWidth={3} />
          </View>
          <T size={44} weight="bold" color={C.slate900} style={{ lineHeight: 50 }}>{synced}</T>
          <T size={15} color={C.slate500}>{synced === 1 ? 'item' : 'items'} from {guide.name}. New ones sync on their own.</T>
        </Animated.View>
      </QuizScreen>
    );
  }

  return (
    <QuizScreen
      title={`Connect ${guide.name}`}
      subtitle={auto ? `Sign in and ClassMate pulls in every assignment. Read-only.` : `Copy your calendar link from ${guide.name}, come back, done.`}
      onSkip={() => {
        if (inApp) return router.back();
        track('onboarding_lms_skip_tapped', { lms: answers.lms ?? null });
        setConfirmSkip(true);
      }}
      skipLabel={inApp ? 'Not now' : 'Skip for now'}
      footer={<QuizButton title={auto ? `Sign in to ${guide.name}` : `Open ${guide.name}`} loading={busy} onPress={openLms} />}>
      {!auto ? (
      <Animated.View entering={FadeInDown.delay(80).duration(360)} style={[{ backgroundColor: C.white, borderRadius: 24, padding: 18, gap: 14 }, shadowSm]}>
        {[`Sign in to ${guide.name}`, guide.where, 'Copy the link, then close the page'].map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
              <T size={14} weight="bold" color={C.brand}>{i + 1}</T>
            </View>
            <T size={16} weight="medium" color={C.slate800} style={{ flex: 1 }}>{s}</T>
          </View>
        ))}
      </Animated.View>
      ) : null}

      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
          <ActivityIndicator color={C.brand} />
          <T size={15} color={C.slate600}>Connecting…</T>
        </View>
      ) : null}
      {error ? <T size={14} color={C.red} style={{ textAlign: 'center' }}>{error}</T> : null}

      {auto && !showPaste ? (
        <Pressable onPress={() => setShowPaste(true)} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <T size={14} weight="medium" color={C.slate500}>Already have your calendar link? Paste it</T>
        </Pressable>
      ) : (
      <Animated.View entering={FadeInDown.delay(180).duration(360)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <TextInput
          value={manual}
          onChangeText={(v) => { setManual(v); setError(null); }}
          placeholder="Already copied it? Paste here"
          placeholderTextColor={C.slate400}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => manual.trim() && connect(manual)}
          style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.slate900, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.slate200, paddingHorizontal: 14, paddingVertical: 13 }}
        />
        <Pressable
          onPress={() => (manual.trim() ? connect(manual) : tryClipboard())}
          accessibilityLabel={manual.trim() ? 'Connect' : 'Paste from clipboard'}
          style={{ height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <T size={15} weight="semibold" color={C.brand}>{manual.trim() ? 'Connect' : 'Paste'}</T>
        </Pressable>
      </Animated.View>
      )}
    </QuizScreen>
  );
}
