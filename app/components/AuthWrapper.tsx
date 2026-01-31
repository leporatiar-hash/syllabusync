'use client'

import { AuthProvider } from '../lib/useAuth'

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
