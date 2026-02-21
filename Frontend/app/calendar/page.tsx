'use client'

import { useEffect, useMemo, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, HelpCircle, FileText, Mic, BookMarked, Target, BookOpenCheck, ClipboardList, Clock, PartyPopper, Trash2, Search, X } from 'lucide-react'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useAuth } from '../../lib/useAuth'
import posthog from 'posthog-js'
import { buildCourseColorMap } from '../../lib/courseColors'

interface Deadline {
  id: string
  course_id: string
  course_name: string
  course_code?: string
  date: string
  time?: string
  type: string
  name?: string
  title: string
  description?: string
  completed: boolean
  source?: string
  external_id?: string
}

interface Course {
  id: string
  name: string
  code?: string
}

// API_URL comes from useAuthFetch hook

const typeColors: Record<string, { bg: string; text: string; icon: ReactNode }> = {
  Exam: { bg: 'bg-red-100', text: 'text-red-700', icon: <BookOpen size={12} /> },
  Quiz: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <HelpCircle size={12} /> },
  Assignment: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <FileText size={12} /> },
  Presentation: { bg: 'bg-pink-100', text: 'text-pink-700', icon: <Mic size={12} /> },
  Homework: { bg: 'bg-green-100', text: 'text-green-700', icon: <BookMarked size={12} /> },
  Project: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Target size={12} /> },
  Reading: { bg: 'bg-green-100', text: 'text-green-700', icon: <BookOpenCheck size={12} /> },
  Admin: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <ClipboardList size={12} /> },
  Deadline: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <Clock size={12} /> },
  Class: { bg: 'bg-teal-50', text: 'text-teal-600', icon: <Clock size={12} /> },
}

// Course colors — shared palette, deterministic by course ID (see lib/courseColors.ts)

const viewOptions = ['Month', 'Week', 'Day'] as const
type ViewOption = (typeof viewOptions)[number]

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()

  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterCourse, setFilterCourse] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])
  const [courses, setCourses] = useState<Course[]>([])
  const [view, setView] = useState<ViewOption>('Month')
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null)
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ id: string; from: string; to: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDeadline, setNewDeadline] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    type: 'Deadline',
    description: '',
    course_id: '',
  })
  const [creating, setCreating] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate())

  useEffect(() => {
    if (courses.length > 0 && !newDeadline.course_id) {
      setNewDeadline((prev) => ({ ...prev, course_id: courses[0].id }))
    }
  }, [courses, newDeadline.course_id])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    posthog.capture('deadline_viewed')
    const loadData = async () => {
      setLoading(true)
      try {
        const [deadlinesRes, coursesRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/deadlines`, { cache: 'no-store' }),
          fetchWithAuth(`${API_URL}/courses`, { cache: 'no-store' })
        ])

        if (deadlinesRes.ok) {
          const data = await deadlinesRes.json()
          setDeadlines(data)
        }
        if (coursesRes.ok) {
          const data = await coursesRes.json()
          setCourses(data)
        }
      } catch (err) {
        console.error('Failed to load calendar data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  // Map course IDs to colors (deterministic by ID, shared with Courses page)
  const courseColors = useMemo(() => buildCourseColorMap(courses), [courses])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const formatDateStr = (day: number) => {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${year}-${month}-${dayStr}`
  }

  const filteredDeadlines = useMemo(() => {
    let filtered = deadlines
    if (filterCourse !== 'all') {
      filtered = filtered.filter((d) => d.course_id === filterCourse)
    }
    if (filterType !== 'all') {
      filtered = filtered.filter((d) => d.type === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.course_name?.toLowerCase().includes(q) ||
          d.course_code?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [deadlines, filterCourse, filterType, searchQuery])

  const getDeadlinesForDate = (day: number) => {
    const dateStr = formatDateStr(day)
    return filteredDeadlines.filter((d) => d.date === dateStr)
  }

  const getDeadlineColor = (deadline: Deadline) => {
    return courseColors[deadline.course_id]?.bg || 'bg-slate-400'
  }

  // Extract hex color from Tailwind bg class like 'bg-[#5B8DEF]'
  const getHexColor = (bgClass: string) => {
    const match = bgClass.match(/#[A-Fa-f0-9]+/)
    return match ? match[0] : '#94a3b8'
  }

  const upcomingWeek = useMemo(() => {
    const today = new Date()
    const end = new Date(today)
    end.setDate(today.getDate() + 7)
    return filteredDeadlines
      .filter((d) => {
        const dDate = new Date(d.date)
        return dDate >= today && dDate <= end
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredDeadlines])

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (view === 'Month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (view === 'Week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n') return
      const target = event.target as HTMLElement
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      openCreateModal(todayStr)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [todayStr])

  const openCreateModal = (dateStr: string) => {
    setNewDeadline((prev) => ({
      ...prev,
      date: dateStr,
      title: '',
      time: '',
      type: 'Assignment',
      description: '',
    }))
    setShowCreateModal(true)
  }

  // Get week dates (Sunday to Saturday)
  const getWeekDates = () => {
    const dates: Date[] = []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const formatFullDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDeadlinesForFullDate = (dateStr: string) => {
    return filteredDeadlines.filter((d) => d.date === dateStr)
  }

  const weekDates = getWeekDates()
  const weekRangeLabel = `${weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const dayLabel = currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const toggleComplete = async (deadlineId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}/complete`, {
        method: 'PATCH',
        cache: 'no-store',
      })
      if (res.ok) {
        const updated = await res.json()
        setDeadlines(deadlines.map((d) => (d.id === deadlineId ? { ...d, completed: updated.completed } : d)))
        if (selectedDeadline?.id === deadlineId) {
          setSelectedDeadline({ ...selectedDeadline, completed: updated.completed })
        }
      }
    } catch (err) {
      console.error('Failed to toggle deadline:', err)
    }
  }

  const deleteDeadline = async (deadlineId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (res.ok) {
        setDeadlines(deadlines.filter((d) => d.id !== deadlineId))
        setSelectedDeadline(null)
        setToast('Deadline deleted')
        setTimeout(() => setToast(null), 2500)
      }
    } catch (err) {
      console.error('Failed to delete deadline:', err)
      setToast('Failed to delete deadline')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const reassignCourse = async (deadlineId: string, newCourseId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: newCourseId }),
        cache: 'no-store',
      })
      if (res.ok) {
        const updated = await res.json()
        setDeadlines(deadlines.map((d) =>
          d.id === deadlineId
            ? { ...d, course_id: updated.course_id, course_name: updated.course_name, course_code: updated.course_code }
            : d
        ))
        if (selectedDeadline?.id === deadlineId) {
          setSelectedDeadline({
            ...selectedDeadline,
            course_id: updated.course_id,
            course_name: updated.course_name,
            course_code: updated.course_code,
          })
        }
        setToast('Course updated')
        setTimeout(() => setToast(null), 2500)
      }
    } catch (err) {
      console.error('Failed to reassign course:', err)
      setToast('Failed to update course')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const moveDeadline = async (deadline: Deadline, newDate: string) => {
    if (newDate < todayStr) {
      setToast('Cannot move a deadline into the past.')
      setTimeout(() => setToast(null), 2500)
      return
    }
    if (deadline.date === newDate) return

    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadline.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate }),
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error('Failed to move deadline')
      }
      setDeadlines((prev) =>
        prev.map((d) => (d.id === deadline.id ? { ...d, date: newDate } : d))
      )
      setLastMove({ id: deadline.id, from: deadline.date, to: newDate })
      setToast('Deadline moved. Undo?')
      setTimeout(() => setToast(null), 4000)
    } catch (err) {
      console.error('Failed to move deadline:', err)
      setToast('Failed to move deadline.')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const handleUndoMove = async () => {
    if (!lastMove) return
    const { id, from } = lastMove
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: from }),
        cache: 'no-store',
      })
      if (res.ok) {
        setDeadlines((prev) => prev.map((d) => (d.id === id ? { ...d, date: from } : d)))
      }
    } catch (err) {
      console.error('Failed to undo move:', err)
    } finally {
      setLastMove(null)
      setToast(null)
    }
  }

  const handleCreateDeadline = async () => {
    if (!newDeadline.title.trim() || !newDeadline.date || !newDeadline.course_id) {
      setToast('Title, course, and date are required')
      setTimeout(() => setToast(null), 2500)
      return
    }

    setCreating(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDeadline.title.trim(),
          date: newDeadline.date,
          time: newDeadline.time || null,
          type: newDeadline.type,
          description: newDeadline.description || null,
          course_id: newDeadline.course_id,
        }),
        cache: 'no-store',
      })

      if (!res.ok) throw new Error('Failed to create deadline')

      const created = await res.json()
      setDeadlines((prev) => [...prev, created])
      setShowCreateModal(false)
      setNewDeadline({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        type: 'Deadline',
        description: '',
        course_id: '',
      })
      setToast('Deadline created successfully')
      setTimeout(() => setToast(null), 2500)
    } catch (err) {
      console.error('Failed to create deadline:', err)
      setToast('Failed to create deadline')
      setTimeout(() => setToast(null), 2500)
    } finally {
      setCreating(false)
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen px-2 md:px-4 pb-16 pt-4 md:pt-6 bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
        <div className="mx-auto w-full max-w-[1600px]">
          {/* Skeleton header */}
          <div className="flex items-center justify-between gap-2 md:gap-4 mb-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-9 w-48 rounded-full bg-white/60 shadow-sm animate-pulse" />
              <div className="h-9 w-32 rounded-full bg-white/60 shadow-sm animate-pulse" />
            </div>
            <div className="h-10 w-40 rounded-full bg-white/60 shadow-sm animate-pulse" />
          </div>

          {/* Skeleton navigation */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="h-8 w-48 rounded-full bg-white/40 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-white/40 animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-white/40 animate-pulse" />
            </div>
          </div>

          {/* Skeleton calendar grid */}
          <div className="rounded-2xl bg-white/60 shadow-lg p-4 md:p-6">
            <div className="grid grid-cols-7 gap-0.5 md:gap-2">
              {/* Days header */}
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="p-2 text-center">
                  <div className="h-4 w-8 mx-auto rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
              {/* Calendar cells */}
              {[...Array(35)].map((_, i) => (
                <div key={i} className="min-h-[80px] md:min-h-[120px] rounded-lg border border-slate-100 bg-white p-2">
                  <div className="h-4 w-6 rounded bg-slate-50 animate-pulse mb-2" />
                  <div className="space-y-1">
                    <div className="h-6 rounded bg-slate-50 animate-pulse" />
                    {i % 3 === 0 && <div className="h-6 rounded bg-slate-50 animate-pulse" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loading message */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 shadow-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
              <span className="text-sm font-medium text-slate-600">Loading your schedule...</span>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen px-2 md:px-4 pb-16 pt-4 md:pt-6">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* ── Desktop toolbar ── */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-white p-1 shadow-sm">
              {viewOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setView(option)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                    view === option ? 'bg-[#5B8DEF] text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <select
              value={filterCourse}
              onChange={(event) => setFilterCourse(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 focus:border-[#5B8DEF] focus:outline-none"
            >
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.code} - ${course.name}` : course.name}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 focus:border-[#5B8DEF] focus:outline-none"
            >
              <option value="all">All types</option>
              <option value="Assignment">Assignments</option>
              <option value="Exam">Exams</option>
              <option value="Quiz">Quizzes</option>
              <option value="Homework">Homework</option>
              <option value="Project">Projects</option>
              <option value="Presentation">Presentations</option>
              <option value="Class">Classes</option>
              <option value="Deadline">Deadlines</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deadlines..."
                className="w-[200px] rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:w-[260px] focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="text-lg">+</span>
              <span>New Deadline</span>
            </button>
          </div>
        </div>

        {/* ── Mobile: iOS-style calendar ── */}
        <div className="md:hidden">
          {/* Month header — large bold month, year below */}
          <div className="flex items-start justify-between px-2 pt-2 pb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                {currentDate.toLocaleString('default', { month: 'long' })}
              </h1>
              <p className="text-sm text-slate-400 font-medium">{currentDate.getFullYear()}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={goToToday}
                className="rounded-full px-3 py-1 text-xs font-semibold text-[#5B8DEF] border border-[#5B8DEF]/30 transition-colors hover:bg-[#5B8DEF]/10"
              >
                Today
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5B8DEF] text-white shadow-sm"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          </div>

          {/* Navigation arrows */}
          <div className="flex items-center justify-between px-2 pb-3">
            <button
              onClick={() => navigate('prev')}
              className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button
              onClick={() => navigate('next')}
              className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          {/* Compact weekday headers */}
          <div className="grid grid-cols-7 px-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Compact calendar grid with dots */}
          <div className="grid grid-cols-7 px-1">
            {Array.from({ length: startingDay }).map((_, i) => (
              <div key={`empty-${i}`} className="py-1.5" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = formatDateStr(day)
              const dayDeadlines = getDeadlinesForDate(day)
              const isToday = todayStr === dateStr
              const isSelected = selectedDay === day

              // Collect unique course colors for dots (max 3)
              const dotColors = dayDeadlines
                .reduce<string[]>((acc, d) => {
                  const hex = getHexColor(courseColors[d.course_id]?.bg || 'bg-[#94a3b8]')
                  if (!acc.includes(hex)) acc.push(hex)
                  return acc
                }, [])
                .slice(0, 3)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="flex flex-col items-center py-1.5 transition-colors"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 ${
                      isToday && isSelected
                        ? 'bg-[#5B8DEF] text-white font-semibold'
                        : isToday
                          ? 'bg-[#5B8DEF]/15 text-[#5B8DEF] font-semibold'
                          : isSelected
                            ? 'bg-slate-200/70 text-slate-900 font-semibold'
                            : 'text-slate-700'
                    }`}
                  >
                    {day}
                  </div>
                  {/* Color dots */}
                  <div className="flex items-center gap-[3px] mt-0.5 h-[6px]">
                    {dotColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="h-[5px] w-[5px] rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Events list for selected day */}
          {selectedDay && (() => {
            const dateStr = formatDateStr(selectedDay)
            const dayDeadlines = getDeadlinesForDate(selectedDay)
            const selectedDate = new Date(dateStr + 'T00:00:00')
            const dayLabel = selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })

            return (
              <div className="mt-4 px-1">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-slate-900">{dayLabel}</h2>
                  <span className="text-xs text-slate-400">
                    {dayDeadlines.length} event{dayDeadlines.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {dayDeadlines.length === 0 ? (
                  <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                    <p className="text-sm text-slate-400">No events this day</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayDeadlines.map((deadline) => {
                      const courseColor = courseColors[deadline.course_id]
                      const hex = getHexColor(courseColor?.bg || 'bg-[#94a3b8]')
                      return (
                        <button
                          key={deadline.id}
                          onClick={() => setSelectedDeadline(deadline)}
                          className={`w-full flex items-stretch rounded-xl bg-white shadow-sm transition-all duration-200 active:scale-[0.98] ${
                            deadline.completed ? 'opacity-50' : ''
                          }`}
                        >
                          {/* Left color accent bar */}
                          <div
                            className="w-1 shrink-0 rounded-l-xl"
                            style={{ backgroundColor: hex }}
                          />
                          <div className="flex-1 px-3.5 py-3 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-semibold text-slate-900 ${deadline.completed ? 'line-through' : ''}`}>
                                {deadline.title}
                              </span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${courseColor?.light || 'bg-slate-100'} ${courseColor?.text || 'text-slate-500'}`}>
                                {deadline.type}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              <span>{deadline.course_code || deadline.course_name}</span>
                              {deadline.time && (
                                <>
                                  <span>·</span>
                                  <span>{deadline.time}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Mobile course legend */}
          {courses.length > 0 && (
            <div className="mt-6 px-1">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {courses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white border border-slate-100 px-3 py-1.5 shadow-sm text-xs text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${courseColors[course.id]?.bg || 'bg-slate-400'}`} />
                    <span className="whitespace-nowrap">{course.code || course.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-8 text-sm text-slate-500 hidden md:block">Loading calendar...</div>
        ) : (
          <div className="mt-4 md:mt-8 hidden md:grid gap-8 lg:grid-cols-[4fr_1fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-1">
                <button
                  onClick={() => navigate('prev')}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-all duration-300 hover:border-slate-300"
                >
                  ←
                </button>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={goToToday}
                    className="rounded-full border border-[#5B8DEF] px-4 py-2 text-sm font-semibold text-[#5B8DEF] transition-all duration-300 hover:bg-[#5B8DEF] hover:text-white"
                  >
                    Today
                  </button>
                  <span className="truncate text-xl font-semibold text-slate-900">
                    {view === 'Month' ? monthName : view === 'Week' ? weekRangeLabel : dayLabel}
                  </span>
                </div>
                <button
                  onClick={() => navigate('next')}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-all duration-300 hover:border-slate-300"
                >
                  →
                </button>
              </div>

              {view === 'Month' ? (
                <div className="mt-6">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 border-b border-slate-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center py-3 text-xs font-medium text-slate-600">
                        {day}
                      </div>
                    ))}
                  </div>
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 border-l border-slate-200">
                    {Array.from({ length: startingDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[120px] border-r border-b border-slate-200 bg-slate-50/30" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dateStr = formatDateStr(day)
                      const dayDeadlines = getDeadlinesForDate(day)
                      const isToday = todayStr === dateStr
                      const isWeekend = [0, 6].includes(new Date(dateStr).getDay())
                      const desktopMax = 3

                      return (
                        <div
                          key={day}
                          onDragOver={(event) => {
                            event.preventDefault()
                            setDropTarget(dateStr)
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(event) => {
                            event.preventDefault()
                            setDropTarget(null)
                            const id = event.dataTransfer.getData('text/plain')
                            const deadline = deadlines.find((d) => d.id === id)
                            if (deadline) moveDeadline(deadline, dateStr)
                          }}
                          onClick={() => openCreateModal(dateStr)}
                          className={`group relative min-h-[120px] cursor-pointer border-r border-b border-slate-200 p-3 transition-colors duration-150 hover:bg-slate-50/50 ${
                            isToday ? 'bg-blue-50/30' : isWeekend ? 'bg-slate-50/30' : 'bg-white'
                          } ${
                            dropTarget === dateStr ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="absolute right-2 top-2 text-xs text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">+</div>
                          <div className={`text-sm font-medium mb-1 ${isToday ? 'bg-[#5B8DEF] text-white rounded-full w-7 h-7 flex items-center justify-center' : 'text-slate-700'}`}>
                            {day}
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayDeadlines.slice(0, desktopMax).map((deadline) => {
                              const courseColor = courseColors[deadline.course_id]
                              return (
                                <div
                                  key={deadline.id}
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  onDragStart={(event) => {
                                    setDraggingId(deadline.id)
                                    event.dataTransfer.setData('text/plain', deadline.id)
                                    event.dataTransfer.effectAllowed = 'move'
                                  }}
                                  onDragEnd={() => setDraggingId(null)}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedDeadline(deadline)
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      setSelectedDeadline(deadline)
                                    }
                                  }}
                                  title={`${deadline.title} • ${deadline.course_name}${deadline.time ? ` • ${deadline.time}` : ''}`}
                                  className={`group/badge relative w-full cursor-pointer rounded px-2 py-1 text-left transition-all duration-150 ${
                                    deadline.type === 'Class'
                                      ? `border border-dashed ${courseColor?.border || 'border-slate-300'} bg-white/90`
                                      : (courseColor?.bg || 'bg-slate-400')
                                  } ${deadline.completed ? 'opacity-40' : 'opacity-90 hover:opacity-100'} ${
                                    draggingId === deadline.id ? 'opacity-50' : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`truncate text-[11px] font-medium ${deadline.type === 'Class' ? (courseColor?.text || 'text-slate-600') : 'text-white'} ${deadline.completed ? 'line-through' : ''}`}>
                                      {deadline.title}
                                    </span>
                                    {deadline.time && (
                                      <span className={`text-[9px] shrink-0 ${deadline.type === 'Class' ? 'text-slate-400' : 'text-white/80'}`}>{deadline.time}</span>
                                    )}
                                  </div>
                                  {/* Hover tooltip */}
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-2 hidden min-w-[220px] max-w-xs rounded-xl bg-slate-900 px-3 py-2.5 text-white shadow-2xl group-hover/badge:block before:absolute before:-top-1 before:left-1/2 before:-translate-x-1/2 before:h-2 before:w-2 before:rotate-45 before:bg-slate-900">
                                    <div className="flex items-start gap-2">
                                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${courseColor?.bg || 'bg-slate-400'}`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold leading-tight">{deadline.title}</div>
                                        <div className="mt-1 text-[10px] text-slate-300 leading-tight">{deadline.course_name}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                          <span className="inline-flex items-center gap-1">
                                            {typeColors[deadline.type]?.icon}
                                            {deadline.type}
                                          </span>
                                          {deadline.time && <span>• {deadline.time}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {/* +N more indicator */}
                            {dayDeadlines.length > desktopMax && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedDeadline(dayDeadlines[0])
                                }}
                                className="text-[10px] font-medium text-slate-500 hover:text-[#5B8DEF] transition-colors"
                              >
                                +{dayDeadlines.length - desktopMax}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : view === 'Week' ? (
                <div className="mt-4 md:mt-6">
                  {/* Week grid with header */}
                  <div className="grid grid-cols-7 border-b border-slate-200">
                    {weekDates.map((d) => {
                      const dateStr = formatFullDate(d)
                      const isToday = todayStr === dateStr
                      const dayName = d.toLocaleDateString('default', { weekday: 'short' })
                      const dayNum = d.getDate()

                      return (
                        <div key={dateStr} className="text-center py-3 border-r border-slate-200 last:border-r-0">
                          <div className="text-xs font-medium text-slate-600">{dayName}</div>
                          <div className={`mt-1 text-lg font-semibold ${isToday ? 'bg-[#5B8DEF] text-white rounded-full w-8 h-8 mx-auto flex items-center justify-center' : 'text-slate-900'}`}>
                            {dayNum}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Week day columns */}
                  <div className="grid grid-cols-7">
                    {weekDates.map((d) => {
                      const dateStr = formatFullDate(d)
                      const isToday = todayStr === dateStr
                      const dayDeadlines = getDeadlinesForFullDate(dateStr)
                      return (
                        <div
                          key={dateStr}
                          className={`min-h-[300px] md:min-h-[400px] border-r border-slate-200 last:border-r-0 p-2 md:p-3 transition-colors duration-150 ${
                            isToday ? 'bg-blue-50/20' : 'bg-white hover:bg-slate-50/30'
                          }`}
                        >
                          <div className="space-y-1.5">
                            {dayDeadlines.length === 0 ? (
                              <div className="text-center text-xs text-slate-300 pt-4">—</div>
                            ) : (
                              dayDeadlines.map((deadline) => {
                                const courseColor = courseColors[deadline.course_id]
                                return (
                                  <button
                                    key={deadline.id}
                                    onClick={() => setSelectedDeadline(deadline)}
                                    className={`w-full rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                      deadline.type === 'Class'
                                        ? `border border-dashed ${courseColor?.border || 'border-slate-300'} bg-white/90`
                                        : (courseColor?.bg || 'bg-slate-400')
                                    } ${deadline.completed ? 'opacity-40' : 'opacity-90 hover:opacity-100'}`}
                                  >
                                    <div className={`font-medium truncate text-[10px] md:text-xs ${deadline.type === 'Class' ? (courseColor?.text || 'text-slate-600') : 'text-white'} ${deadline.completed ? 'line-through' : ''}`}>
                                      {deadline.title}
                                    </div>
                                    {deadline.time && (
                                      <div className={`hidden sm:block text-[10px] mt-0.5 ${deadline.type === 'Class' ? 'text-slate-400' : 'text-white/80'}`}>{deadline.time}</div>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* Day View */
                <div className="mt-6">
                  {(() => {
                    const dateStr = formatFullDate(currentDate)
                    const dayDeadlines = getDeadlinesForFullDate(dateStr)
                    const isToday = todayStr === dateStr

                    return (
                      <div className={`min-h-[300px] rounded-2xl border p-6 ${isToday ? 'border-[#5B8DEF] bg-[#F8FAFF]' : 'border-slate-100 bg-white'}`}>
                        {dayDeadlines.length === 0 ? (
                          <div className="flex h-[250px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                            <div className="text-center">
                              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-green-100 text-green-600">
                                <PartyPopper size={24} />
                              </div>
                              <div className="mt-2 text-sm font-semibold text-slate-600">No deadlines today!</div>
                              <div className="mt-1 text-xs text-slate-400">Time to get ahead or take a break.</div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                              {dayDeadlines.length} deadline{dayDeadlines.length !== 1 ? 's' : ''} today
                            </div>
                            {dayDeadlines.map((deadline) => (
                              <button
                                key={deadline.id}
                                onClick={() => setSelectedDeadline(deadline)}
                                className={`w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                                  deadline.completed
                                    ? 'border-slate-100 bg-slate-50 opacity-60'
                                    : deadline.type === 'Class'
                                      ? `border-dashed ${courseColors[deadline.course_id]?.border || 'border-slate-300'} bg-white`
                                      : `border-slate-100 ${courseColors[deadline.course_id]?.light || 'bg-white'}`
                                }`}
                              >
                                <div className={`mt-1 h-4 w-4 rounded-full ${getDeadlineColor(deadline)}`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`font-semibold text-slate-900 ${deadline.completed ? 'line-through' : ''}`}>
                                    {deadline.title}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className={`rounded-full px-2 py-0.5 ${courseColors[deadline.course_id]?.light || 'bg-slate-100'} ${courseColors[deadline.course_id]?.text || 'text-slate-600'}`}>
                                      {deadline.type}
                                    </span>
                                    <span>{deadline.course_code || deadline.course_name || 'No course'}</span>
                                    {deadline.source && deadline.source !== 'manual' && (
                                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                                        {deadline.source === 'canvas' ? 'Canvas' : 'iCal'}
                                      </span>
                                    )}
                                    {deadline.time && <span className="font-semibold">{deadline.time}</span>}
                                  </div>
                                  {deadline.description && (
                                    <div className="mt-2 text-sm text-slate-600 line-clamp-2">{deadline.description}</div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleComplete(deadline.id)
                                  }}
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-300 ${
                                    deadline.completed
                                      ? 'border-[#4ADE80] text-[#4ADE80]'
                                      : 'border-slate-200 text-slate-500 hover:border-[#4ADE80] hover:text-[#4ADE80]'
                                  }`}
                                >
                                  {deadline.completed ? 'Done' : 'Complete'}
                                </button>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <aside>
              {/* Desktop sidebar */}
              <div className="hidden lg:flex lg:flex-col lg:gap-6">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Upcoming this week</h3>
                  <div className="mt-4 space-y-3">
                    {upcomingWeek.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        Nothing coming up.
                      </div>
                    ) : (
                      upcomingWeek.slice(0, 6).map((deadline) => (
                        <button
                          key={deadline.id}
                          onClick={() => setSelectedDeadline(deadline)}
                          className="w-full text-left rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{deadline.date}</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${courseColors[deadline.course_id]?.light || 'bg-slate-100'} ${courseColors[deadline.course_id]?.text || 'text-slate-500'}`}>
                              {deadline.type}
                            </span>
                          </div>
                          <div className={`mt-1 text-sm font-semibold text-slate-900 ${deadline.completed ? 'line-through opacity-60' : ''}`}>
                            {deadline.title}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span>{deadline.course_code || deadline.course_name || 'No course'}</span>
                            {deadline.source && deadline.source !== 'manual' && (
                              <span className="rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold text-indigo-600">
                                {deadline.source === 'canvas' ? 'Canvas' : 'iCal'}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Course Legend */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Courses
                  </h4>
                  <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {courses.length === 0 ? (
                      <div className="text-xs text-slate-400">No courses yet.</div>
                    ) : (
                      courses.map((course) => (
                        <Link
                          key={course.id}
                          href={`/courses/${course.id}`}
                          className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <span className={`h-3 w-3 rounded-full ${courseColors[course.id]?.bg || 'bg-slate-400'}`} />
                          <span className="truncate">{course.code ? `${course.code} - ${course.name}` : course.name}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed right-6 top-24 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg border border-slate-100">
            {toast}
            {lastMove && toast.includes('Undo') && (
              <button onClick={handleUndoMove} className="ml-2 underline">
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deadline Detail Modal */}
      {selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur" onClick={() => setSelectedDeadline(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${courseColors[selectedDeadline.course_id]?.light || 'bg-slate-100'} ${courseColors[selectedDeadline.course_id]?.text || 'text-slate-600'}`}>
                  {selectedDeadline.type}
                </span>
                <h2 className={`mt-3 text-xl font-semibold text-slate-900 ${selectedDeadline.completed ? 'line-through' : ''}`}>
                  {selectedDeadline.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDeadline(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className="text-slate-400">Course:</span>
                <select
                  value={selectedDeadline.course_id || ''}
                  onChange={(e) => {
                    if (e.target.value) reassignCourse(selectedDeadline.id, e.target.value)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition-colors focus:border-[#5B8DEF] focus:ring-1 focus:ring-[#5B8DEF]/20"
                >
                  <option value="">No course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} - ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
                {selectedDeadline.source && selectedDeadline.source !== 'manual' && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                    {selectedDeadline.source === 'canvas' ? 'Canvas' : 'iCal'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className="text-slate-400">Date:</span>
                <span>{selectedDeadline.date}</span>
                {selectedDeadline.time && <span className="text-slate-400">at {selectedDeadline.time}</span>}
              </div>
              {selectedDeadline.description && (
                <div className="text-sm text-slate-600">
                  <span className="text-slate-400">Details:</span>
                  <p className="mt-1">{selectedDeadline.description}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDeadline.completed}
                  onChange={() => toggleComplete(selectedDeadline.id)}
                  className="h-4 w-4 rounded border-slate-300 text-[#5B8DEF]"
                />
                Mark as complete
              </label>
              <button
                onClick={() => deleteDeadline(selectedDeadline.id)}
                className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-all duration-300 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Deadline Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">New Deadline</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
                  placeholder="e.g., Midterm Exam, Assignment 3"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Date * ({new Date(newDeadline.date).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })})
                  </label>
                  <input
                    type="date"
                    value={newDeadline.date}
                    onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Time</label>
                  <input
                    type="time"
                    value={newDeadline.time}
                    onChange={(e) => setNewDeadline({ ...newDeadline, time: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Type</label>
                  <select
                    value={newDeadline.type}
                    onChange={(e) => setNewDeadline({ ...newDeadline, type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  >
                    <option value="Deadline">Deadline</option>
                    <option value="Exam">Exam</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Project">Project</option>
                    <option value="Homework">Homework</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Admin">Admin</option>
                    <option value="Class">Class</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Course *</label>
                  <select
                    value={newDeadline.course_id}
                    onChange={(e) => setNewDeadline({ ...newDeadline, course_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code ? `${course.code} - ${course.name}` : course.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={newDeadline.description}
                  onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })}
                  placeholder="Optional notes..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleCreateDeadline}
              disabled={creating || !newDeadline.title.trim() || !newDeadline.date}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Deadline'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
