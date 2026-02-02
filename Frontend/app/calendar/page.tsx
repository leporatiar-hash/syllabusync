'use client'

import { useEffect, useMemo, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, HelpCircle, FileText, Mic, BookMarked, Target, BookOpenCheck, ClipboardList, Clock, PartyPopper } from 'lucide-react'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useAuth } from '../../lib/useAuth'

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
}

// Course colors - auto-assigned based on index
const courseColorPalette = [
  { bg: 'bg-[#5B8DEF]', text: 'text-[#5B8DEF]', light: 'bg-[#E0EAFF]', border: 'border-[#5B8DEF]' },
  { bg: 'bg-[#A78BFA]', text: 'text-[#A78BFA]', light: 'bg-[#F3E8FF]', border: 'border-[#A78BFA]' },
  { bg: 'bg-[#FB7185]', text: 'text-[#FB7185]', light: 'bg-[#FEE2E2]', border: 'border-[#FB7185]' },
  { bg: 'bg-[#4ADE80]', text: 'text-[#4ADE80]', light: 'bg-[#DCFCE7]', border: 'border-[#4ADE80]' },
  { bg: 'bg-[#FB923C]', text: 'text-[#FB923C]', light: 'bg-[#FFEDD5]', border: 'border-[#FB923C]' },
  { bg: 'bg-[#38BDF8]', text: 'text-[#38BDF8]', light: 'bg-[#E0F2FE]', border: 'border-[#38BDF8]' },
]

const viewOptions = ['Month', 'Week', 'Day'] as const
type ViewOption = (typeof viewOptions)[number]

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()

  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterCourse, setFilterCourse] = useState<string>('all')

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

  // Map course IDs to colors
  const courseColors = useMemo(() => {
    const map: Record<string, typeof courseColorPalette[0]> = {}
    courses.forEach((course, i) => {
      map[course.id] = courseColorPalette[i % courseColorPalette.length]
    })
    return map
  }, [courses])

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
    if (filterCourse === 'all') return deadlines
    return deadlines.filter((d) => d.course_id === filterCourse)
  }, [deadlines, filterCourse])

  const getDeadlinesForDate = (day: number) => {
    const dateStr = formatDateStr(day)
    return filteredDeadlines.filter((d) => d.date === dateStr)
  }

  const getDeadlineColor = (deadline: Deadline) => {
    return courseColors[deadline.course_id]?.bg || 'bg-slate-400'
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

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="text-lg">+</span>
            <span>New Deadline</span>
          </button>
        </div>

        {loading ? (
          <div className="mt-8 text-sm text-slate-500">Loading calendar...</div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[4fr_1fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigate('prev')}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-all duration-300 hover:border-slate-300"
                >
                  ← Prev
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={goToToday}
                    className="rounded-full border border-[#5B8DEF] px-4 py-2 text-sm font-semibold text-[#5B8DEF] transition-all duration-300 hover:bg-[#5B8DEF] hover:text-white"
                  >
                    Today
                  </button>
                  <span className="text-xl font-semibold text-slate-900">
                    {view === 'Month' ? monthName : view === 'Week' ? weekRangeLabel : dayLabel}
                  </span>
                </div>
                <button
                  onClick={() => navigate('next')}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-all duration-300 hover:border-slate-300"
                >
                  Next →
                </button>
              </div>

              {view === 'Month' ? (
                <div className="mt-6">
                  <div className="grid grid-cols-7 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-2">
                    {Array.from({ length: startingDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[100px] rounded-xl bg-slate-50" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dateStr = formatDateStr(day)
                      const dayDeadlines = getDeadlinesForDate(day)
                      const isToday = todayStr === dateStr
                      const isWeekend = [0, 6].includes(new Date(dateStr).getDay())

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
                          className={`group relative min-h-[100px] cursor-pointer rounded-xl border border-slate-100 p-2 transition-all duration-300 hover:shadow-md ${
                            isToday ? 'ring-2 ring-[#5B8DEF]/40' : ''
                          } ${isWeekend ? 'bg-slate-50' : 'bg-white'} ${
                            dropTarget === dateStr ? 'border-[#5B8DEF] ring-2 ring-[#5B8DEF]/20' : ''
                          }`}
                        >
                          <div className="absolute right-2 top-2 text-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">+</div>
                          <div className={`text-sm ${isToday ? 'font-semibold text-[#5B8DEF]' : 'text-slate-400'}`}>
                            {day}
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayDeadlines.slice(0, 3).map((deadline) => {
                              const color = typeColors[deadline.type] || typeColors.Deadline
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
                                  className={`group/badge relative w-full cursor-pointer rounded-lg border-l-2 px-2 py-1 text-left ${color.bg} ${courseColor?.border || 'border-slate-300'} shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                    deadline.completed ? 'opacity-50' : ''
                                  } ${draggingId === deadline.id ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={color.text}>{color.icon}</span>
                                    <span className={`truncate text-[11px] font-medium ${color.text} ${deadline.completed ? 'line-through' : ''}`}>
                                      {deadline.title}
                                    </span>
                                  </div>
                                  {deadline.time && (
                                    <div className="text-[9px] text-slate-400 ml-4">{deadline.time}</div>
                                  )}
                                  {/* Hover tooltip */}
                                  <div className="absolute left-0 top-full z-30 mt-1 hidden w-52 rounded-lg bg-slate-900 p-2.5 text-white shadow-xl group-hover/badge:block">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`h-2.5 w-2.5 rounded-full ${courseColor?.bg || 'bg-slate-400'}`} />
                                      <span className="text-[11px] font-semibold">{deadline.title}</span>
                                    </div>
                                    <div className="mt-1.5 text-[10px] text-slate-300">{deadline.course_name}</div>
                                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                      <span>{deadline.type}</span>
                                      {deadline.time && <span>• {deadline.time}</span>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {dayDeadlines.length > 3 && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedDeadline(dayDeadlines[0])
                                }}
                                className="text-[10px] text-slate-400 hover:text-[#5B8DEF] transition-colors"
                              >
                                +{dayDeadlines.length - 3} more
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : view === 'Week' ? (
                /* Week View */
                <div className="mt-6">
                  <div className="grid grid-cols-7 gap-2">
                    {weekDates.map((d) => {
                      const dateStr = formatFullDate(d)
                      const isToday = todayStr === dateStr
                      const dayDeadlines = getDeadlinesForFullDate(dateStr)
                      const dayName = d.toLocaleDateString('default', { weekday: 'short' })
                      const dayNum = d.getDate()

                      return (
                        <div
                          key={dateStr}
                          className={`min-h-[200px] rounded-2xl border p-3 transition-all duration-300 ${
                            isToday ? 'border-[#5B8DEF] bg-[#F8FAFF] ring-2 ring-[#5B8DEF]/20' : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{dayName}</div>
                            <div className={`mt-1 text-lg font-semibold ${isToday ? 'text-[#5B8DEF]' : 'text-slate-700'}`}>
                              {dayNum}
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {dayDeadlines.length === 0 ? (
                              <div className="text-center text-xs text-slate-300">—</div>
                            ) : (
                              dayDeadlines.slice(0, 4).map((deadline) => (
                                <button
                                  key={deadline.id}
                                  onClick={() => setSelectedDeadline(deadline)}
                                  className={`w-full rounded-xl px-2 py-1.5 text-left text-xs transition-all duration-200 hover:scale-[1.02] ${
                                    courseColors[deadline.course_id]?.light || 'bg-slate-100'
                                  } ${deadline.completed ? 'opacity-50' : ''}`}
                                >
                                  <div className={`font-semibold text-slate-700 truncate ${deadline.completed ? 'line-through' : ''}`}>
                                    {deadline.title}
                                  </div>
                                  {deadline.time && <div className="text-[10px] text-slate-500">{deadline.time}</div>}
                                </button>
                              ))
                            )}
                            {dayDeadlines.length > 4 && (
                              <div className="text-center text-[10px] text-slate-400">+{dayDeadlines.length - 4} more</div>
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
                                  deadline.completed ? 'border-slate-100 bg-slate-50 opacity-60' : `border-slate-100 ${courseColors[deadline.course_id]?.light || 'bg-white'}`
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
                                    <span>{deadline.course_code || deadline.course_name}</span>
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

            <aside className="space-y-6">
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
                        <div className="text-xs text-slate-500">
                          {deadline.course_code ? `${deadline.course_code}` : deadline.course_name}
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
                <Link href={`/courses/${selectedDeadline.course_id}`} className="text-[#5B8DEF] hover:underline">
                  {selectedDeadline.course_code ? `${selectedDeadline.course_code} - ${selectedDeadline.course_name}` : selectedDeadline.course_name}
                </Link>
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

            <div className="mt-6 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDeadline.completed}
                  onChange={() => toggleComplete(selectedDeadline.id)}
                  className="h-4 w-4 rounded border-slate-300 text-[#5B8DEF]"
                />
                Mark as complete
              </label>
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
