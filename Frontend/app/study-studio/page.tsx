'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import posthog from 'posthog-js'
import CreateTab from './CreateTab'
import LibraryTab from './LibraryTab'
import ChatTab from './ChatTab'

export default function StudyStudioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [activeTab, setActiveTab] = useState<'create' | 'library' | 'chat'>('library')
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
    posthog.capture('study_studio_opened')
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const coursesRes = await fetchWithAuth(`${API_URL}/courses`, { cache: 'no-store' })

      if (!coursesRes.ok) {
        console.error('Failed to load courses')
        setLoading(false)
        return
      }

      const coursesData = await coursesRes.json()
      setCourses(coursesData)

      // Fetch each course's details to get flashcard sets, quizzes, and summaries
      const tools: any[] = []

      for (const course of coursesData) {
        try {
          const courseRes = await fetchWithAuth(`${API_URL}/courses/${course.id}`, { cache: 'no-store' })
          if (courseRes.ok) {
            const courseData = await courseRes.json()

            // Add flashcard sets
            if (courseData.flashcard_sets) {
              for (const set of courseData.flashcard_sets) {
                tools.push({
                  ...set,
                  tool_type: 'flashcards',
                  type: 'flashcards',
                  name: set.name,
                  metadata: `${set.card_count || 0} cards`,
                  created_at: set.created_at,
                  course_id: course.id
                })
              }
            }

            // Add quizzes
            if (courseData.quizzes) {
              for (const quiz of courseData.quizzes) {
                tools.push({
                  ...quiz,
                  tool_type: 'quiz',
                  type: 'quiz',
                  name: quiz.name,
                  metadata: `${quiz.question_count || 0} questions`,
                  created_at: quiz.created_at,
                  course_id: course.id
                })
              }
            }

            // Add summaries
            if (courseData.summaries) {
              for (const summary of courseData.summaries) {
                tools.push({
                  ...summary,
                  tool_type: 'summary',
                  type: 'summary',
                  name: summary.title,
                  metadata: 'Summary',
                  created_at: summary.created_at,
                  course_id: course.id
                })
              }
            }
          }
        } catch (err) {
          console.error(`Failed to load course ${course.id}:`, err)
        }
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
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chat
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'create' ? (
          <CreateTab courses={courses} onSuccess={loadData} />
        ) : activeTab === 'library' ? (
          <LibraryTab courses={courses} studyTools={studyTools} loading={loading} onDelete={loadData} />
        ) : (
          <ChatTab />
        )}
      </div>
    </main>
  )
}
