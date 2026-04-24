'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import posthog from 'posthog-js'
import CreateTab from '../study-studio/CreateTab'
import LibraryTab from '../study-studio/LibraryTab'
import ChatTab from '../study-studio/ChatTab'

export default function ChatPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [activeTab, setActiveTab] = useState<'chat' | 'library' | 'create'>('chat')
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

  return (
    <main className="min-h-screen px-4 pb-20 pt-10">
      <div className="mx-auto w-full max-w-[1200px]">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Chat</h1>
        <p className="mb-8 text-slate-600">
          Your AI study assistant — ask questions, generate flashcards and quizzes, and stay on top of deadlines.
        </p>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {(['chat', 'library', 'create'] as const).map((tab) => {
            const labels = { chat: 'Chat', library: 'Library', create: 'Create' }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'chat' ? (
          <ChatTab
            onViewLibrary={() => setActiveTab('library')}
            triggerProactive
          />
        ) : activeTab === 'library' ? (
          <LibraryTab courses={courses} studyTools={studyTools} loading={loading} onDelete={loadData} />
        ) : (
          <CreateTab courses={courses} onSuccess={() => { loadData(); setActiveTab('library') }} />
        )}
      </div>
    </main>
  )
}
