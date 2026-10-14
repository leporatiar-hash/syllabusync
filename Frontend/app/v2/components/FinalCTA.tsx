'use client'

import { useRouter } from 'next/navigation'
import { BRAND } from './tokens'

export default function FinalCTA() {
  const router = useRouter()

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl px-10 py-16 text-center text-white" style={{ background: BRAND }}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Your whole semester, in one calendar.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <button
              onClick={() => router.push('/signup')}
              className="px-10 py-4 text-base font-semibold bg-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              style={{ color: BRAND }}
            >
              Start free
            </button>
          </div>
          <p className="mt-6 text-sm opacity-70">No credit card · Connect your school in about 2 minutes</p>
        </div>
      </div>
    </section>
  )
}
