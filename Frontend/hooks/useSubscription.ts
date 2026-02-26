import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { API_URL, useAuthFetch } from './useAuthFetch'

export interface SubscriptionInfo {
  tier: 'free' | 'pro'
  isPro: boolean
  aiGenerationsUsed: number
  aiGenerationsMax: number | null // null = unlimited
  chatMessagesUsed: number
  chatMessagesMax: number | null // null = not available (free) or unlimited (future)
  chatMessagesResetAt: string | null
}

const DEFAULT_SUB: SubscriptionInfo = {
  tier: 'free',
  isPro: false,
  aiGenerationsUsed: 0,
  aiGenerationsMax: 5,
  chatMessagesUsed: 0,
  chatMessagesMax: null,
  chatMessagesResetAt: null,
}

export function useSubscription() {
  const { user } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [sub, setSub] = useState<SubscriptionInfo>(DEFAULT_SUB)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetchWithAuth(`${API_URL}/me/subscription`)
      if (res.ok) {
        const data = await res.json()
        setSub({
          tier: data.tier,
          isPro: data.is_pro,
          aiGenerationsUsed: data.ai_generations_used,
          aiGenerationsMax: data.ai_generations_max,
          chatMessagesUsed: data.chat_messages_used ?? 0,
          chatMessagesMax: data.chat_messages_max ?? null,
          chatMessagesResetAt: data.chat_messages_reset_at ?? null,
        })
      }
    } catch {
      // non-fatal — keep defaults
    } finally {
      setLoading(false)
    }
  }, [user, fetchWithAuth])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canGenerate =
    sub.isPro ||
    (sub.aiGenerationsMax !== null && sub.aiGenerationsUsed < sub.aiGenerationsMax)

  const canChat =
    sub.isPro &&
    (sub.chatMessagesMax === null || sub.chatMessagesUsed < sub.chatMessagesMax)

  return { ...sub, loading, refresh, canGenerate, canChat }
}
