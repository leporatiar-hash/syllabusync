'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { API_BASE_URL } from '../lib/config'

// Tell TypeScript about the global crow object injected by the widget script
declare global {
  interface Window {
    crow?: {
      setIdentityToken: (token: string) => void
    }
  }
}

const CROW_PRODUCT_ID = process.env.NEXT_PUBLIC_CROW_PRODUCT_ID || ''

export default function CrowWidget() {
  const { session } = useAuth()
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    if (!scriptLoaded || !session?.access_token) return

    const identify = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/crow/identity-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const { token } = await res.json()
        if (token && window.crow) {
          window.crow.setIdentityToken(token)
        }
      } catch (err) {
        console.error('[Crow] Failed to set identity token:', err)
      }
    }

    identify()
  }, [scriptLoaded, session?.access_token])

  if (!CROW_PRODUCT_ID) return null

  return (
    <Script
      src="https://api.usecrow.org/static/crow-widget.js"
      data-api-url="https://api.usecrow.org"
      data-product-id={CROW_PRODUCT_ID}
      strategy="lazyOnload"
      onLoad={() => setScriptLoaded(true)}
    />
  )
}
