import { router } from 'expo-router';
import { SquarePen, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenTitle, TitleAction } from '@/components/app-chrome';
import { GradientButton, Spinner, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { Conversation, Subscription } from '@/lib/types';

export default function ChatList() {
  const { data, setData, loading, refreshing, refresh } = useApi<Conversation[]>('/chat/conversations');
  const sub = useApi<Subscription>('/me/subscription');
  const limitReached = !!sub.data?.chat_messages_max && sub.data.chat_messages_used >= sub.data.chat_messages_max;

  const remove = (c: Conversation) =>
    Alert.alert('Delete this chat?', c.title || 'New Chat', [
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
    <View style={{ flex: 1, backgroundColor: '#FBFCFC' }}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenTitle title="Chat" right={limitReached ? undefined : <TitleAction icon={SquarePen} label="New chat" onPress={() => router.push('/chat/new')} />} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); sub.refresh(); }} />}>
        {loading && !data ? <Spinner /> : null}
        {data?.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 14, marginTop: 40 }}>
            <T size={15} color={C.slate500} style={{ textAlign: 'center' }}>Ask what’s due, what to start first, or anything about your courses.</T>
            <GradientButton title="Start a chat" disabled={limitReached} onPress={() => router.push('/chat/new')} />
          </View>
        ) : null}
        {(data ?? []).map((c) => (
          <Pressable key={c.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} onLongPress={() => remove(c)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: pressed ? '#EEEDFE' : 'transparent' })}>
            <View style={{ flex: 1 }}>
              <T size={15} weight="medium" color={C.slate700} numberOfLines={1}>{c.title || 'New Chat'}</T>
              <T size={12} color={C.slate400}>{new Date(c.created_at.endsWith('Z') ? c.created_at : `${c.created_at}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</T>
            </View>
            <Pressable onPress={() => remove(c)} hitSlop={10} accessibilityLabel="Delete chat"><Trash2 size={15} color={C.slate300} /></Pressable>
          </Pressable>
        ))}
        {sub.data ? <T size={12} color={C.slate400} style={{ textAlign: 'center', marginTop: 16 }}>{sub.data.chat_messages_used}/{sub.data.chat_messages_max ?? '∞'} messages used this week</T> : null}
      </ScrollView>
    </View>
  );
}
