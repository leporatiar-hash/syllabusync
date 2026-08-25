'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import posthog from 'posthog-js'
import LibraryTab from '../study-studio/LibraryTab'
import ChatTab from '../study-studio/ChatTab'

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const promptParam = searchParams.get('prompt')
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [activeTab, setActiveTab] = useState<'chat' | 'library'>('chat')
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
    posthog.capture('chat_page_opened')
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const coursesRes = await fetchWithAuth(`${API_URL}/courses`, { cache: 'no-store' })
      if (!coursesRes.ok) {
        setLoading(false)
        return
      }
      const coursesData = await coursesRes.json()
      setCourses(coursesData)

      const tools: any[] = []
      for (const course of coursesData) {
        try {
          const courseRes = await fetchWithAuth(`${API_URL}/courses/${course.id}`, { cache: 'no-store' })
          if (!courseRes.ok) continue
          const courseData = await courseRes.json()

          for (const set of courseData.flashcard_sets || []) {
            tools.push({ ...set, tool_type: 'flashcards', type: 'flashcards', metadata: `${set.card_count || 0} cards`, course_id: course.id })
          }
          for (const quiz of courseData.quizzes || []) {
            tools.push({ ...quiz, tool_type: 'quiz', type: 'quiz', metadata: `${quiz.question_count || 0} questions`, course_id: course.id })
          }
          for (const summary of courseData.summaries || []) {
            tools.push({ ...summary, tool_type: 'summary', type: 'summary', name: summary.title, metadata: 'Summary', course_id: course.id })
          }
        } catch {
          // non-fatal per-course error
        }
      }
      setStudyTools(tools)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) return null

  // Chat fills the full viewport below the sticky global header (h-16 = 64px)
  // edge-to-edge, no page padding/card — Library keeps the normal padded page
  // layout since it's a scrollable grid, not an app surface.
  if (activeTab === 'chat') {
    return (
      <div className="h-[calc(100vh-64px)]">
        <ChatTab
          onViewLibrary={() => setActiveTab('library')}
          triggerProactive={!promptParam}
          initialPrompt={promptParam || undefined}
        />
      </div>
    )
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-6">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('chat')}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to chat
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        </div>
        <LibraryTab courses={courses} studyTools={studyTools} loading={loading} onDelete={loadData} />
      </div>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
