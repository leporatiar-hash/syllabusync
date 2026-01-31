'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
      Redirecting to login...
    </div>
  )
}
