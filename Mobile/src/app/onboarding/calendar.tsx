import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CalendarDays, Check, ChevronDown, ClipboardPaste, KeyRound, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { WebInput } from '@/components/course-form';
import { OnboardingShell } from '@/components/onboarding-shell';
import { Card, GradientButton, IconSquare, OutlineButton, T } from '@/components/web';
import { C } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';

// Where each LMS hides its calendar feed link. Every LMS exports iCal, which is why this is the main path.
const GUIDES = [
  { lms: 'OAKS (D2L Brightspace)', steps: 'Open OAKS on the web → Calendar → Subscribe (bottom of the calendar) → copy the feed link.' },
  { lms: 'Canvas', steps: 'Open Canvas on the web → Calendar → Calendar Feed (bottom right) → copy the link.' },
  { lms: 'Blackboard', steps: 'Calendar → the gear icon → Share Calendar → Generate link → copy it.' },
  { lms: 'Google Calendar', steps: 'Settings → your calendar → Integrate calendar → copy the “Secret address in iCal format”.' },
];

type Connected = { provider: 'iCal' | 'Canvas'; synced: number };

export default function CalendarStep() {
  const [mode, setMode] = useState<'ical' | 'canvas'>('ical');
  const [icalUrl, setIcalUrl] = useState('');
  const [canvasUrl, setCanvasUrl] = useState('');
  const [canvasToken, setCanvasToken] = useState('');
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<Connected[]>([]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'ical') {
        const r = await api<{ initial_sync?: { synced_count: number } }>('/lms/connect/ical', { method: 'POST', body: JSON.stringify({ ical_url: icalUrl.trim() }) });
        setConnected((c) => [...c, { provider: 'iCal', synced: r.initial_sync?.synced_count ?? 0 }]);
        setIcalUrl('');
      } else {
        const url = canvasUrl.trim().startsWith('http') ? canvasUrl.trim() : `https://${canvasUrl.trim()}`;
        const r = await api<{ initial_sync?: { synced_count: number } }>('/lms/connect/canvas', { method: 'POST', body: JSON.stringify({ instance_url: url, access_token: canvasToken.trim() }) });
        setConnected((c) => [...c, { provider: 'Canvas', synced: r.initial_sync?.synced_count ?? 0 }]);
        setCanvasToken('');
      }
      track('lms_connected', { provider: mode });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t connect');
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    track('onboarding_lms_skipped');
    router.push('/onboarding/syllabus');
  };

  return (
    <OnboardingShell
      step={1}
      title="Connect your school calendar"
      subtitle="ClassMate pulls in every assignment and exam your professors post, and keeps checking for new ones."
      onSkip={connected.length ? undefined : skip}
      footer={
        connected.length ? (
          <GradientButton title="Continue" size="lg" onPress={() => router.push('/onboarding/syllabus')} />
        ) : (
          <>
            <GradientButton title="Connect" size="lg" loading={busy} disabled={mode === 'ical' ? !icalUrl.trim() : !canvasUrl.trim() || !canvasToken.trim()} onPress={connect} />
            <OutlineButton title="I don’t have one, skip" onPress={skip} />
          </>
        )
      }>
      {connected.map((c, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.emerald, alignItems: 'center', justifyContent: 'center' }}><Check size={14} color="#fff" strokeWidth={3} /></View>
          <T size={14} weight="medium" color="#047857" style={{ flex: 1 }}>{c.provider} connected · {c.synced} item{c.synced === 1 ? '' : 's'} synced</T>
        </View>
      ))}

      <View style={{ flexDirection: 'row', backgroundColor: C.slate100, borderRadius: 999, padding: 4 }}>
        {(['ical', 'canvas'] as const).map((m) => (
          <Pressable key={m} onPress={() => { setMode(m); setError(null); }} style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: mode === m ? C.white : 'transparent' }}>
            <T size={14} weight="semibold" color={mode === m ? C.slate900 : C.slate500}>{m === 'ical' ? 'Calendar link (any LMS)' : 'Canvas token'}</T>
          </Pressable>
        ))}
      </View>

      {mode === 'ical' ? (
        <>
          <View style={{ gap: 8 }}>
            <WebInput label="Calendar feed link" placeholder="https://… .ics" value={icalUrl} onChangeText={setIcalUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <Pressable
              onPress={async () => setIcalUrl((await Clipboard.getStringAsync()).trim())}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <ClipboardPaste size={14} color={C.brand} />
              <T size={13} weight="medium" color={C.brand}>Paste from clipboard</T>
            </Pressable>
          </View>
          <Card radius={16} padding={4}>
            <T size={13} weight="semibold" color={C.slate700} style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>Where do I find it?</T>
            {GUIDES.map((g) => {
              const open = openGuide === g.lms;
              return (
                <Pressable key={g.lms} onPress={() => setOpenGuide(open ? null : g.lms)} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.slate100 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T size={14} color={C.slate800}>{g.lms}</T>
                    <ChevronDown size={16} color={C.slate400} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                  </View>
                  {open ? <T size={13} color={C.slate500} style={{ marginTop: 6, lineHeight: 19 }}>{g.steps}</T> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/ical-guide.mp4`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.slate100 }}>
              <PlayCircle size={16} color={C.brand} />
              <T size={13} weight="medium" color={C.brand}>Watch the 30-second video</T>
            </Pressable>
          </Card>
        </>
      ) : (
        <>
          <WebInput label="Canvas address" placeholder="yourschool.instructure.com" value={canvasUrl} onChangeText={setCanvasUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <WebInput label="Access token" placeholder="Paste your token" value={canvasToken} onChangeText={setCanvasToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <IconSquare icon={KeyRound} bg={C.slate100} fg={C.slate500} size={32} radius={8} />
            <T size={13} color={C.slate500} style={{ flex: 1, lineHeight: 19 }}>In Canvas on the web: Account → Settings → “+ New Access Token”. Copy it right away; Canvas only shows it once.</T>
          </View>
        </>
      )}
      {error ? <T size={14} color={C.red}>{error}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <CalendarDays size={14} color={C.slate400} />
        <T size={12} color={C.slate400} style={{ flex: 1 }}>Read-only. ClassMate never posts or changes anything in your LMS.</T>
      </View>
    </OnboardingShell>
  );
}
