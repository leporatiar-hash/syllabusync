'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CrowWidget as CrowSDKWidget } from '@usecrow/ui'
import '@usecrow/ui/styles.css'
import { useAuth } from '../lib/useAuth'
import { API_BASE_URL } from '../lib/config'

const CROW_PRODUCT_ID = process.env.NEXT_PUBLIC_CROW_PRODUCT_ID || ''

export default function CrowWidget() {
  const router = useRouter()
  const { session } = useAuth()

  const getIdentityToken = useCallback(async (): Promise<string> => {
    if (!session?.access_token) return ''
    try {
      const res = await fetch(`${API_BASE_URL}/crow/identity-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return ''
      const { token } = await res.json()
      return token || ''
    } catch {
      return ''
    }
  }, [session?.access_token])

  if (!CROW_PRODUCT_ID) return null

  return (
    <CrowSDKWidget
      productId={CROW_PRODUCT_ID}
      apiUrl="https://api.usecrow.org"
      navigate={(path) => router.push(path)}
      getIdentityToken={getIdentityToken}
    />
  )
}
