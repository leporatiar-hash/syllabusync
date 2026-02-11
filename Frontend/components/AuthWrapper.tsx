'use client'

import { AuthProvider } from '../lib/useAuth'
import { PostHogIdentifier } from '../lib/PostHogProvider'

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PostHogIdentifier />
      {children}
    </AuthProvider>
  )
}
