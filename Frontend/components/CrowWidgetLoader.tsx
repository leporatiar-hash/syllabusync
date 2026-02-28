'use client'

import dynamic from 'next/dynamic'

// Crow SDK references window — load client-side only, never on the server
const CrowWidget = dynamic(() => import('./CrowWidget'), { ssr: false })

export default function CrowWidgetLoader() {
  return <CrowWidget />
}
