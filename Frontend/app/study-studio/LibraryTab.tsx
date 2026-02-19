'use client'

import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useMemo, useState } from 'react'

interface LibraryTabProps {
  courses: any[]
  studyTools: any[]
  loading: boolean
  onDelete: () => void
}

type TypeFilter = 'all' | 'flashcards' | 'quiz' | 'summary'

// Blue-family color system
const typeStyles = {
  flashcards: {
    btn: 'bg-[#3b82f6]',
    btnHover: 'hover:bg-[#2563eb] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)]',
    bg: 'bg-[#eff6ff]',
    border: 'border-[#bfdbfe]',
    text: 'text-[#2563eb]',
    gradient: 'from-[#2563eb] to-[#60a5fa]',
    iconBg: 'bg-[#eff6ff] text-[#2563eb]',
    statBg: 'bg-[#eff6ff]',
    statIcon: 'bg-[#3b82f6]',
  },
  quiz: {
    btn: 'bg-[#0ea5e9]',
    btnHover: 'hover:bg-[#0369a1] hover:shadow-[0_4px_12px_rgba(14,165,233,0.4)]',
    bg: 'bg-[#f0f9ff]',
    border: 'border-[#bae6fd]',
    text: 'text-[#0369a1]',
    gradient: 'from-[#0369a1] to-[#38bdf8]',
    iconBg: 'bg-[#f0f9ff] text-[#0369a1]',
    statBg: 'bg-[#f0f9ff]',
    statIcon: 'bg-[#0ea5e9]',
  },
  summary: {
    btn: 'bg-[#6366f1]',
    btnHover: 'hover:bg-[#4338ca] hover:shadow-[0_4px_12px_rgba(99,102,241,0.4)]',
    bg: 'bg-[#eef2ff]',
    border: 'border-[#c7d2fe]',
    text: 'text-[#4338ca]',
    gradient: 'from-[#4338ca] to-[#818cf8]',
    iconBg: 'bg-[#eef2ff] text-[#4338ca]',
    statBg: 'bg-[#eef2ff]',
    statIcon: 'bg-[#6366f1]',
  },
}

export default function LibraryTab({ courses, studyTools, loading, onDelete }: LibraryTabProps) {
  const router = useRouter()
  const { fetchWithAuth } = useAuthFetch()
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterType, setFilterType] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (tool: any) => {
    if (!confirm(`Delete this ${tool.type}?`)) return

    setDeleting(tool.id)
    try {
      const endpoint = tool.type === 'flashcards'
        ? `${API_URL}/flashcard-sets/${tool.id}`
        : tool.type === 'summary'
        ? `${API_URL}/summaries/${tool.id}`
        : `${API_URL}/quizzes/${tool.id}`

      const res = await fetchWithAuth(endpoint, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      onDelete()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(null)
    }
  }

  const handleAction = (tool: any) => {
    posthog.capture('study_set_opened', { type: tool.type, set_id: tool.id })
    if (tool.type === 'flashcards') {
      router.push(`/flashcards?set=${tool.id}`)
    } else if (tool.type === 'quiz') {
      router.push(`/quizzes/${tool.id}`)
    } else if (tool.type === 'summary') {
      router.push(`/summaries/${tool.id}`)
    }
  }

  // Counts
  const counts = useMemo(() => {
    const c = { flashcards: 0, quiz: 0, summary: 0 }
    studyTools.forEach((t) => {
      if (t.type === 'flashcards') c.flashcards++
      else if (t.type === 'quiz') c.quiz++
      else if (t.type === 'summary') c.summary++
    })
    return c
  }, [studyTools])

  // Filter tools
  const filteredTools = useMemo(() => {
    let tools = studyTools
    if (filterCourse !== 'all') tools = tools.filter(t => t.course_id === filterCourse)
    if (filterType !== 'all') tools = tools.filter(t => t.type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      tools = tools.filter(t => t.name?.toLowerCase().includes(q))
    }
    return tools
  }, [studyTools, filterCourse, filterType, search])

  // Group by course
  const toolsByCourse: Record<string, any[]> = {}
  filteredTools.forEach((tool) => {
    if (!toolsByCourse[tool.course_id]) {
      toolsByCourse[tool.course_id] = []
    }
    toolsByCourse[tool.course_id].push(tool)
  })

  const getStyle = (type: string) => {
    if (type === 'flashcards') return typeStyles.flashcards
    if (type === 'quiz') return typeStyles.quiz
    return typeStyles.summary
  }

  const getToolIcon = (type: string) => {
    if (type === 'flashcards') {
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      )
    }
    if (type === 'quiz') {
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    )
  }

  const getToolBadge = (type: string) => {
    if (type === 'flashcards') return 'Flashcards'
    if (type === 'quiz') return 'Quiz'
    return 'Summary'
  }

  const getActionLabel = (type: string) => {
    if (type === 'flashcards') return 'Study'
    if (type === 'quiz') return 'Start'
    return 'Read'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton stats */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[14px] bg-slate-100" />
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-[14px] bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[14px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${typeStyles.flashcards.statIcon} text-white`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.flashcards}</p>
              <p className="text-xs text-slate-500">Flashcard Sets</p>
            </div>
          </div>
        </div>
        <div className="rounded-[14px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${typeStyles.quiz.statIcon} text-white`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.quiz}</p>
              <p className="text-xs text-slate-500">Quizzes</p>
            </div>
          </div>
        </div>
        <div className="rounded-[14px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${typeStyles.summary.statIcon} text-white`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.summary}</p>
              <p className="text-xs text-slate-500">Summaries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search study tools..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter pills */}
          {(['all', 'flashcards', 'quiz', 'summary'] as TypeFilter[]).map((type) => {
            const isActive = filterType === type
            const labels: Record<TypeFilter, string> = { all: 'All Types', flashcards: 'Flashcards', quiz: 'Quizzes', summary: 'Summaries' }
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#3b82f6] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {labels[type]}
              </button>
            )
          })}

          {/* Course filter */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="ml-auto rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
          >
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code ? `${course.code} - ${course.name}` : course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tools grouped by course */}
      {Object.keys(toolsByCourse).length === 0 ? (
        <div className="rounded-[14px] border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff]">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#3b82f6]" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">
            {search || filterType !== 'all' || filterCourse !== 'all' ? 'No results found' : 'No study tools yet'}
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
            {search || filterType !== 'all' || filterCourse !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Upload a file in the Create tab to generate flashcards, quizzes, and summaries.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(toolsByCourse).map(([courseId, tools]) => {
            const course = courses.find((c) => c.id === courseId)
            if (!course) return null

            return (
              <div key={courseId}>
                {/* Course Header */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-6 min-w-[24px] items-center justify-center rounded-md bg-[#eff6ff] px-1.5 text-[11px] font-bold text-[#3b82f6]">
                    {tools.length}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    {course.code ? `${course.code} — ${course.name}` : course.name}
                  </h3>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Tool Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
                    const isDeleting = deleting === tool.id
                    const createdDate = tool.created_at
                      ? new Date(tool.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : ''
                    const style = getStyle(tool.type)

                    return (
                      <div
                        key={tool.id}
                        className={`group relative overflow-hidden rounded-[14px] border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${style.border} shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]`}
                      >
                        {/* 3px gradient top border */}
                        <div className={`h-[3px] w-full bg-gradient-to-r ${style.gradient}`} />

                        <div className="p-5">
                          {/* Top row: icon + badge */}
                          <div className="mb-3 flex items-start justify-between">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${style.iconBg}`}>
                              {getToolIcon(tool.type)}
                            </div>
                            <span className={`rounded-full ${style.bg} ${style.border} border ${style.text} px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]`}>
                              {getToolBadge(tool.type)}
                            </span>
                          </div>

                          {/* Title */}
                          <h4 className="mb-1 text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                            {tool.name}
                          </h4>

                          {/* Metadata */}
                          <p className="mb-4 text-xs text-slate-400">
                            {tool.metadata} · {createdDate}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAction(tool)}
                              disabled={isDeleting}
                              className={`flex-1 rounded-[9px] ${style.btn} px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ${style.btnHover} disabled:opacity-50`}
                            >
                              {getActionLabel(tool.type)}
                            </button>
                            <button
                              onClick={() => handleDelete(tool)}
                              disabled={isDeleting}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all duration-200 hover:border-red-300 hover:bg-[#fff1f2] hover:text-red-500 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
