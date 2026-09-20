'use client'

import { useCallback, useEffect, useRef, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, HelpCircle, FileText, FolderOpen, BookOpenCheck, ClipboardList, Clock, Calendar, Check, File, Layers, Upload, Sparkles, GraduationCap, Info, User, Scale, BarChart3, BookCopy, Pencil, Save, X, NotebookPen } from 'lucide-react'
import { API_URL, useAuthFetch, friendlyUploadErrorMessage } from '../../../hooks/useAuthFetch'
import { useAuth } from '../../../lib/useAuth'
import posthog from 'posthog-js'
import NamingStyleModal from '../../../components/NamingStyleModal'
import DeadlineList from '../../../components/DeadlineList'
import NextSteps from '../../../components/NextSteps'
import { localToday } from '../../../lib/deadlineGroups'
import dynamic from 'next/dynamic'

// The rich-text editor is a sizeable dependency; only download it when someone opens the Notes tab.
const CourseNotes = dynamic(() => import('../../../components/CourseNotes'), {
  ssr: false,
  loading: () => <div className="mt-6 rounded-3xl bg-white p-8 text-sm text-slate-500 shadow-sm">Loading notes…</div>,
})

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

interface Quiz {
  id: string
  name: string
  question_count: number
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
  semester: string | null
  deadline_count?: number
  course_info?: CourseInfo | null
  color?: string | null
  deadlines?: Deadline[]
  flashcard_sets?: FlashcardSet[]
  summaries?: Summary[]
  quizzes?: Quiz[]
  note_count?: number
}

/** Shape passed into the confirmation modal */
interface ConfirmTarget {
  id: string
  type: 'syllabus' | 'flashcard_set' | 'summary' | 'quiz'
  label: string          // human-readable name shown in the modal
  warning?: string       // optional extra warning line
}

const typeStyles: Record<string, { badge: string; date: string; icon: ReactNode }> = {
  Exam: { badge: 'bg-[#FEE2E2] text-[#FB7185]', date: 'bg-[#FFF1F2] text-[#FB7185]', icon: <BookOpen size={10} className="text-white" /> },
  Quiz: { badge: 'bg-[#FFEDD5] text-[#FB923C]', date: 'bg-[#FFF7ED] text-[#FB923C]', icon: <HelpCircle size={10} className="text-white" /> },
  Assignment: { badge: 'bg-[#DBEAFE] text-[#38BDF8]', date: 'bg-[#E0F2FE] text-[#38BDF8]', icon: <FileText size={10} className="text-white" /> },
  Project: { badge: 'bg-[#E9D5FF] text-[#A78BFA]', date: 'bg-[#F3E8FF] text-[#A78BFA]', icon: <FolderOpen size={10} className="text-white" /> },
  Reading: { badge: 'bg-[#DCFCE7] text-[#4ADE80]', date: 'bg-[#ECFDF3] text-[#4ADE80]', icon: <BookOpenCheck size={10} className="text-white" /> },
  Admin: { badge: 'bg-slate-100 text-slate-600', date: 'bg-slate-50 text-slate-500', icon: <ClipboardList size={10} className="text-white" /> },
  Deadline: { badge: 'bg-slate-100 text-slate-600', date: 'bg-slate-50 text-slate-500', icon: <Clock size={10} className="text-white" /> },
  Class: { badge: 'bg-[#E0EAFF] text-[#5B8DEF]', date: 'bg-[#EEF2FF] text-[#5B8DEF]', icon: <Clock size={10} className="text-white" /> },
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, ' ')
    .trim()
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
  const [showNamingModal, setShowNamingModal] = useState(false)
  const [studyFile, setStudyFile] = useState<File | null>(null)
  const [flashcardLoading, setFlashcardLoading] = useState(false)
  const [flashcardSuccess, setFlashcardSuccess] = useState(false)
  const [flashcardError, setFlashcardError] = useState<string | null>(null)
  const [savingToCalendar, setSavingToCalendar] = useState<string | null>(null)
  const [calendarToast, setCalendarToast] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [mainTab, setMainTab] = useState<'deadlines' | 'study' | 'info' | 'notes'>('deadlines')
  const [syllabusOpen, setSyllabusOpen] = useState(false) // the "replace or remove" panel, once a syllabus is already parsed
  const [liveNoteCount, setLiveNoteCount] = useState<number | null>(null) // kept fresh by the Notes tab
  const [courseError, setCourseError] = useState(false)
  const [generateFlashcards, setGenerateFlashcards] = useState(true)
  const [generateQuiz, setGenerateQuiz] = useState(true)
  const [generateSummary, setGenerateSummary] = useState(true)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editedInfo, setEditedInfo] = useState<CourseInfo | null>(null)
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoToast, setInfoToast] = useState<string | null>(null)

  const syllabusInputRef = useRef<HTMLInputElement>(null)
  const studyInputRef = useRef<HTMLInputElement>(null)

  // Drag-and-drop highlight state & enter-count refs (prevents flicker on child boundaries)
  const [syllabusDragOver, setSyllabusDragOver] = useState(false)
  const [studyDragOver, setStudyDragOver] = useState(false)
  const syllabusDragCount = useRef(0)
  const studyDragCount = useRef(0)

  // Shared drag helpers ------------------------------------------------
  const preventDefault = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }

  const onSyllabusDragEnter = (e: React.DragEvent) => {
    preventDefault(e)
    syllabusDragCount.current += 1
    setSyllabusDragOver(true)
  }
  const onSyllabusDragLeave = (e: React.DragEvent) => {
    preventDefault(e)
    syllabusDragCount.current -= 1
    if (syllabusDragCount.current <= 0) {
      syllabusDragCount.current = 0
      setSyllabusDragOver(false)
    }
  }
  const onStudyDragEnter = (e: React.DragEvent) => {
    preventDefault(e)
    studyDragCount.current += 1
    setStudyDragOver(true)
  }
  const onStudyDragLeave = (e: React.DragEvent) => {
    preventDefault(e)
    studyDragCount.current -= 1
    if (studyDragCount.current <= 0) {
      studyDragCount.current = 0
      setStudyDragOver(false)
    }
  }

  const handleSyllabusDrop = (e: React.DragEvent) => {
    preventDefault(e)
    syllabusDragCount.current = 0
    setSyllabusDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf' || ext === 'docx') {
      setSyllabusFile(file)
    }
  }

  const handleStudyDrop = (e: React.DragEvent, acceptedExts: string[]) => {
    preventDefault(e)
    studyDragCount.current = 0
    setStudyDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext && acceptedExts.includes(ext)) {
      setStudyFile(file)
    }
  }

  // Computed values
  const unsavedCount = deadlines.filter(d => !d.saved_to_calendar).length
  const remainingCount = deadlines.filter(d => !d.completed).length
  const hasDeadlines = deadlines.length > 0
  const hasSyllabus = !!course?.course_info // a syllabus was parsed (courses built from Canvas/iCal have deadlines but no syllabus)
  const courseLoaded = course !== null
  const noteCount = liveNoteCount ?? course?.note_count ?? 0
  const studyCount = (course?.flashcard_sets?.length || 0) + (course?.quizzes?.length || 0) + (course?.summaries?.length || 0)
  // Once every deadline is on the calendar the real value is in the other tabs: point at whichever they haven't tried
  const showNextSteps = hasDeadlines && unsavedCount === 0 && (noteCount === 0 || studyCount === 0)
  // The big upload box only when there's no syllabus yet (or the student asked to replace it / it's mid-flight)
  const uploaderOpen = courseLoaded && (!hasDeadlines || syllabusOpen || syllabusFile !== null || syllabusLoading || syllabusSuccess || syllabusError !== null)
  const today = localToday()

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
      setCourseError(false)
    } catch (err) {
      console.error('Failed to load course:', err)
      setCourseError(true)
    }
  }, [courseId])

  useEffect(() => {
    if (!user || !courseId) return
    loadCourse()
  }, [user, courseId, loadCourse])

  // State for "add to calendar" class sessions
  const [classInCalendar, setClassInCalendar] = useState(false)
  const [savingClassCalendar, setSavingClassCalendar] = useState(false)

  // Helper: convert "12:30 PM" → "12:30" (24-h for <input type="time">)
  const parseTimeTo24 = (t: string): string => {
    if (!t) return ''
    const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!match) {
      // already 24-h?
      if (/^\d{1,2}:\d{2}$/.test(t)) return t.padStart(5, '0')
      return ''
    }
    let [, h, m, ampm] = match
    let hour = parseInt(h, 10)
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${m}`
  }

  // Initialise class-schedule pickers from persisted course_info when course loads
  useEffect(() => {
    if (!course?.course_info?.logistics?.meeting_times) {
      setClassSchedule([])
      return
    }
    const lines = course.course_info.logistics.meeting_times
      .split(/[,\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean)
    const parsed: Array<{ day: string; start: string; end: string }> = []
    const dayMap: Record<string, string> = {
      mon: 'Monday', monday: 'Monday',
      tue: 'Tuesday', tuesday: 'Tuesday',
      wed: 'Wednesday', wednesday: 'Wednesday',
      thu: 'Thursday', thursday: 'Thursday',
      fri: 'Friday', friday: 'Friday',
    }
    for (const line of lines) {
      // Expected formats: "Monday 2:00 PM - 3:15 PM" or "Mon 14:00 - 15:15"
      const words = line.split(/\s+/)
      const dayKey = words[0]?.toLowerCase().replace(/[^a-z]/g, '')
      const day = dayMap[dayKey]
      if (!day) continue
      // Extract times — find the dash separator and grab what's around it
      const dashIdx = line.indexOf('-')
      if (dashIdx === -1) {
        parsed.push({ day, start: '', end: '' })
        continue
      }
      const beforeDash = line.slice(line.indexOf(' ') + 1, dashIdx).trim()
      const afterDash = line.slice(dashIdx + 1).trim()
      parsed.push({ day, start: parseTimeTo24(beforeDash), end: parseTimeTo24(afterDash) })
    }
    if (parsed.length > 0) setClassSchedule(parsed)
  }, [course])

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

  const handleSyllabusUpload = async (namingStyle: 'simple' | 'descriptive') => {
    if (!syllabusFile || !courseId) return
    setSyllabusLoading(true)
    setSyllabusSuccess(false)
    setSyllabusError(null)

    const formData = new FormData()
    formData.append('file', syllabusFile)
    formData.append('naming_style', namingStyle)

    try {
      const url = `${API_URL}/courses/${courseId}/syllabus`
      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to parse syllabus')
      }
      setSyllabusSuccess(true)
      posthog.capture('syllabus_uploaded', { course_id: courseId })
      setSyllabusFile(null)
      setSyllabusOpen(false)
      await loadCourse()
    } catch (err) {
      console.error('Failed to upload syllabus:', err)
      setSyllabusError(friendlyUploadErrorMessage(err))
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
          actions.push(upload(`${API_URL}/courses/${courseId}/flashcards`))
        }
      }

      if (generateQuiz) {
        if (!flashcardExts.includes(ext)) {
          errors.push('Quiz generation supports PDF or TXT files.')
        } else {
          actions.push(upload(`${API_URL}/courses/${courseId}/generate-quiz`))
        }
      }

      if (generateSummary) {
        if (!summaryExts.includes(ext)) {
          errors.push('Summaries support PDF, DOCX, TXT, or image files.')
        } else {
          actions.push(upload(`${API_URL}/courses/${courseId}/summaries`))
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
      posthog.capture('material_uploaded', { course_id: courseId })
      if (generateFlashcards) posthog.capture('flashcard_set_created', { course_id: courseId })
      if (generateQuiz) posthog.capture('quiz_generated', { course_id: courseId })
      if (generateSummary) posthog.capture('summary_generated', { course_id: courseId })
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

  // ── Confirmation modal ──────────────────────────────────────────
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [confirmDeleting, setConfirmDeleting] = useState(false)

  const executeDelete = async () => {
    if (!confirmTarget || !courseId) return
    setConfirmDeleting(true)
    try {
      let url = ''
      switch (confirmTarget.type) {
        case 'syllabus':
          url = `${API_URL}/courses/${courseId}/syllabus`
          break
        case 'flashcard_set':
          url = `${API_URL}/flashcard-sets/${confirmTarget.id}`
          break
        case 'summary':
          url = `${API_URL}/summaries/${confirmTarget.id}`
          break
        case 'quiz':
          url = `${API_URL}/quizzes/${confirmTarget.id}`
          break
      }
      const res = await fetchWithAuth(url, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Delete failed')
      }
      // Optimistically update local state
      if (confirmTarget.type === 'syllabus') {
        setDeadlines([])
        setCourse((prev) => prev ? { ...prev, course_info: null, deadlines: [] } : prev)
      } else if (confirmTarget.type === 'flashcard_set') {
        setCourse((prev) => prev ? { ...prev, flashcard_sets: prev.flashcard_sets?.filter(s => s.id !== confirmTarget.id) } : prev)
      } else if (confirmTarget.type === 'summary') {
        setCourse((prev) => prev ? { ...prev, summaries: prev.summaries?.filter(s => s.id !== confirmTarget.id) } : prev)
      } else if (confirmTarget.type === 'quiz') {
        setCourse((prev) => prev ? { ...prev, quizzes: prev.quizzes?.filter(q => q.id !== confirmTarget.id) } : prev)
      }
      setConfirmTarget(null)
    } catch (err) {
      setConfirmTarget(null)
      // Show error via syllabus/flashcard error banner — reuse syllabusError for simplicity
      setSyllabusError(err instanceof Error ? err.message : 'Delete failed. Please try again.')
    } finally {
      setConfirmDeleting(false)
    }
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

        <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#E0EAFF] via-[#F3E8FF] to-[#E0F2FE] px-6 py-5 shadow-sm sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {course?.code || 'Course'}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{course?.name || 'Course details'}</h1>
              <p className="mt-1 text-sm text-slate-600">{course?.semester || 'Semester'}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-2.5 text-sm text-slate-600 shadow-sm">
              <span className="font-semibold text-slate-900">{remainingCount}</span> deadlines remaining
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMainTab('deadlines')}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 ${
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
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 ${
              mainTab === 'study'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <GraduationCap size={16} />
            Study Tools
            {studyCount > 0 && (
              <span className="ml-1 rounded-full bg-[#E0EAFF] px-2 py-0.5 text-xs text-[#5B8DEF]">{studyCount}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab('info')}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 ${
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
          <button
            onClick={() => setMainTab('notes')}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 ${
              mainTab === 'notes'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <NotebookPen size={16} />
            Notes
            {noteCount > 0 && (
              <span className="ml-1 rounded-full bg-[#E0EAFF] px-2 py-0.5 text-xs text-[#5B8DEF]">{noteCount}</span>
            )}
          </button>
        </div>

        {mainTab === 'deadlines' ? (
          <div className="mt-6 space-y-6">
            {!courseLoaded ? (
              <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                {courseError ? (
                  <>
                    <p>Couldn&apos;t load this course.</p>
                    <button
                      onClick={() => { setCourseError(false); void loadCourse() }}
                      className="mt-3 min-h-11 rounded-full border border-slate-200 px-4 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300"
                    >
                      Try again
                    </button>
                  </>
                ) : (
                  'Loading…'
                )}
              </div>
            ) : (
              <>
                {showNextSteps && (
                  <NextSteps
                    deadlineCount={deadlines.length}
                    showNotes={noteCount === 0}
                    showStudy={studyCount === 0}
                    onOpenNotes={() => setMainTab('notes')}
                    onOpenStudy={() => setMainTab('study')}
                  />
                )}

                {hasDeadlines && (
                  <DeadlineList
                    deadlines={deadlines}
                    today={today}
                    savingId={savingToCalendar}
                    bulkSaving={bulkSaving}
                    badgeClassFor={(type) => (typeStyles[type] || typeStyles.Deadline).badge}
                    onToggleComplete={toggleComplete}
                    onSave={saveToCalendar}
                    onRemove={removeFromCalendar}
                    onSaveAll={saveAllToCalendar}
                  />
                )}

                {uploaderOpen ? (
                  <div className={hasDeadlines ? '' : 'mx-auto max-w-xl'}>
            {/* Syllabus Upload */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {hasSyllabus ? 'Replace or remove your syllabus' : 'Upload your syllabus'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {hasSyllabus
                      ? 'Upload a corrected file to re-extract deadlines, or remove the syllabus along with the deadlines on this course.'
                      : 'Add a syllabus PDF or Word doc and ClassMate will pull out every exam, assignment and due date.'}
                  </p>
                </div>
                {hasDeadlines && !syllabusFile && !syllabusLoading && (
                  <button
                    type="button"
                    onClick={() => setSyllabusOpen(false)}
                    aria-label="Close"
                    className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <input
                ref={syllabusInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                className="hidden"
                id="syllabus-upload"
              />

              {!syllabusFile ? (
                <label
                  htmlFor="syllabus-upload"
                  className={`mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30 ${syllabusDragOver ? 'border-[#5B8DEF] bg-[#EEF2FF]/50 scale-[1.02]' : 'border-slate-200 bg-slate-50/50'}`}
                  onDragEnter={onSyllabusDragEnter}
                  onDragLeave={onSyllabusDragLeave}
                  onDragOver={preventDefault}
                  onDrop={handleSyllabusDrop}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M8 7h8M8 11h8M8 15h5" />
                      <rect x="5" y="3" width="14" height="18" rx="3" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">
                    {syllabusDragOver ? 'Drop it here!' : 'Drop or click to upload syllabus'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">PDF or Word doc, max 10MB</p>
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
                onClick={() => setShowNamingModal(true)}
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

              {/* "Remove syllabus" — visible once deadlines have been extracted */}
              {hasSyllabus && !syllabusFile && (
                <button
                  type="button"
                  onClick={() => setConfirmTarget({
                    id: courseId || '',
                    type: 'syllabus',
                    label: 'syllabus & all deadlines on this course',
                    warning: 'This permanently removes every deadline on this course, including any you added yourself or that synced from Canvas or iCal. Your notes, flashcards, quizzes and summaries are kept. You can re-upload a corrected syllabus afterwards.',
                  })}
                  className="mt-4 min-h-11 w-full rounded-full px-4 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  Remove syllabus & deadlines
                </button>
              )}
            </div>

                  </div>
                ) : (
                  hasDeadlines && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${hasSyllabus ? 'bg-[#DCFCE7] text-[#22A55A]' : 'bg-slate-100 text-slate-400'}`}>
                        {hasSyllabus ? <Check size={15} strokeWidth={2.75} /> : <FileText size={15} />}
                      </span>
                      <p className="min-w-0 flex-1 text-sm text-slate-500">
                        {hasSyllabus ? (
                          <>
                            <span className="font-medium text-slate-800">Syllabus parsed</span> · {deadlines.length} deadline{deadlines.length === 1 ? '' : 's'}
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-slate-800">Have a syllabus?</span> Add it to pull in every exam and assignment.
                          </>
                        )}
                      </p>
                      <button
                        onClick={() => setSyllabusOpen(true)}
                        className="min-h-11 shrink-0 rounded-full px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                      >
                        {hasSyllabus ? 'Replace or remove' : 'Upload syllabus'}
                      </button>
                    </div>
                  )
                )}
              </>
            )}
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
                    className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30 ${studyDragOver ? 'border-[#5B8DEF] bg-[#EEF2FF]/50 scale-[1.02]' : 'border-slate-200 bg-slate-50/50'}`}
                    onDragEnter={onStudyDragEnter}
                    onDragLeave={onStudyDragLeave}
                    onDragOver={preventDefault}
                    onDrop={(e) => handleStudyDrop(e, ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'])}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Upload size={24} className={studyDragOver ? 'text-[#5B8DEF]' : 'text-slate-400'} />
                    </div>
                    <p className="mt-4 text-base font-medium text-slate-700">
                      {studyDragOver ? 'Drop it here!' : 'Drop files here or click to browse'}
                    </p>
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

              {/* Generated Study Tools — manage / delete */}
              {((course?.flashcard_sets?.length || 0) > 0 || (course?.summaries?.length || 0) > 0 || (course?.quizzes?.length || 0) > 0) && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Study Tools</h3>

                  {/* Flashcard sets */}
                  {(course?.flashcard_sets?.length || 0) > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {course?.flashcard_sets?.map((set) => (
                        <div key={set.id} className="group relative flex items-center rounded-2xl border border-slate-100 bg-slate-50 transition-all duration-300 hover:-translate-y-1 hover:border-[#5B8DEF]/50 hover:bg-white hover:shadow-lg">
                          <Link
                            href={`/flashcards?set=${set.id}`}
                            className="flex flex-1 items-center gap-3 p-4 min-w-0"
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
                              <Layers size={24} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{set.name}</div>
                              <div className="text-xs text-slate-500">{set.card_count} flashcards</div>
                            </div>
                            <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 shrink-0 text-slate-300 group-hover:text-[#5B8DEF] transition-colors" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              setConfirmTarget({ id: set.id, type: 'flashcard_set', label: set.name, warning: 'This removes the deck and all its cards permanently.' })
                            }}
                            className="mr-3 rounded-full p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                            aria-label="Delete flashcard set"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summaries */}
                  {(course?.summaries?.length || 0) > 0 && (
                    <div className="mt-6 space-y-3">
                      {course?.summaries?.map((summary) => (
                        <div key={summary.id} className="group rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#38BDF8]">
                              <FileText size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{summary.title}</div>
                              <div className="text-xs text-slate-500">
                                {new Date(summary.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfirmTarget({ id: summary.id, type: 'summary', label: summary.title })}
                              className="rounded-full p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                              aria-label="Delete summary"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-3 text-xs text-slate-600 line-clamp-4">
                            {stripMarkdown(summary.content)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quizzes */}
                  {(course?.quizzes?.length || 0) > 0 && (
                    <div className="mt-6 space-y-3">
                      {course?.quizzes?.map((quiz) => (
                        <div key={quiz.id} className="group flex items-center rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#A78BFA]/50 hover:bg-white hover:shadow-lg">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#A78BFA]">
                            <HelpCircle size={18} />
                          </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{quiz.name}</div>
                          <div className="text-xs text-slate-500">{quiz.question_count} questions · {new Date(quiz.created_at).toLocaleDateString()}</div>
                        </div>
                        <Link
                          href={`/quizzes/${quiz.id}`}
                          className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          Start Quiz
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ id: quiz.id, type: 'quiz', label: quiz.name })}
                          className="rounded-full p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                          aria-label="Delete quiz"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : mainTab === 'notes' ? (
          /* Notes Tab — mounted only while open so leaving the tab flushes any pending autosave */
          courseId ? <CourseNotes courseId={courseId} courseName={course?.code || course?.name} onStudyToolsCreated={loadCourse} onCountChange={setLiveNoteCount} /> : null
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
                <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Class Schedule</h3>
                    <div className="flex items-center gap-2">
                      {classSchedule.length > 0 && (
                        <button
                          onClick={async () => {
                            if (classInCalendar) {
                              // Remove: delete class-session deadlines for this course
                              setSavingClassCalendar(true)
                              try {
                                // Fetch current deadlines to find class sessions
                                const res = await fetchWithAuth(`${API_URL}/deadlines?course_id=${courseId}`, { cache: 'no-store' })
                                if (res.ok) {
                                  const allDeadlines = await res.json()
                                  const classSessions = allDeadlines.filter((d: { type: string }) => d.type === 'Class')
                                  for (const sess of classSessions) {
                                    await fetchWithAuth(`${API_URL}/deadlines/${sess.id}`, { method: 'DELETE', cache: 'no-store' })
                                  }
                                }
                                setClassInCalendar(false)
                                setCalendarToast('Removed from calendar')
                                setTimeout(() => setCalendarToast(null), 2000)
                              } catch {
                                setCalendarToast('Failed to remove from calendar')
                                setTimeout(() => setCalendarToast(null), 2000)
                              } finally {
                                setSavingClassCalendar(false)
                              }
                            } else {
                              // Add: create class-session deadlines for next 4 weeks
                              setSavingClassCalendar(true)
                              try {
                                const today = new Date()
                                // Find the start of this week (Sunday)
                                const startOfWeek = new Date(today)
                                startOfWeek.setDate(today.getDate() - today.getDay())
                                const dayToNum: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
                                const formatTime12 = (t: string) => {
                                  if (!t) return ''
                                  const [h, m] = t.split(':')
                                  const hour = parseInt(h, 10)
                                  const ampm = hour >= 12 ? 'PM' : 'AM'
                                  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                                  return `${h12}:${m} ${ampm}`
                                }
                                let created = 0
                                for (let week = 0; week < 4; week++) {
                                  for (const entry of classSchedule) {
                                    const dayNum = dayToNum[entry.day]
                                    if (dayNum === undefined) continue
                                    const classDate = new Date(startOfWeek)
                                    classDate.setDate(startOfWeek.getDate() + dayNum + week * 7)
                                    // Skip past dates
                                    if (classDate < today) continue
                                    const dateStr = classDate.toISOString().split('T')[0]
                                    const timeStr = entry.start ? formatTime12(entry.start) : null
                                    const res = await fetchWithAuth(`${API_URL}/deadlines`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        title: `${course?.name || 'Class'}`,
                                        date: dateStr,
                                        time: timeStr,
                                        type: 'Class',
                                        description: entry.start && entry.end ? `${formatTime12(entry.start)} – ${formatTime12(entry.end)}` : null,
                                        course_id: courseId,
                                      }),
                                      cache: 'no-store',
                                    })
                                    if (res.ok) created++
                                  }
                                }
                                // Auto save-to-calendar for created deadlines
                                const listRes = await fetchWithAuth(`${API_URL}/deadlines?course_id=${courseId}`, { cache: 'no-store' })
                                if (listRes.ok) {
                                  const updated = await listRes.json()
                                  const classSessions = updated.filter((d: { type: string; saved_to_calendar?: boolean }) => d.type === 'Class' && !d.saved_to_calendar)
                                  for (const sess of classSessions) {
                                    await fetchWithAuth(`${API_URL}/deadlines/${sess.id}/save-to-calendar`, { method: 'POST', cache: 'no-store' })
                                  }
                                }
                                setClassInCalendar(true)
                                setCalendarToast(`Added ${created} class sessions to calendar`)
                                setTimeout(() => setCalendarToast(null), 2500)
                              } catch {
                                setCalendarToast('Failed to add to calendar')
                                setTimeout(() => setCalendarToast(null), 2000)
                              } finally {
                                setSavingClassCalendar(false)
                              }
                            }
                          }}
                          disabled={savingClassCalendar}
                          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 disabled:opacity-50 ${
                            classInCalendar
                              ? 'bg-[#ECFDF3] text-[#16A34A] hover:bg-[#DCFCE7]'
                              : 'bg-[#E0EAFF] text-[#5B8DEF] hover:bg-[#D0DEFF]'
                          }`}
                        >
                          <Calendar size={13} />
                          {savingClassCalendar ? 'Saving…' : classInCalendar ? 'In Calendar' : 'Add to Calendar'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingSchedule(true)
                          setSelectedDays(classSchedule.map((s) => s.day))
                          if (classSchedule.length > 0) {
                            setScheduleTime({ start: classSchedule[0].start, end: classSchedule[0].end })
                          } else {
                            setScheduleTime({ start: '', end: '' })
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-300 hover:bg-slate-200"
                      >
                        <Pencil size={13} />
                        {classSchedule.length > 0 ? 'Edit' : 'Set Schedule'}
                      </button>
                    </div>
                  </div>

                  {/* Weekly grid */}
                  {classSchedule.length === 0 && !editingSchedule ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0EAFF]">
                        <Clock size={20} className="text-[#5B8DEF]" />
                      </div>
                      <p className="text-sm text-slate-500">No class schedule set yet.</p>
                      <p className="mt-1 text-xs text-slate-400">Click <span className="font-semibold">Set Schedule</span> to add your class times.</p>
                    </div>
                  ) : !editingSchedule ? (
                    <div className="mt-5">
                      {/* Day headers */}
                      <div className="grid grid-cols-5 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label) => (
                          <div key={label} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {label}
                          </div>
                        ))}
                      </div>
                      {/* Day columns */}
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                          const entry = classSchedule.find((s) => s.day === day)
                          const formatDisplay = (t: string) => {
                            if (!t) return ''
                            const [h, m] = t.split(':')
                            const hour = parseInt(h, 10)
                            const ampm = hour >= 12 ? 'PM' : 'AM'
                            const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                            return `${h12}:${m}`
                          }
                          return (
                            <div key={day} className="rounded-xl bg-slate-50 border border-slate-100 min-h-[90px] flex flex-col items-center justify-center p-2 text-center">
                              {entry ? (
                                <div className="w-full rounded-lg bg-gradient-to-b from-[#5B8DEF] to-[#7C9BF6] px-2 py-2.5 shadow-sm">
                                  <p className="text-[11px] font-semibold text-white">{course?.name || 'Class'}</p>
                                  {entry.start && entry.end && (
                                    <p className="mt-1 text-[10px] text-blue-100">
                                      {formatDisplay(entry.start)} – {formatDisplay(entry.end)}
                                      <span className="block text-[9px] opacity-70">
                                        {parseInt(entry.end?.split(':')[0] || '0', 10) >= 12 ? 'PM' : 'AM'}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Schedule picker / editor */
                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Select class days</p>
                        <div className="flex flex-wrap gap-2">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                            <button
                              key={day}
                              onClick={() => {
                                setSelectedDays((prev) =>
                                  prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                                )
                              }}
                              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                                selectedDays.includes(day)
                                  ? 'bg-[#5B8DEF] text-white shadow-sm'
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
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500">End time</label>
                          <input
                            type="time"
                            value={scheduleTime.end}
                            onChange={(e) => setScheduleTime((s) => ({ ...s, end: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors focus:border-[#5B8DEF] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (selectedDays.length === 0 || !scheduleTime.start || !scheduleTime.end) return
                            const newEntries = selectedDays.map((day) => ({
                              day,
                              start: scheduleTime.start,
                              end: scheduleTime.end,
                            }))
                            const formatTime = (t: string) => {
                              const [h, m] = t.split(':')
                              const hour = parseInt(h, 10)
                              const ampm = hour >= 12 ? 'PM' : 'AM'
                              const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                              return `${h12}:${m} ${ampm}`
                            }
                            const meetingStr = newEntries
                              .map((e) => `${e.day} ${formatTime(e.start)} - ${formatTime(e.end)}`)
                              .join(', ')
                            try {
                              const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  course_info: {
                                    ...course?.course_info,
                                    logistics: {
                                      ...(course?.course_info?.logistics || {}),
                                      meeting_times: meetingStr,
                                    },
                                  },
                                }),
                                cache: 'no-store',
                              })
                              if (res.ok) {
                                setClassSchedule(newEntries)
                                setEditingSchedule(false)
                                setCourse(prev => prev ? {
                                  ...prev,
                                  course_info: {
                                    ...prev.course_info,
                                    logistics: { ...prev.course_info?.logistics, meeting_times: meetingStr },
                                  },
                                } : prev)
                                // If class was in calendar, remove old sessions so user can re-add
                                if (classInCalendar) setClassInCalendar(false)
                                setCalendarToast('Schedule saved!')
                                setTimeout(() => setCalendarToast(null), 2000)
                              } else {
                                const errData = await res.json().catch(() => ({}))
                                setCalendarToast(errData.detail || 'Failed to save schedule')
                                setTimeout(() => setCalendarToast(null), 2000)
                              }
                            } catch {
                              setCalendarToast('Failed to save schedule')
                              setTimeout(() => setCalendarToast(null), 2000)
                            }
                          }}
                          disabled={selectedDays.length === 0 || !scheduleTime.start || !scheduleTime.end}
                          className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save Schedule
                        </button>
                        <button
                          onClick={() => {
                            setEditingSchedule(false)
                            setSelectedDays(classSchedule.map((s) => s.day))
                            if (classSchedule.length > 0) {
                              setScheduleTime({ start: classSchedule[0].start, end: classSchedule[0].end })
                            }
                          }}
                          className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
                      {(course?.course_info?.grade_breakdown || []).filter((item) => item.component && item.weight).length > 0 ? (
                        (course?.course_info?.grade_breakdown || []).filter((item) => item.component && item.weight).map((item, index) => (
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

      {/* ── Delete-confirmation modal ───────────────────────── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Delete {confirmTarget.type === 'syllabus' ? 'syllabus' : confirmTarget.type === 'flashcard_set' ? 'flashcard deck' : confirmTarget.type === 'summary' ? 'summary' : 'quiz'}?</h2>
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{confirmTarget.label}</span>? This action cannot be undone.
            </p>

            {confirmTarget.warning && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-700 font-semibold">Warning: {confirmTarget.warning}</p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={confirmDeleting}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={confirmDeleting}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-red-600 disabled:opacity-50"
              >
                {confirmDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNamingModal && (
        <NamingStyleModal
          onCancel={() => setShowNamingModal(false)}
          onConfirm={(namingStyle) => {
            setShowNamingModal(false)
            handleSyllabusUpload(namingStyle)
          }}
        />
      )}
    </main>
  )
}
