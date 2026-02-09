'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import CreateTab from './CreateTab'
import LibraryTab from './LibraryTab'

export default function StudyStudioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('library')
  const [courses, setCourses] = useState<any[]>([])
  const [studyTools, setStudyTools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [coursesRes, flashcardsRes, quizzesRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/courses`, { cache: 'no-store' }),
        fetchWithAuth(`${API_URL}/flashcard-sets`, { cache: 'no-store' }),
        fetchWithAuth(`${API_URL}/quizzes`, { cache: 'no-store' })
      ])

      if (coursesRes.ok) {
        const coursesData = await coursesRes.json()
        setCourses(coursesData)
      }

      const tools: any[] = []

      if (flashcardsRes.ok) {
        const flashcardsData = await flashcardsRes.json()
        tools.push(...flashcardsData.map((set: any) => ({
          ...set,
          tool_type: 'flashcards',
          type: 'flashcards',
          name: set.name,
          metadata: `${set.card_count || 0} cards`,
          created_at: set.created_at
        })))
      }

      if (quizzesRes.ok) {
        const quizzesData = await quizzesRes.json()
        tools.push(...quizzesData.map((quiz: any) => ({
          ...quiz,
          tool_type: 'quiz',
          type: 'quiz',
          name: quiz.name,
          metadata: `${quiz.question_count || 0} questions`,
          created_at: quiz.created_at
        })))
      }

      setStudyTools(tools)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return null
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-10">
      <div className="mx-auto w-full max-w-[1200px]">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Study Studio</h1>
        <p className="mb-8 text-slate-600">
          Generate flashcards, quizzes, and summaries from your course materials.
        </p>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Library
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'create' ? (
          <CreateTab courses={courses} onSuccess={loadData} />
        ) : (
          <LibraryTab courses={courses} studyTools={studyTools} loading={loading} onDelete={loadData} />
        )}
      </div>
    </main>
  )
}
