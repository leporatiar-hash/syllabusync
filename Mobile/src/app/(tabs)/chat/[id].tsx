import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { CHAT_SOFT_BG, CHAT_SOFT_TEXT, ChatComposer } from '@/components/chat-composer';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { LogoMark, T } from '@/components/web';
import { C } from '@/constants/theme';
import { api } from '@/lib/api';
import { ChatError, streamChatMessage } from '@/lib/chat-stream';
import { track } from '@/lib/analytics';
import { usePaywall } from '@/components/paywall';
import type { ChatMessage, Conversation } from '@/lib/types';

const PROMPTS = ['What’s due this week?', 'Make me a study plan for my next exam', 'Which class should I focus on today?', 'Quiz me on my notes'];

/** One conversation; id "new" shows the web's empty state and creates the conversation on first send. */
export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversationId, setConversationId] = useState<string | null>(id === 'new' ? null : id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { openPaywall } = usePaywall();

  useEffect(() => {
    if (id !== 'new') api<ChatMessage[]>(`/chat/conversations/${id}/messages`).then(setMessages).catch(() => {});
  }, [id]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setInput('');
    setError(null);
    setSending(true);
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content, created_at: now };
    const botId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: botId, role: 'assistant', content: '', created_at: now }]);
    try {
      let convId = conversationId;
      if (!convId) {
        convId = (await api<Conversation>('/chat/conversations', { method: 'POST' })).id;
        setConversationId(convId);
        router.setParams({ id: convId });
      }
      await streamChatMessage(convId, content, (soFar) => setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: soFar } : x))));
      track('chat_message');
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== botId && x.id !== userMsg.id));
      const msg = e instanceof Error ? e.message : 'Message failed to send';
      setError(msg);
      if (e instanceof ChatError && e.status === 403) {
        track('limit_hit', { kind: 'chat' });
        setInput(content);
        openPaywall('limit', msg);
      }
    } finally {
      setSending(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.white }} keyboardVerticalOffset={120}>
      <BackBar label="Chats" />
      {empty ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ alignItems: 'center' }}>
            <LogoMark size={44} />
            <T size={20} weight="semibold" color={C.slate900} style={{ marginTop: 16, letterSpacing: -0.4 }}>How can I help you study?</T>
            <T size={14} color={C.slate500} style={{ marginTop: 6, textAlign: 'center' }}>Ask anything about your courses, or tap a prompt below to get started.</T>
          </View>
          <View style={{ marginTop: 24 }}>
            <ChatComposer value={input} onChange={setInput} onSubmit={() => send(input)} sending={sending} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {PROMPTS.map((p) => (
              <Pressable key={p} onPress={() => send(p)} style={({ pressed }) => ({ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? '#E2E0FD' : CHAT_SOFT_BG })}>
                <T size={13} weight="medium" color={CHAT_SOFT_TEXT}>{p}</T>
              </Pressable>
            ))}
          </View>
          {error ? <T color={C.red} style={{ marginTop: 12, textAlign: 'center' }}>{error}</T> : null}
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) =>
              item.role === 'user' ? (
                <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
                  <View style={{ maxWidth: '80%', backgroundColor: CHAT_SOFT_BG, borderRadius: 16, borderTopRightRadius: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
                    <T size={14} color={C.slate800} selectable style={{ lineHeight: 21 }}>{item.content}</T>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, maxWidth: '92%' }}>
                  <LogoMark size={23} />
                  <View style={{ flex: 1 }}>
                    {item.content ? <SimpleMarkdown text={item.content} /> : <T color={C.slate400}>Thinking…</T>}
                  </View>
                </View>
              )
            }
          />
          {error ? <T color={C.red} style={{ paddingHorizontal: 16, paddingBottom: 6 }}>{error}</T> : null}
          <View style={{ borderTopWidth: 1, borderTopColor: C.slate200, paddingHorizontal: 16, paddingVertical: 12 }}>
            <ChatComposer value={input} onChange={setInput} onSubmit={() => send(input)} sending={sending} />
            <T size={11} color={C.slate400} style={{ textAlign: 'center', marginTop: 8 }}>ClassMate can make mistakes. Check important dates with your syllabus.</T>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
