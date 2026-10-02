import { fetch as streamingFetch } from 'expo/fetch';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty, Icon, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, apiRaw, errorMessage } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { getAccessToken } from '@/lib/tokens';
import type { ChatMessage, Conversation } from '@/lib/types';

const SUGGESTIONS = ['What’s due this week?', 'Make me a study plan for my next exam', 'Which class should I focus on today?'];

export default function Chat() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Resume the most recent conversation.
  useEffect(() => {
    (async () => {
      try {
        const convs = await api<Conversation[]>('/chat/conversations');
        if (convs[0]) {
          setConversationId(convs[0].id);
          setMessages(await api<ChatMessage[]>(`/chat/conversations/${convs[0].id}/messages`));
        }
      } catch {}
    })();
  }, []);

  const newChat = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setInput('');
      setError(null);
      setSending(true);
      const tempUser: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() };
      const tempBot: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', created_at: new Date().toISOString() };
      setMessages((m) => [...m, tempUser, tempBot]);

      try {
        let convId = conversationId;
        if (!convId) {
          const conv = await api<Conversation>('/chat/conversations', { method: 'POST' });
          convId = conv.id;
          setConversationId(conv.id);
        }

        const body = new FormData();
        body.append('content', content);
        const post = () =>
          streamingFetch(`${API_URL}/chat/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
            body,
          });
        let res = await post();
        if (res.status === 401) {
          await apiRaw('/me'); // triggers the shared token refresh
          res = await post();
        }
        if (!res.ok || !res.body) throw new Error(await errorMessage(res as unknown as Response));

        // Server-sent events: lines of `data: {"type": "chunk" | "done" | "error", ...}`
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let answer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const ev of events) {
            const line = ev.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'chunk') {
              answer += msg.content;
              setMessages((m) => m.map((x) => (x.id === tempBot.id ? { ...x, content: answer } : x)));
            } else if (msg.type === 'error') {
              throw new Error(msg.content);
            }
          }
        }
      } catch (e) {
        setMessages((m) => m.filter((x) => x.id !== tempBot.id));
        setError(e instanceof Error ? e.message : 'Message failed to send');
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={newChat} hitSlop={12} accessibilityLabel="New chat">
              <Icon name="square.and.pencil" color={t.tint} size={22} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Empty icon="sparkles" title="Ask ClassMate" message="It knows your courses, deadlines, and notes." />
              <View style={{ gap: Spacing.two }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => send(s)} style={{ backgroundColor: t.card, borderRadius: 12, padding: Spacing.three }}>
                    <Text variant="secondary" style={{ color: t.text }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.role === 'user';
            return (
              <View
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: mine ? t.tint : t.card,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}>
                <Text selectable style={{ color: mine ? '#fff' : t.text }}>
                  {item.content || (sending ? '…' : '')}
                </Text>
              </View>
            );
          }}
        />
        {error ? <Text style={{ color: t.danger, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two }}>{error}</Text> : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.two,
            paddingHorizontal: Spacing.four,
            paddingTop: Spacing.two,
            paddingBottom: Math.max(insets.bottom, Spacing.two) + 49, // clear the tab bar
            borderTopWidth: 0.5,
            borderTopColor: t.border,
            backgroundColor: t.background,
          }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message ClassMate"
            placeholderTextColor={t.textSecondary}
            multiline
            style={{ flex: 1, maxHeight: 120, backgroundColor: t.card, color: t.text, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16 }}
          />
          <Pressable onPress={() => send(input)} disabled={!input.trim() || sending} accessibilityLabel="Send" style={{ paddingBottom: 6 }}>
            <Icon name="arrow.up.circle.fill" size={32} color={input.trim() && !sending ? t.tint : t.border} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
