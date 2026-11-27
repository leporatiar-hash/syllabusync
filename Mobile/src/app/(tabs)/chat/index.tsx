import { router } from 'expo-router';
import { CalendarClock, ChevronRight, GraduationCap, ListChecks, MessageCircle, Sparkles, SquarePen, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenTitle, SectionHeader, TitleAction } from '@/components/app-chrome';
import { LogoMark, Spinner, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { Conversation, Subscription } from '@/lib/types';

const STARTERS: { icon: LucideIcon; label: string; prompt: string; fg: string; bg: string }[] = [
  { icon: CalendarClock, label: 'What’s due this week?', prompt: 'What’s due this week?', fg: '#2563EB', bg: '#E0EAFF' },
  { icon: ListChecks, label: 'What should I start first?', prompt: 'What should I start first today, and why?', fg: '#059669', bg: '#D1FAE5' },
  { icon: GraduationCap, label: 'When is my next exam?', prompt: 'When is my next exam, and what should I review?', fg: '#DC2626', bg: '#FEE2E2' },
  { icon: Sparkles, label: 'Plan my week', prompt: 'Make me a study plan for this week based on my deadlines.', fg: '#7C3AED', bg: '#EDE9FE' },
];

function when(iso: string) {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ChatList() {
  const { data, setData, loading, refreshing, refresh } = useApi<Conversation[]>('/chat/conversations');
  const sub = useApi<Subscription>('/me/subscription');
  const limitReached = !!sub.data?.chat_messages_max && sub.data.chat_messages_used >= sub.data.chat_messages_max;

  const start = (prompt?: string) => router.push(prompt ? { pathname: '/chat/[id]', params: { id: 'new', prompt } } : { pathname: '/chat/[id]', params: { id: 'new', focus: '1' } });

  const remove = (c: Conversation) =>
    Alert.alert('Delete this chat?', c.title || 'New chat', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setData((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
          await api(`/chat/conversations/${c.id}`, { method: 'DELETE' }).catch(() => {});
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.groupedBg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); sub.refresh(); }} />}>
        <ScreenTitle title="Chat" right={limitReached ? undefined : <TitleAction icon={SquarePen} label="New chat" onPress={() => start()} />} />

        {/* Ask box: looks like the composer, opens a new chat with the keyboard up. */}
        <View style={{ backgroundColor: C.white, borderRadius: 20, borderCurve: 'continuous', padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LogoMark size={36} />
            <View style={{ flex: 1 }}>
              <T size={17} weight="semibold" color={C.slate900}>Ask about your classes</T>
              <T size={13} color={C.slate500}>Knows your deadlines, syllabi and notes</T>
            </View>
          </View>
          <Pressable
            disabled={limitReached}
            onPress={() => start()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: pressed ? C.slate100 : C.slate50, borderWidth: 1, borderColor: C.slate200, paddingHorizontal: 14, paddingVertical: 13 })}>
            <MessageCircle size={18} color={C.slate400} />
            <T size={16} color={C.slate400}>{limitReached ? 'Weekly limit reached' : 'Ask anything…'}</T>
          </Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {STARTERS.map(({ icon: Icon, label, prompt, fg, bg }) => (
              <Pressable
                key={label}
                disabled={limitReached}
                onPress={() => start(prompt)}
                style={({ pressed }) => ({ width: '48%', flexGrow: 1, borderRadius: 14, borderCurve: 'continuous', backgroundColor: pressed ? C.slate100 : C.slate50, padding: 12, gap: 8, opacity: limitReached ? 0.5 : 1 })}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={fg} strokeWidth={2.2} />
                </View>
                <T size={14} weight="medium" color={C.slate800} style={{ lineHeight: 19 }}>{label}</T>
              </Pressable>
            ))}
          </View>
        </View>

        {loading && !data ? <Spinner /> : null}
        {data && data.length > 0 ? (
          <View>
            <SectionHeader>Recent</SectionHeader>
            <View style={{ backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>
              {data.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
                  onLongPress={() => remove(c)}
                  delayLongPress={350}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? C.slate50 : C.white })}>
                  {i ? <View style={{ position: 'absolute', top: 0, left: 16, right: 0, height: 1, backgroundColor: C.slate100 }} /> : null}
                  <T size={16} color={C.slate900} numberOfLines={1} style={{ flex: 1 }}>{c.title || 'New chat'}</T>
                  <T size={13} color={C.slate400}>{when(c.created_at)}</T>
                  <ChevronRight size={16} color={C.slate300} />
                </Pressable>
              ))}
            </View>
            <T size={12} color={C.slate400} style={{ marginTop: 8, paddingHorizontal: 4 }}>Press and hold a chat to delete it.</T>
          </View>
        ) : null}

        {sub.data?.chat_messages_max ? (
          <T size={13} color={C.slate400} style={{ textAlign: 'center' }}>
            {sub.data.chat_messages_used} of {sub.data.chat_messages_max} messages used this week
          </T>
        ) : null}
      </ScrollView>
    </View>
  );
}
