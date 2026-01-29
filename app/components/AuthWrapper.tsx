'use client'

import { AuthProvider } from '../context/AuthContext'
import AuthGuard from './AuthGuard'

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        {children}
      </AuthGuard>
    </AuthProvider>
  )
}
