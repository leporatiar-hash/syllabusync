'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'

const schoolTypes = ['High School', 'Community College', 'University', 'Graduate School']
const academicYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD']

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [major, setMajor] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const metadata = user.user_metadata || {}
    setSchoolName((metadata.school_name as string) || '')
    setSchoolType((metadata.school_type as string) || '')
    setAcademicYear((metadata.academic_year as string) || '')
    setMajor((metadata.major as string) || '')
  }, [user])

  if (authLoading || !user) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.auth.updateUser({
        data: {
          school_name: schoolName || undefined,
          school_type: schoolType || undefined,
          academic_year: academicYear || undefined,
          major: major || undefined,
        },
      })
      router.push('/home')
    } catch {
      router.push('/home')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tell us a bit about yourself to personalize your experience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="schoolName" className="mb-1 block text-sm font-medium text-slate-700">
              School / University
            </label>
            <input
              id="schoolName"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              placeholder="e.g. University of Michigan"
            />
          </div>

          <div>
            <label htmlFor="schoolType" className="mb-1 block text-sm font-medium text-slate-700">
              School Type
            </label>
            <select
              id="schoolType"
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            >
              <option value="">Select type...</option>
              {schoolTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="academicYear" className="mb-1 block text-sm font-medium text-slate-700">
              Academic Year
            </label>
            <select
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            >
              <option value="">Select year...</option>
              {academicYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="major" className="mb-1 block text-sm font-medium text-slate-700">
              Major / Field of Study
            </label>
            <input
              id="major"
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              placeholder="e.g. Computer Science"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/home')}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
