import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { API_URL, useAuthFetch } from './useAuthFetch'

export interface SubscriptionInfo {
  tier: 'free' | 'pro' | 'grandfathered'
  isPro: boolean
  aiGenerationsUsed: number
  aiGenerationsMax: number | null // null = unlimited
  coursesUsed: number
  coursesMax: number | null // null = unlimited
}

const DEFAULT_SUB: SubscriptionInfo = {
  tier: 'free',
  isPro: false,
  aiGenerationsUsed: 0,
  aiGenerationsMax: 5,
  coursesUsed: 0,
  coursesMax: 2,
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
          coursesUsed: data.courses_used,
          coursesMax: data.courses_max,
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

  const canCreateCourse =
    sub.isPro || (sub.coursesMax !== null && sub.coursesUsed < sub.coursesMax)
  const canGenerate =
    sub.isPro ||
    (sub.aiGenerationsMax !== null && sub.aiGenerationsUsed < sub.aiGenerationsMax)

  return { ...sub, loading, refresh, canCreateCourse, canGenerate }
}
