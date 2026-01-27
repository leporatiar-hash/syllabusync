'use client'

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">Start organizing your semester in minutes.</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <SignUp
            appearance={{
              elements: {
                card: 'shadow-none p-0',
                headerTitle: 'text-slate-900',
                headerSubtitle: 'text-slate-500',
                formButtonPrimary: 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] hover:shadow-md',
                formFieldInput: 'rounded-xl border-slate-200 focus:ring-[#5B8DEF] focus:border-[#5B8DEF]',
                footerActionLink: 'text-[#5B8DEF] hover:text-[#4C7FE6]',
              },
            }}
            redirectUrl="/onboarding"
            signInUrl="/sign-in"
          />
        </div>
      </div>
    </main>
  )
}
