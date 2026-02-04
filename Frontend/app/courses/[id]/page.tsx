'use client'

import { useCallback, useEffect, useRef, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, HelpCircle, FileText, FolderOpen, BookOpenCheck, ClipboardList, Clock, Calendar, Check, File, BookMarked, Layers, Upload, Sparkles, GraduationCap, Info, User, Scale, BarChart3, BookCopy, Pencil, Save, X } from 'lucide-react'
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch'
import { useAuth } from '../../../lib/useAuth'

interface Deadline {
  id: string
  date: string
  time?: string
  type: string
  title: string
  description?: string
  context?: string
  completed?: boolean
  saved_to_calendar?: boolean
}

interface FlashcardSet {
  id: string
  name: string
  card_count: number
  progress?: number
}

interface Summary {
  id: string
  title: string
  content: string
  created_at: string
}

interface CourseInfo {
  instructor?: {
    name?: string | null
    email?: string | null
    office?: string | null
    office_hours?: string | null
    phone?: string | null
  }
  logistics?: {
    meeting_times?: string | null
    location?: string | null
    attendance_policy?: string | null
    late_work_policy?: string | null
  }
  grade_breakdown?: { component: string; weight: string }[]
  policies?: {
    participation?: string | null
    extra_credit?: string | null
    academic_integrity?: string | null
    prerequisites?: string | null
  }
  materials?: {
    required_textbooks?: string[]
    recommended_readings?: string[]
    course_portal?: string | null
    ta_info?: string | null
  }
}

interface CourseDetail {
  id: string
  name: string
  code?: string
  semester: string
  deadline_count?: number
  course_info?: CourseInfo | null
  deadlines?: Deadline[]
  flashcard_sets?: FlashcardSet[]
  summaries?: Summary[]
}

const typeStyles: Record<string, { badge: string; date: string; icon: ReactNode }> = {
  Exam: { badge: 'bg-[#FEE2E2] text-[#FB7185]', date: 'bg-[#FFF1F2] text-[#FB7185]', icon: <BookOpen size={10} className="text-white" /> },
  Quiz: { badge: 'bg-[#FFEDD5] text-[#FB923C]', date: 'bg-[#FFF7ED] text-[#FB923C]', icon: <HelpCircle size={10} className="text-white" /> },
  Assignment: { badge: 'bg-[#DBEAFE] text-[#38BDF8]', date: 'bg-[#E0F2FE] text-[#38BDF8]', icon: <FileText size={10} className="text-white" /> },
  Project: { badge: 'bg-[#E9D5FF] text-[#A78BFA]', date: 'bg-[#F3E8FF] text-[#A78BFA]', icon: <FolderOpen size={10} className="text-white" /> },
  Reading: { badge: 'bg-[#DCFCE7] text-[#4ADE80]', date: 'bg-[#ECFDF3] text-[#4ADE80]', icon: <BookOpenCheck size={10} className="text-white" /> },
  Admin: { badge: 'bg-slate-100 text-slate-600', date: 'bg-slate-50 text-slate-500', icon: <ClipboardList size={10} className="text-white" /> },
  Deadline: { badge: 'bg-slate-100 text-slate-600', date: 'bg-slate-50 text-slate-500', icon: <Clock size={10} className="text-white" /> },
}

export default function CourseDetailPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
    // Class Schedule State
    const [classSchedule, setClassSchedule] = useState<Array<{ day: string; start: string; end: string }>>([])
    const [editingSchedule, setEditingSchedule] = useState(false)
    const [selectedDays, setSelectedDays] = useState<string[]>([])
    const [scheduleTime, setScheduleTime] = useState({ start: '', end: '' })
  const params = useParams()
  const courseId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
  const [syllabusLoading, setSyllabusLoading] = useState(false)
  const [syllabusSuccess, setSyllabusSuccess] = useState(false)
  const [syllabusError, setSyllabusError] = useState<string | null>(null)
  const [studyFile, setStudyFile] = useState<File | null>(null)
  const [flashcardLoading, setFlashcardLoading] = useState(false)
  const [flashcardSuccess, setFlashcardSuccess] = useState(false)
  const [flashcardError, setFlashcardError] = useState<string | null>(null)
  const [savingToCalendar, setSavingToCalendar] = useState<string | null>(null)
  const [calendarToast, setCalendarToast] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [mainTab, setMainTab] = useState<'deadlines' | 'study' | 'info'>('deadlines')
  const [deadlineTab, setDeadlineTab] = useState<'unsaved' | 'saved'>('unsaved')
  const [deadlineTabTouched, setDeadlineTabTouched] = useState(false)
  const [generateFlashcards, setGenerateFlashcards] = useState(true)
  const [generateQuiz, setGenerateQuiz] = useState(true)
  const [generateSummary, setGenerateSummary] = useState(true)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editedInfo, setEditedInfo] = useState<CourseInfo | null>(null)
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoToast, setInfoToast] = useState<string | null>(null)

  const syllabusInputRef = useRef<HTMLInputElement>(null)
  const studyInputRef = useRef<HTMLInputElement>(null)

  // Computed values
  const unsavedDeadlines = deadlines.filter(d => !d.saved_to_calendar)
  const savedDeadlines = deadlines.filter(d => d.saved_to_calendar)
  const unsavedCount = unsavedDeadlines.length
  const savedCount = savedDeadlines.length
  const remainingCount = deadlines.filter(d => !d.completed).length

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const loadCourse = useCallback(async () => {
    if (!courseId) return
    try {
      const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Failed to load course')
      }
      const data = await res.json()
      setCourse(data)
      setDeadlines(data.deadlines || [])
    } catch (err) {
      console.error('Failed to load course:', err)
    }
  }, [courseId])

  useEffect(() => {
    if (!user || !courseId) return
    loadCourse()
  }, [user, courseId, loadCourse])

  const removeFromCalendar = async (deadlineId: string) => {
    setSavingToCalendar(deadlineId)
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}/save-to-calendar`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (res.ok) {
        setDeadlines(deadlines.map((d) => (d.id === deadlineId ? { ...d, saved_to_calendar: false } : d)))
        setCalendarToast('Removed from calendar')
        setTimeout(() => setCalendarToast(null), 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to remove')
      }
    } catch (err) {
      console.error('Failed to remove from calendar:', err)
      setCalendarToast(err instanceof Error ? err.message : 'Failed to remove')
      setTimeout(() => setCalendarToast(null), 2000)
    } finally {
      setSavingToCalendar(null)
    }
  }

  const saveToCalendar = async (deadlineId: string) => {
    setSavingToCalendar(deadlineId)
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}/save-to-calendar`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (res.ok) {
        setDeadlines(deadlines.map((d) => (d.id === deadlineId ? { ...d, saved_to_calendar: true } : d)))
        setCalendarToast('Saved to calendar')
        setTimeout(() => setCalendarToast(null), 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to save')
      }
    } catch (err) {
      console.error('Failed to save to calendar:', err)
      setCalendarToast(err instanceof Error ? err.message : 'Failed to save')
      setTimeout(() => setCalendarToast(null), 2000)
    } finally {
      setSavingToCalendar(null)
    }
  }

  const saveAllToCalendar = async () => {
    const unsaved = deadlines.filter(d => !d.saved_to_calendar)
    if (unsaved.length === 0) return

    setBulkSaving(true)
    try {
      for (const deadline of unsaved) {
        const res = await fetchWithAuth(`${API_URL}/deadlines/${deadline.id}/save-to-calendar`, {
          method: 'POST',
          cache: 'no-store',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to save some deadlines')
        }
      }
      setDeadlines(deadlines.map(d => ({ ...d, saved_to_calendar: true })))
      setCalendarToast(`Saved ${unsaved.length} deadlines to calendar!`)
      setTimeout(() => setCalendarToast(null), 3000)
    } catch (err) {
      console.error('Failed to save all:', err)
      setCalendarToast('Failed to save some deadlines')
      setTimeout(() => setCalendarToast(null), 2000)
    } finally {
      setBulkSaving(false)
    }
  }

  const toggleComplete = async (deadlineId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/deadlines/${deadlineId}/complete`, {
        method: 'PATCH',
        cache: 'no-store',
      })
      if (res.ok) {
        const updated = await res.json()
        setDeadlines(deadlines.map((d) => (d.id === deadlineId ? { ...d, completed: updated.completed } : d)))
      }
    } catch (err) {
      console.error('Failed to toggle deadline:', err)
    }
  }

  const handleSyllabusUpload = async () => {
    if (!syllabusFile || !courseId) return
    setSyllabusLoading(true)
    setSyllabusSuccess(false)
    setSyllabusError(null)

    const formData = new FormData()
    formData.append('file', syllabusFile)

    try {
      const url = `${API_URL}/courses/${courseId}/syllabus`
      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })
      console.log('[Syllabus Upload]', url, res.status)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to parse syllabus')
      }
      setSyllabusSuccess(true)
      setSyllabusFile(null)
      setDeadlineTabTouched(false)
      await loadCourse()
    } catch (err) {
      console.error('Failed to upload syllabus:', err)
      setSyllabusError(err instanceof Error ? err.message : 'Failed to upload syllabus')
    } finally {
      setSyllabusLoading(false)
      setTimeout(() => setSyllabusSuccess(false), 3000)
    }
  }

  const handleFlashcardUpload = async () => {
    if (!studyFile || !courseId) return
    setFlashcardLoading(true)
    setFlashcardSuccess(false)
    setFlashcardError(null)

    try {
      const filename = studyFile.name.toLowerCase()
      const ext = filename.split('.').pop() || ''
      const flashcardExts = ['pdf', 'txt']
      const summaryExts = ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg']

      const actions: Promise<Response>[] = []
      const errors: string[] = []

      const upload = (endpoint: string) => {
        const formData = new FormData()
        formData.append('file', studyFile)
        return fetchWithAuth(endpoint, {
          method: 'POST',
          body: formData,
          cache: 'no-store',
        })
      }

      if (generateFlashcards) {
        if (!flashcardExts.includes(ext)) {
          errors.push('Flashcards support PDF or TXT files.')
        } else {
          const url = `${API_URL}/courses/${courseId}/flashcards`
          console.log('[Flashcard Upload]', url)
          actions.push(upload(url))
        }
      }

      if (generateQuiz) {
        if (!flashcardExts.includes(ext)) {
          errors.push('Quiz generation supports PDF or TXT files.')
        } else {
          const url = `${API_URL}/courses/${courseId}/generate-quiz`
          console.log('[Quiz Upload]', url)
          actions.push(upload(url))
        }
      }

      if (generateSummary) {
        if (!summaryExts.includes(ext)) {
          errors.push('Summaries support PDF, DOCX, TXT, or image files.')
        } else {
          const url = `${API_URL}/courses/${courseId}/summaries`
          console.log('[Summary Upload]', url)
          actions.push(upload(url))
        }
      }

      if (actions.length === 0) {
        throw new Error(errors[0] || 'Select at least one study tool to generate.')
      }

      const results = await Promise.all(actions)
      for (const res of results) {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to generate study tools')
        }
      }

      setFlashcardSuccess(true)
      setStudyFile(null)
      const refreshed = await fetchWithAuth(`${API_URL}/courses/${courseId}`, { cache: 'no-store' })
      if (refreshed.ok) {
        const data = await refreshed.json()
        setCourse(data)
        setDeadlines(data.deadlines || [])
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err)
      setFlashcardError(err instanceof Error ? err.message : 'Failed to generate study tools')
    } finally {
      setFlashcardLoading(false)
      setTimeout(() => setFlashcardSuccess(false), 3000)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const startEditingInfo = () => {
    setEditedInfo(course?.course_info ? JSON.parse(JSON.stringify(course.course_info)) : {
      instructor: { name: null, email: null, office: null, office_hours: null, phone: null },
      logistics: { meeting_times: null, location: null, attendance_policy: null, late_work_policy: null },
      grade_breakdown: [],
      policies: { participation: null, extra_credit: null, academic_integrity: null, prerequisites: null },
      materials: { required_textbooks: [], recommended_readings: [], course_portal: null, ta_info: null }
    })
    setEditingInfo(true)
  }

  const saveCourseInfo = async () => {
    if (!courseId || !editedInfo) return
    setSavingInfo(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_info: editedInfo }),
        cache: 'no-store',
      })
      if (res.ok) {
        setCourse(prev => prev ? { ...prev, course_info: editedInfo } : prev)
        setEditingInfo(false)
        setInfoToast('Course info saved!')
        setTimeout(() => setInfoToast(null), 2000)
      }
    } catch (err) {
      console.error('Failed to save course info:', err)
      setInfoToast('Failed to save')
      setTimeout(() => setInfoToast(null), 2000)
    } finally {
      setSavingInfo(false)
    }
  }

  const updateEditedField = (section: string, field: string, value: string) => {
    if (!editedInfo) return
    setEditedInfo(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      if (section === 'instructor') {
        updated.instructor = { ...updated.instructor, [field]: value || null }
      } else if (section === 'logistics') {
        updated.logistics = { ...updated.logistics, [field]: value || null }
      } else if (section === 'policies') {
        updated.policies = { ...updated.policies, [field]: value || null }
      } else if (section === 'materials') {
        updated.materials = { ...updated.materials, [field]: value || null }
      }
      return updated
    })
  }

  const addGradeComponent = () => {
    if (!editedInfo) return
    setEditedInfo(prev => {
      if (!prev) return prev
      return { ...prev, grade_breakdown: [...(prev.grade_breakdown || []), { component: '', weight: '' }] }
    })
  }

  const updateGradeComponent = (index: number, field: 'component' | 'weight', value: string) => {
    if (!editedInfo) return
    setEditedInfo(prev => {
      if (!prev) return prev
      const breakdown = [...(prev.grade_breakdown || [])]
      breakdown[index] = { ...breakdown[index], [field]: value }
      return { ...prev, grade_breakdown: breakdown }
    })
  }

  const removeGradeComponent = (index: number) => {
    if (!editedInfo) return
    setEditedInfo(prev => {
      if (!prev) return prev
      const breakdown = [...(prev.grade_breakdown || [])]
      breakdown.splice(index, 1)
      return { ...prev, grade_breakdown: breakdown }
    })
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
    <main className="min-h-screen px-4 pb-20 pt-10">
      <div className="mx-auto max-w-6xl">
        <nav className="text-sm text-slate-500">
          <Link href="/" className="transition-all duration-300 hover:text-slate-700">
            Home
          </Link>
          <span className="px-2">/</span>
          <Link href="/courses" className="transition-all duration-300 hover:text-slate-700">
            Courses
          </Link>
          <span className="px-2">/</span>
          <span className="text-slate-700">{course?.name || 'Course'}</span>
        </nav>

        <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#E0EAFF] via-[#F3E8FF] to-[#E0F2FE] p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {course?.code || 'Course'}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{course?.name || 'Course details'}</h1>
              <p className="mt-2 text-sm text-slate-600">{course?.semester || 'Semester'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/70 px-5 py-3 text-sm text-slate-600 shadow-sm">
                <span className="font-semibold text-slate-900">{remainingCount}</span> deadlines remaining
              </div>
              {deadlines.length > 0 && unsavedCount > 0 && (
                <button
                  onClick={saveAllToCalendar}
                  disabled={bulkSaving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#5B8DEF] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                >
                  {bulkSaving ? 'Saving...' : `Save All (${unsavedCount}) to Calendar`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mt-8 flex items-center gap-2">
          <button
            onClick={() => setMainTab('deadlines')}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
              mainTab === 'deadlines'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={16} />
            Deadlines
            {unsavedCount > 0 && (
              <span className="ml-1 rounded-full bg-[#FFEDD5] px-2 py-0.5 text-xs text-[#FB923C]">{unsavedCount}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab('study')}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
              mainTab === 'study'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap size={16} />
            Study Tools
            {(course?.flashcard_sets?.length || 0) > 0 && (
              <span className="ml-1 rounded-full bg-[#E0EAFF] px-2 py-0.5 text-xs text-[#5B8DEF]">{course?.flashcard_sets?.length}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab('info')}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
              mainTab === 'info'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Info size={16} />
            Course Info
            {course?.course_info && (
              <span className="ml-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs text-[#4ADE80]">
                <Check size={10} className="inline" />
              </span>
            )}
          </button>
        </div>

        {mainTab === 'deadlines' ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Deadline Timeline</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#FFEDD5] px-3 py-1 font-semibold text-[#FB923C]">
                    {unsavedCount} unsaved
                  </span>
                  <span className="rounded-full bg-[#DCFCE7] px-3 py-1 font-semibold text-[#4ADE80]">
                    {savedCount} in calendar
                  </span>
                </div>
              </div>

              {/* Deadline Sub-tabs */}
              <div className="mt-4 flex rounded-full bg-slate-100 p-1">
                <button
                  onClick={() => {
                    setDeadlineTabTouched(true)
                    setDeadlineTab('unsaved')
                  }}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                    deadlineTab === 'unsaved'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Unsaved ({unsavedCount})
                </button>
                <button
                  onClick={() => {
                    setDeadlineTabTouched(true)
                    setDeadlineTab('saved')
                  }}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                    deadlineTab === 'saved'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  In Calendar ({savedCount})
                </button>
              </div>

            <div className="mt-6 space-y-4 border-l-2 border-slate-200 pl-6">
              {(deadlineTab === 'unsaved' ? unsavedDeadlines : savedDeadlines).map((deadline) => {
                const style = typeStyles[deadline.type] || typeStyles.Deadline
                return (
                  <div key={deadline.id} className="relative">
                    <div className="absolute -left-[29px] top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#5B8DEF] text-[10px]">
                      {style.icon}
                    </div>
                    <div
                      className={`rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                        deadline.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={deadline.completed || false}
                          onChange={() => toggleComplete(deadline.id)}
                          className="mt-1 h-5 w-5 rounded border-slate-300 text-[#5B8DEF] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.date}`}>
                              {deadline.date}
                            </span>
                            {deadline.time && <span className="text-xs text-slate-500">{deadline.time}</span>}
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                              {deadline.type}
                            </span>
                          </div>
                          <h3
                            className={`mt-2 text-base font-semibold text-slate-900 ${
                              deadline.completed ? 'line-through' : ''
                            }`}
                          >
                            {deadline.title || 'Untitled deadline'}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {deadline.description || deadline.context || 'No description provided.'}
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            {deadlineTab === 'unsaved' ? (
                              <button
                                onClick={() => saveToCalendar(deadline.id)}
                                disabled={savingToCalendar === deadline.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF] hover:text-[#5B8DEF] disabled:opacity-50"
                              >
                                {savingToCalendar === deadline.id ? (
                                  'Saving...'
                                ) : (
                                  <>
                                    <Calendar size={12} /> Save to Calendar
                                  </>
                                )}
                              </button>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-3 py-1.5 text-xs font-semibold text-[#4ADE80]">
                                  <Check size={12} /> In Calendar
                                </span>
                                <button
                                  onClick={() => removeFromCalendar(deadline.id)}
                                  disabled={savingToCalendar === deadline.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-400 transition-all duration-300 hover:border-red-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                                >
                                  {savingToCalendar === deadline.id ? 'Removing...' : 'Remove'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {(deadlineTab === 'unsaved' ? unsavedDeadlines : savedDeadlines).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  {deadlineTab === 'unsaved' ? (
                    deadlines.length === 0 ? (
                      <>
                        <p>No deadlines yet.</p>
                        <p className="mt-1 text-xs text-slate-400">Upload a syllabus to populate this timeline.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[#4ADE80]">All deadlines saved!</p>
                        <p className="mt-1 text-xs text-slate-400">Switch to &quot;In Calendar&quot; to view them.</p>
                        <button
                          onClick={() => {
                            setDeadlineTabTouched(true)
                            setDeadlineTab('saved')
                          }}
                          className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF] hover:text-[#5B8DEF]"
                        >
                          View In Calendar
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      <p>No deadlines in calendar yet.</p>
                      <p className="mt-1 text-xs text-slate-400">Save deadlines from the &quot;Unsaved&quot; tab.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            {/* Syllabus Upload */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Upload syllabus</h3>
              <p className="mt-2 text-sm text-slate-600">
                Add a syllabus PDF to extract deadlines automatically.
              </p>

              <input
                ref={syllabusInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                className="hidden"
                id="syllabus-upload"
              />

              {!syllabusFile ? (
                <label
                  htmlFor="syllabus-upload"
                  className="mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M8 7h8M8 11h8M8 15h5" />
                      <rect x="5" y="3" width="14" height="18" rx="3" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">Click to upload syllabus</p>
                  <p className="mt-1 text-xs text-slate-400">PDF only, max 10MB</p>
                </label>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#FB7185]">
                      <File size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{syllabusFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(syllabusFile.size)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSyllabusFile(null)
                        if (syllabusInputRef.current) syllabusInputRef.current.value = ''
                      }}
                      className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleSyllabusUpload}
                disabled={!syllabusFile || syllabusLoading}
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syllabusLoading ? 'Extracting deadlines...' : 'Parse Syllabus'}
              </button>

              {syllabusLoading && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA]" style={{ width: '60%' }} />
                  </div>
                  <p className="text-center text-xs text-slate-500">Analyzing syllabus with AI...</p>
                </div>
              )}

              {syllabusSuccess && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#ECFDF3] p-3 text-sm font-semibold text-[#4ADE80]">
                  <Check size={16} />
                  Deadlines extracted successfully!
                </div>
              )}

              {syllabusError && (
                <div className="mt-4 rounded-2xl bg-[#FEE2E2] p-3 text-center text-sm text-[#FB7185]">
                  {syllabusError}
                  <button onClick={() => setSyllabusError(null)} className="ml-2 underline">Dismiss</button>
                </div>
              )}
            </div>

            {/* Flashcard Upload */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Generate flashcards</h3>
              <p className="mt-2 text-sm text-slate-600">
                Upload notes or study materials to create a flashcard deck.
              </p>

              <input
                ref={studyInputRef}
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setStudyFile(e.target.files?.[0] || null)}
                className="hidden"
                id="study-upload"
              />

              {!studyFile ? (
                <label
                  htmlFor="study-upload"
                  className="mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 5v8M8 9l4-4 4 4" />
                      <rect x="4" y="4" width="16" height="16" rx="3" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">Click to upload study material</p>
                  <p className="mt-1 text-xs text-slate-400">PDF or TXT, max 10MB</p>
                </label>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0EAFF] text-[#5B8DEF]">
                      <BookMarked size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{studyFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(studyFile.size)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setStudyFile(null)
                        if (studyInputRef.current) studyInputRef.current.value = ''
                      }}
                      className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleFlashcardUpload}
                disabled={!studyFile || flashcardLoading}
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {flashcardLoading ? 'Generating flashcards...' : 'Generate Flashcards'}
              </button>

              {flashcardLoading && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA]" style={{ width: '70%' }} />
                  </div>
                  <p className="text-center text-xs text-slate-500">Generating flashcards with AI...</p>
                </div>
              )}

              {flashcardSuccess && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#ECFDF3] p-3 text-sm font-semibold text-[#4ADE80]">
                  <Check size={16} />
                  Flashcards generated!
                </div>
              )}

              {flashcardError && (
                <div className="mt-4 rounded-2xl bg-[#FEE2E2] p-3 text-center text-sm text-[#FB7185]">
                  {flashcardError}
                  <button onClick={() => setFlashcardError(null)} className="ml-2 underline">Dismiss</button>
                </div>
              )}
            </div>

            {/* Flashcard Decks */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Available decks</h4>
              <div className="mt-4 grid gap-6">
                {(course?.flashcard_sets || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    No flashcard sets yet.
                  </div>
                ) : (
                  course?.flashcard_sets?.map((set) => (
                    <Link
                      key={set.id}
                      href={`/flashcards?set=${set.id}`}
                      className="group flex items-center justify-between rounded-2xl border border-transparent bg-white px-5 py-4 text-sm text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#5B8DEF]/50 hover:shadow-lg"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B8DEF]">
                            <Layers size={20} />
                          </div>
                          <div>
                            <div className="text-base font-semibold text-slate-900">{set.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{set.card_count} cards</div>
                          </div>
                        </div>
                        {typeof set.progress === 'number' && (
                          <div className="mt-3">
                            <div className="h-px w-full bg-slate-100" />
                            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#5B8DEF]"
                                style={{ width: `${Math.min(100, Math.max(0, set.progress))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 transition-all duration-300 group-hover:text-[#5B8DEF]">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
        ) : mainTab === 'study' ? (
          /* Study Tools Tab */
          <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm">
            <div className="max-w-3xl mx-auto">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF]">
                  <Sparkles size={28} className="text-[#5B8DEF]" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Study Tools</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Upload study materials to generate AI-powered learning aids.
                </p>
              </div>

              {/* File Upload Area */}
              <div className="mt-8">
                <input
                  ref={studyInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setStudyFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="study-tools-upload"
                />

                {!studyFile ? (
                  <label
                    htmlFor="study-tools-upload"
                    className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Upload size={24} className="text-slate-400" />
                    </div>
                    <p className="mt-4 text-base font-medium text-slate-700">Drop files here or click to browse</p>
                    <p className="mt-2 text-sm text-slate-400">Accepts: PDF, DOCX, TXT, PNG, JPG (max 10MB)</p>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E0EAFF] text-[#5B8DEF]">
                        <File size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{studyFile.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(studyFile.size)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setStudyFile(null)
                          if (studyInputRef.current) studyInputRef.current.value = ''
                        }}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Generation Options */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">What would you like to generate?</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30">
                    <input
                      type="checkbox"
                      checked={generateFlashcards}
                      onChange={(e) => setGenerateFlashcards(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-[#5B8DEF]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-[#5B8DEF]" />
                        <span className="font-medium text-slate-900">Flashcards</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Generate 10-20 question/answer cards</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30">
                    <input
                      type="checkbox"
                      checked={generateQuiz}
                      onChange={(e) => setGenerateQuiz(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-[#5B8DEF]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <HelpCircle size={16} className="text-[#A78BFA]" />
                        <span className="font-medium text-slate-900">Mini Quiz</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Generate 5-10 multiple choice questions</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30">
                    <input
                      type="checkbox"
                      checked={generateSummary}
                      onChange={(e) => setGenerateSummary(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-[#5B8DEF]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-[#38BDF8]" />
                        <span className="font-medium text-slate-900">Summary Notes</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">AI-generated study summaries</p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={handleFlashcardUpload}
                disabled={!studyFile || flashcardLoading || (!generateFlashcards && !generateQuiz && !generateSummary)}
                className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-4 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {flashcardLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={16} />
                    Generate Study Tools
                  </span>
                )}
              </button>

              {flashcardSuccess && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#ECFDF3] p-4 text-sm font-semibold text-[#4ADE80]">
                  <Check size={18} />
                  Study tools generated successfully!
                </div>
              )}

              {flashcardError && (
                <div className="mt-4 rounded-2xl bg-[#FEE2E2] p-4 text-center text-sm text-[#FB7185]">
                  {flashcardError}
                  <button onClick={() => setFlashcardError(null)} className="ml-2 underline">Dismiss</button>
                </div>
              )}

              {/* Generated Study Tools */}
              {((course?.flashcard_sets?.length || 0) > 0 || (course?.summaries?.length || 0) > 0) && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Study Tools</h3>
                  {(course?.flashcard_sets?.length || 0) > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {course?.flashcard_sets?.map((set) => (
                        <Link
                          key={set.id}
                          href={`/flashcards?set=${set.id}`}
                          className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#5B8DEF]/50 hover:bg-white hover:shadow-lg"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
                            <Layers size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{set.name}</div>
                            <div className="text-xs text-slate-500">{set.card_count} flashcards</div>
                          </div>
                          <div className="text-slate-400 group-hover:text-[#5B8DEF] transition-colors">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {(course?.summaries?.length || 0) > 0 && (
                    <div className="mt-6 space-y-3">
                      {course?.summaries?.map((summary) => (
                        <div key={summary.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#38BDF8]">
                              <FileText size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{summary.title}</div>
                              <div className="text-xs text-slate-500">
                                {new Date(summary.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">
                            {summary.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Course Info Tab */
          <div className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Course Information</h2>
              {!editingInfo ? (
                <button
                  onClick={startEditingInfo}
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Pencil size={14} />
                  Edit Course Info
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingInfo(false)}
                    className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-500 shadow-sm transition-all duration-300 hover:text-slate-700"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={saveCourseInfo}
                    disabled={savingInfo}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                  >
                    <Save size={14} />
                    {savingInfo ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {!course?.course_info && !editingInfo ? (
              <div className="rounded-3xl bg-white p-12 shadow-sm text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF]">
                  <Info size={28} className="text-[#5B8DEF]" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No course info yet</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                  Upload a syllabus to automatically extract course details, or add them manually.
                </p>
                <button
                  onClick={startEditingInfo}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Pencil size={14} />
                  Add Course Info Manually
                </button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Class Schedule */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Class Schedule</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    {classSchedule.length === 0 ? (
                      <span className="italic text-slate-400">No class schedule set.</span>
                    ) : (
                      <ul>
                        {classSchedule.map((item, idx) => (
                          <li key={idx} className="flex gap-4 items-center">
                            <span className="font-semibold text-slate-700">{item.day}</span>
                            <span className="text-slate-600">
                              {item.start} - {item.end}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {editingSchedule ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-2">Select class days:</p>
                          <div className="flex flex-wrap gap-2">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                              <button
                                key={day}
                                onClick={() => {
                                  setSelectedDays((prev) =>
                                    prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                                  )
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  selectedDays.includes(day)
                                    ? 'bg-[#5B8DEF] text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500">Start time</label>
                            <input
                              type="time"
                              value={scheduleTime.start}
                              onChange={(e) => setScheduleTime((s) => ({ ...s, start: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500">End time</label>
                            <input
                              type="time"
                              value={scheduleTime.end}
                              onChange={(e) => setScheduleTime((s) => ({ ...s, end: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (selectedDays.length > 0 && scheduleTime.start && scheduleTime.end) {
                                const newEntries = selectedDays.map((day) => ({
                                  day,
                                  start: scheduleTime.start,
                                  end: scheduleTime.end,
                                }))
                                setClassSchedule(newEntries)
                                setEditingSchedule(false)
                              }
                            }}
                            disabled={selectedDays.length === 0 || !scheduleTime.start || !scheduleTime.end}
                            className="rounded-lg bg-[#5B8DEF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingSchedule(false)
                              setSelectedDays(classSchedule.map((s) => s.day))
                              if (classSchedule.length > 0) {
                                setScheduleTime({ start: classSchedule[0].start, end: classSchedule[0].end })
                              }
                            }}
                            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingSchedule(true)
                          setSelectedDays(classSchedule.map((s) => s.day))
                          if (classSchedule.length > 0) {
                            setScheduleTime({ start: classSchedule[0].start, end: classSchedule[0].end })
                          }
                        }}
                        className="mt-4 rounded-lg bg-[#5B8DEF] px-4 py-2 text-sm font-medium text-white"
                      >
                        {classSchedule.length > 0 ? 'Edit Schedule' : 'Set Schedule'}
                      </button>
                    )}
                    {classSchedule.length > 0 && (
                      <button
                        onClick={() => {
                          router.push('/calendar')
                        }}
                        className="mt-4 rounded bg-[#4ADE80] px-3 py-1 text-white hover:bg-[#3fbb6b] transition-colors"
                      >
                        View in Calendar
                      </button>
                    )}
                  </div>
                </div>
                {/* Instructor Section */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B8DEF]">
                      <User size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Instructor</h3>
                  </div>
                  {editingInfo ? (
                    <div className="space-y-3">
                      {[
                        { label: 'Name', field: 'name' },
                        { label: 'Email', field: 'email' },
                        { label: 'Office', field: 'office' },
                        { label: 'Office Hours', field: 'office_hours' },
                        { label: 'Phone', field: 'phone' },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <label className="text-xs font-medium text-slate-500">{label}</label>
                          <input
                            type="text"
                            value={(editedInfo?.instructor as Record<string, string | null | undefined>)?.[field] || ''}
                            onChange={(e) => updateEditedField('instructor', field, e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                            placeholder={label}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: 'Name', value: course?.course_info?.instructor?.name },
                        { label: 'Email', value: course?.course_info?.instructor?.email, isEmail: true },
                        { label: 'Office', value: course?.course_info?.instructor?.office },
                        { label: 'Office Hours', value: course?.course_info?.instructor?.office_hours },
                        { label: 'Phone', value: course?.course_info?.instructor?.phone },
                      ].filter(item => item.value).map(({ label, value, isEmail }) => (
                        <div key={label} className="flex items-start gap-3">
                          <span className="text-xs font-medium text-slate-400 w-24 shrink-0 pt-0.5">{label}</span>
                          {isEmail ? (
                            <a href={`mailto:${value}`} className="text-sm text-[#5B8DEF] hover:underline">{value}</a>
                          ) : (
                            <span className="text-sm text-slate-700">{value}</span>
                          )}
                        </div>
                      ))}
                      {!course?.course_info?.instructor?.name && (
                        <p className="text-sm text-slate-400 italic">No instructor info available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Logistics Section */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0FDFF] text-[#38BDF8]">
                      <Clock size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Course Logistics</h3>
                  </div>
                  {editingInfo ? (
                    <div className="space-y-3">
                      {[
                        { label: 'Meeting Times', field: 'meeting_times' },
                        { label: 'Location', field: 'location' },
                        { label: 'Attendance Policy', field: 'attendance_policy' },
                        { label: 'Late Work Policy', field: 'late_work_policy' },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <label className="text-xs font-medium text-slate-500">{label}</label>
                          <input
                            type="text"
                            value={(editedInfo?.logistics as Record<string, string | null | undefined>)?.[field] || ''}
                            onChange={(e) => updateEditedField('logistics', field, e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                            placeholder={label}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: 'Meeting', value: course?.course_info?.logistics?.meeting_times },
                        { label: 'Location', value: course?.course_info?.logistics?.location },
                        { label: 'Attendance', value: course?.course_info?.logistics?.attendance_policy },
                        { label: 'Late Work', value: course?.course_info?.logistics?.late_work_policy },
                      ].filter(item => item.value).map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <span className="text-xs font-medium text-slate-400 w-24 shrink-0 pt-0.5">{label}</span>
                          <span className="text-sm text-slate-700">{value}</span>
                        </div>
                      ))}
                      {!course?.course_info?.logistics?.meeting_times && !course?.course_info?.logistics?.location && (
                        <p className="text-sm text-slate-400 italic">No logistics info available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Grade Breakdown Section */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#A78BFA]">
                      <BarChart3 size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Grade Breakdown</h3>
                  </div>
                  {editingInfo ? (
                    <div className="space-y-3">
                      {(editedInfo?.grade_breakdown || []).map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => updateGradeComponent(index, 'component', e.target.value)}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                            placeholder="Component (e.g., Exams)"
                          />
                          <input
                            type="text"
                            value={item.weight}
                            onChange={(e) => updateGradeComponent(index, 'weight', e.target.value)}
                            className="w-24 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                            placeholder="Weight"
                          />
                          <button
                            onClick={() => removeGradeComponent(index)}
                            className="rounded-full p-2 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addGradeComponent}
                        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 transition-colors hover:border-[#5B8DEF] hover:text-[#5B8DEF]"
                      >
                        + Add Component
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(course?.course_info?.grade_breakdown || []).length > 0 ? (
                        (course?.course_info?.grade_breakdown || []).map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-slate-700">{item.component}</span>
                            <span className="text-sm font-semibold text-slate-900">{item.weight}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400 italic">No grade breakdown available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Policies Section */}
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#FB923C]">
                      <Scale size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Policies</h3>
                  </div>
                  {editingInfo ? (
                    <div className="space-y-3">
                      {[
                        { label: 'Participation', field: 'participation' },
                        { label: 'Extra Credit', field: 'extra_credit' },
                        { label: 'Academic Integrity', field: 'academic_integrity' },
                        { label: 'Prerequisites', field: 'prerequisites' },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <label className="text-xs font-medium text-slate-500">{label}</label>
                          <input
                            type="text"
                            value={(editedInfo?.policies as Record<string, string | null | undefined>)?.[field] || ''}
                            onChange={(e) => updateEditedField('policies', field, e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                            placeholder={label}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: 'Participation', value: course?.course_info?.policies?.participation },
                        { label: 'Extra Credit', value: course?.course_info?.policies?.extra_credit },
                        { label: 'Academic Integrity', value: course?.course_info?.policies?.academic_integrity },
                        { label: 'Prerequisites', value: course?.course_info?.policies?.prerequisites },
                      ].filter(item => item.value).map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <span className="text-xs font-medium text-slate-400 w-24 shrink-0 pt-0.5">{label}</span>
                          <span className="text-sm text-slate-700">{value}</span>
                        </div>
                      ))}
                      {!course?.course_info?.policies?.participation && !course?.course_info?.policies?.academic_integrity && (
                        <p className="text-sm text-slate-400 italic">No policy info available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Materials Section */}
                <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#4ADE80]">
                      <BookCopy size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Materials & Resources</h3>
                  </div>
                  {editingInfo ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-500">Required Textbooks (one per line)</label>
                        <textarea
                          value={(editedInfo?.materials?.required_textbooks || []).join('\n')}
                          onChange={(e) => {
                            if (!editedInfo) return
                            setEditedInfo(prev => prev ? {
                              ...prev,
                              materials: { ...prev.materials, required_textbooks: e.target.value.split('\n').filter(Boolean) }
                            } : prev)
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          rows={3}
                          placeholder="One textbook per line"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">Recommended Readings (one per line)</label>
                        <textarea
                          value={(editedInfo?.materials?.recommended_readings || []).join('\n')}
                          onChange={(e) => {
                            if (!editedInfo) return
                            setEditedInfo(prev => prev ? {
                              ...prev,
                              materials: { ...prev.materials, recommended_readings: e.target.value.split('\n').filter(Boolean) }
                            } : prev)
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          rows={3}
                          placeholder="One reading per line"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">Course Portal</label>
                        <input
                          type="text"
                          value={editedInfo?.materials?.course_portal || ''}
                          onChange={(e) => updateEditedField('materials', 'course_portal', e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          placeholder="https://canvas.edu/..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">TA Information</label>
                        <input
                          type="text"
                          value={editedInfo?.materials?.ta_info || ''}
                          onChange={(e) => updateEditedField('materials', 'ta_info', e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          placeholder="TA name and contact info"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-medium text-slate-400 mb-2">Required Textbooks</h4>
                        {(course?.course_info?.materials?.required_textbooks || []).length > 0 ? (
                          <ul className="space-y-1.5">
                            {(course?.course_info?.materials?.required_textbooks || []).map((book, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <BookOpen size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                {book}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-400 italic">None listed</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-slate-400 mb-2">Recommended Readings</h4>
                        {(course?.course_info?.materials?.recommended_readings || []).length > 0 ? (
                          <ul className="space-y-1.5">
                            {(course?.course_info?.materials?.recommended_readings || []).map((reading, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                <BookOpen size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                {reading}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-400 italic">None listed</p>
                        )}
                      </div>
                      {course?.course_info?.materials?.course_portal && (
                        <div>
                          <h4 className="text-xs font-medium text-slate-400 mb-2">Course Portal</h4>
                          <a
                            href={course.course_info.materials.course_portal.startsWith('http') ? course.course_info.materials.course_portal : `https://${course.course_info.materials.course_portal}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#5B8DEF] hover:underline"
                          >
                            {course.course_info.materials.course_portal}
                          </a>
                        </div>
                      )}
                      {course?.course_info?.materials?.ta_info && (
                        <div>
                          <h4 className="text-xs font-medium text-slate-400 mb-2">Teaching Assistant</h4>
                          <p className="text-sm text-slate-700">{course.course_info.materials.ta_info}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Course Info Toast */}
      {infoToast && (
        <div className="fixed right-6 top-24 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg border border-slate-100">
            {infoToast}
          </div>
        </div>
      )}

      {/* Calendar Toast */}
      {calendarToast && (
        <div className="fixed right-6 top-24 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg border border-slate-100">
            {calendarToast}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </main>
  )
}
