import { fetch as streamingFetch } from 'expo/fetch';

import { apiRaw, errorMessage } from './api';
import { API_URL } from './config';
import { getAccessToken } from './tokens';

export class ChatError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * POST a message to /chat/conversations/{id}/messages and stream the SSE reply
 * (`data: {"type": "chunk" | "done" | "error", ...}`), calling onChunk with the text so far.
 */
export async function streamChatMessage(conversationId: string, content: string, onChunk: (soFar: string) => void): Promise<string> {
  const body = new FormData();
  body.append('content', content);
  const post = () =>
    streamingFetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      body,
    });
  let res = await post();
  if (res.status === 401) {
    await apiRaw('/me'); // triggers the shared token refresh
    res = await post();
  }
  if (!res.ok || !res.body) throw new ChatError(await errorMessage(res as unknown as Response), res.status);

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
        onChunk(answer);
      } else if (msg.type === 'error') {
        throw new Error(msg.content);
      }
    }
  }
  return answer;
}
