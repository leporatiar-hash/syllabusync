'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useState } from 'react'

interface LibraryTabProps {
  courses: any[]
  studyTools: any[]
  loading: boolean
  onDelete: () => void
}

export default function LibraryTab({ courses, studyTools, loading, onDelete }: LibraryTabProps) {
  const router = useRouter()
  const { fetchWithAuth } = useAuthFetch()
  const [filterCourse, setFilterCourse] = useState('all')
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
    if (tool.type === 'flashcards') {
      router.push(`/flashcards?set=${tool.id}`)
    } else if (tool.type === 'quiz') {
      router.push(`/quizzes/${tool.id}`)
    } else if (tool.type === 'summary') {
      router.push(`/summaries/${tool.id}`)
    }
  }

  // Group tools by course
  const toolsByCourse: Record<string, any[]> = {}
  const filteredTools = filterCourse === 'all'
    ? studyTools
    : studyTools.filter(t => t.course_id === filterCourse)

  filteredTools.forEach((tool) => {
    if (!toolsByCourse[tool.course_id]) {
      toolsByCourse[tool.course_id] = []
    }
    toolsByCourse[tool.course_id].push(tool)
  })

  const getToolIcon = (type: string) => {
    if (type === 'flashcards') {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      )
    }
    if (type === 'quiz') {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    )
  }

  const getToolColor = (type: string) => {
    if (type === 'flashcards') return 'bg-[#8B5CF6]'
    if (type === 'quiz') return 'bg-[#F59E0B]'
    return 'bg-[#5B8DEF]'
  }

  const getActionLabel = (type: string) => {
    if (type === 'flashcards') return 'Study'
    if (type === 'quiz') return 'Start'
    return 'Read'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5B8DEF] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Your Study Tools</h2>
        <select
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all focus:border-[#5B8DEF] focus:outline-none focus:ring-2 focus:ring-[#5B8DEF]/20"
        >
          <option value="all">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code ? `${course.code} - ${course.name}` : course.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tools grouped by course */}
      {Object.keys(toolsByCourse).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No study tools yet. Upload a file in the Create tab to get started!</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(toolsByCourse).map(([courseId, tools]) => {
            const course = courses.find((c) => c.id === courseId)
            if (!course) return null

            return (
              <div key={courseId}>
                {/* Course Header */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5B8DEF] text-xs font-bold text-white">
                    {tools.length}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {course.code ? `${course.code} — ${course.name}` : course.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {tools.length} study {tools.length === 1 ? 'tool' : 'tools'}
                    </p>
                  </div>
                </div>

                {/* Tool Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
                    const isDeleting = deleting === tool.id
                    const createdDate = tool.created_at
                      ? new Date(tool.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : ''

                    return (
                      <div
                        key={tool.id}
                        className="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-200"
                      >
                        {/* Icon */}
                        <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${getToolColor(tool.type)} text-white shadow-sm`}>
                          {getToolIcon(tool.type)}
                        </div>

                        {/* Title & Metadata */}
                        <h4 className="mb-1 text-base font-semibold text-slate-900 line-clamp-2">
                          {tool.name}
                        </h4>
                        <p className="mb-3 text-xs text-slate-500">
                          {tool.metadata} · Created {createdDate}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(tool)}
                            disabled={isDeleting}
                            className="flex-1 rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          >
                            {getActionLabel(tool.type)}
                          </button>
                          <button
                            onClick={() => handleDelete(tool)}
                            disabled={isDeleting}
                            className="px-3 py-2 text-xs text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
                          >
                            {isDeleting ? '...' : 'Delete'}
                          </button>
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
