'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { API_URL } from '../hooks/useAuthFetch'

interface Flashcard {
  id: string
  front: string
  back: string
}

interface FlashcardSet {
  id: string
  name: string
  course_id: string
  card_count?: number
  courseName?: string
  courseCode?: string
}

interface Course {
  id: string
  name: string
  code?: string
}

interface Summary {
  id: string
  title: string
  content: string
  created_at: string
  course_id: string
  courseName?: string
  courseCode?: string
}

interface Quiz {
  id: string
  name: string
  question_count: number
  created_at: string
  course_id: string
  courseName?: string
  courseCode?: string
}

// API_URL comes from hooks/useAuthFetch

// Vibrant gradient palette for deck cards
const deckGradients = [
  'from-[#667eea] to-[#764ba2]', // Purple-violet
  'from-[#f093fb] to-[#f5576c]', // Pink-rose
  'from-[#4facfe] to-[#00f2fe]', // Blue-cyan
  'from-[#43e97b] to-[#38f9d7]', // Green-teal
  'from-[#fa709a] to-[#fee140]', // Pink-yellow
  'from-[#a8edea] to-[#fed6e3]', // Soft teal-pink
  'from-[#ff9a9e] to-[#fecfef]', // Soft pink
  'from-[#ffecd2] to-[#fcb69f]', // Peach
]

function FlashcardsContent() {


  const searchParams = useSearchParams()
  const setIdParam = searchParams.get('set')

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(setIdParam)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'browse' | 'study'>('browse')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [generateFlashcards, setGenerateFlashcards] = useState(true)
  const [generateQuiz, setGenerateQuiz] = useState(true)
  const [generateSummary, setGenerateSummary] = useState(true)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const current = useMemo(() => cards[currentIndex], [cards, currentIndex])

  // Load all courses and their flashcard sets
  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/courses`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCourses(data)

        // Extract all flashcard sets, summaries, quizzes from courses
        const allSets: FlashcardSet[] = []
        const allSummaries: Summary[] = []
        const allQuizzes: Quiz[] = []
        for (const course of data) {
          const courseRes = await fetch(`${API_URL}/courses/${course.id}`, { cache: 'no-store' })
          if (courseRes.ok) {
            const courseData = await courseRes.json()
            if (courseData.flashcard_sets) {
              for (const set of courseData.flashcard_sets) {
                allSets.push({
                  ...set,
                  course_id: course.id,
                  courseName: course.name,
                  courseCode: course.code,
                })
              }
            }
            if (courseData.summaries) {
              for (const summary of courseData.summaries) {
                allSummaries.push({
                  ...summary,
                  course_id: course.id,
                  courseName: course.name,
                  courseCode: course.code,
                })
              }
            }
            if (courseData.quizzes) {
              for (const quiz of courseData.quizzes) {
                allQuizzes.push({
                  ...quiz,
                  course_id: course.id,
                  courseName: course.name,
                  courseCode: course.code,
                })
              }
            }
          }
        }
        setFlashcardSets(allSets)
        setSummaries(allSummaries)
        setQuizzes(allQuizzes)

        if (!selectedCourseId && data.length > 0) {
          setSelectedCourseId(data[0].id)
        }

        if (setIdParam && allSets.find(s => s.id === setIdParam)) {
          setSelectedSetId(setIdParam)
        }
      }
    } catch (err) {
      console.error('Failed to load flashcard sets:', err)
      setError('Failed to load flashcard sets. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        await loadData()
      } catch (err) {
        console.error('Failed to load flashcard sets:', err)
        setError('Failed to load flashcard sets. Make sure the backend is running.')
      }
    }

    load()
  }, [setIdParam])

  // Load flashcards when a set is selected
  useEffect(() => {
    if (!selectedSetId) {
      setCards([])
      return
    }

    const loadFlashcards = async () => {
      try {
        setLoadingCards(true)
        setError(null)
        console.log('[Flashcards] Loading set:', selectedSetId)
        const res = await fetch(`${API_URL}/flashcard-sets/${selectedSetId}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          console.log('[Flashcards] Loaded:', data.flashcards?.length, 'cards')
          setCards(data.flashcards || [])
          setCurrentIndex(0)
          setFlipped(false)
        } else {
          throw new Error('Failed to load flashcards')
        }
      } catch (err) {
        console.error('Failed to load flashcards:', err)
        setError('Failed to load flashcards')
        setCards([])
      } finally {
        setLoadingCards(false)
      }
    }

    loadFlashcards()
  }, [selectedSetId])

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setCurrentIndex(0)
    setFlipped(false)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cards.length === 0) return

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.code === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1)
        setFlipped(false)
      } else if (e.code === 'ArrowRight' && currentIndex < cards.length - 1) {
        setCurrentIndex((i) => i + 1)
        setFlipped(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cards.length, currentIndex])

  const handleSelectSet = (setId: string) => {
    setSelectedSetId(setId)
    // Update URL without navigation
    window.history.pushState({}, '', `/flashcards?set=${setId}`)
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) return
    const maxSize = 10 * 1024 * 1024
    const ext = file.name.toLowerCase().split('.').pop() || ''
    const allowed = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']
    if (!allowed.includes(ext)) {
      setUploadError('Supported formats: PDF, DOCX, TXT, PNG, JPG')
      return
    }
    if (file.size > maxSize) {
      setUploadError('File must be under 10MB')
      return
    }
    setUploadError(null)
    setUploadFile(file)
  }

  const handleGenerate = async () => {
    if (!uploadFile) return
    if (!selectedCourseId) {
      setUploadError('Select a course first.')
      return
    }
    setUploadLoading(true)
    setUploadError(null)

    const filename = uploadFile.name.toLowerCase()
    const ext = filename.split('.').pop() || ''
    const flashcardExts = ['pdf', 'txt']
    const summaryExts = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']

    try {
      const actions: Promise<Response>[] = []
      const errors: string[] = []

      const upload = (endpoint: string) => {
        const formData = new FormData()
        formData.append('file', uploadFile)
        return fetch(endpoint, { method: 'POST', body: formData, cache: 'no-store' })
      }

      if (generateFlashcards) {
        if (!flashcardExts.includes(ext)) {
          errors.push('Flashcards support PDF or TXT files.')
        } else {
          actions.push(upload(`${API_URL}/courses/${selectedCourseId}/flashcards`))
        }
      }

      if (generateQuiz) {
        if (!flashcardExts.includes(ext)) {
          errors.push('Quiz generation supports PDF or TXT files.')
        } else {
          actions.push(upload(`${API_URL}/courses/${selectedCourseId}/generate-quiz`))
        }
      }

      if (generateSummary) {
        if (!summaryExts.includes(ext)) {
          errors.push('Summaries support PDF, DOCX, TXT, or image files.')
        } else {
          actions.push(upload(`${API_URL}/courses/${selectedCourseId}/summaries`))
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

      setToast('Study tools generated successfully.')
      setUploadFile(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
      await loadData()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to generate study tools')
    } finally {
      setUploadLoading(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleDeleteSummary = async (summaryId: string) => {
    if (!confirm('Delete this summary?')) return
    try {
      const res = await fetch(`${API_URL}/summaries/${summaryId}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error('Failed to delete summary')
      }
      setSummaries((prev) => prev.filter((s) => s.id !== summaryId))
      setToast('Summary deleted.')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      console.error('Failed to delete summary:', err)
      setUploadError('Failed to delete summary')
    }
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-10">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Header */}
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Flashcard Studio</h1>
          <p className="mt-2 text-sm text-slate-600">
            Select a deck to study or <Link href="/courses" className="text-[#5B8DEF] hover:underline">generate flashcards from a course</Link>.
          </p>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
              <button
                onClick={() => window.location.reload()}
                className="ml-2 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <button
                onClick={() => setMode('browse')}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                  mode === 'browse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Browse
              </button>
              <button
                onClick={() => setMode('study')}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                  mode === 'study' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Study
              </button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 focus:border-[#5B8DEF] focus:outline-none"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code ? `${course.code} - ${course.name}` : course.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mode === 'study' && (
          <>
          {/* Upload Area */}
          <div className="mt-6">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              className="hidden"
              id="flashcards-upload"
            />

            {!uploadFile ? (
              <label
                htmlFor="flashcards-upload"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFileSelect(e.dataTransfer.files?.[0] || null)
                }}
                className="mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 5v8M8 9l4-4 4 4" />
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-700">Drop file here or click to browse</p>
                <p className="mt-1 text-xs text-slate-400">PDF, DOCX, TXT, PNG, JPG (max 10MB)</p>
              </label>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0EAFF] text-[#5B8DEF]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{uploadFile.name}</p>
                    <p className="text-xs text-slate-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => {
                      setUploadFile(null)
                      if (uploadInputRef.current) uploadInputRef.current.value = ''
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
                    <span className="font-medium text-slate-900">Summary Notes</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">AI-generated study summaries</p>
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!uploadFile || uploadLoading || (!generateFlashcards && !generateQuiz && !generateSummary)}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadLoading ? 'Generating...' : 'Generate Study Tools'}
          </button>

          {uploadLoading && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA]" />
            </div>
          )}

          {uploadError && (
            <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}
          </>
          )}

          {/* Flashcard Set Selector */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Your Decks</h3>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : flashcardSets.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF]">
                  <svg className="h-10 w-10 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No flashcard decks yet</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
                  Upload study materials to a course and generate flashcards with AI to start studying.
                </p>
                <Link
                  href="/courses"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Generate Flashcards
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {flashcardSets.map((set, index) => {
                  const gradient = deckGradients[index % deckGradients.length]
                  const isSelected = selectedSetId === set.id
                  return (
                    <button
                      key={set.id}
                      onClick={() => handleSelectSet(set.id)}
                      className={`group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                        isSelected ? 'ring-2 ring-[#5B8DEF] ring-offset-2 shadow-lg' : 'shadow-md'
                      }`}
                    >
                      {/* Gradient background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />

                      {/* Content */}
                      <div className="relative z-10">
                        <div className="text-base font-bold text-white drop-shadow-sm">
                          {set.name}
                        </div>

                        {set.courseCode && (
                          <div className="mt-2 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                            {set.courseCode}
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-1.5 text-white/90">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="text-sm font-semibold">{set.card_count || 0} cards</span>
                        </div>
                      </div>

                      {/* Decorative elements */}
                      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110" />
                      <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-white/10" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {mode === 'study' && (summaries.length > 0 || quizzes.length > 0) && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Your Study Tools</h3>
              <div className="space-y-4">
                {summaries.map((summary) => (
                  <div key={summary.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <span>📝</span>
                          {summary.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {summary.courseCode ? `${summary.courseCode} - ${summary.courseName}` : summary.courseName}
                        </div>
                        <div className="mt-2 text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">
                          {summary.content}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/summaries/${summary.id}`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-all duration-300 hover:border-slate-300"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDeleteSummary(summary.id)}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 transition-all duration-300 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <span>❓</span>
                          {quiz.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {quiz.courseCode ? `${quiz.courseCode} - ${quiz.courseName}` : quiz.courseName}
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          {quiz.question_count} questions
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Review Section */}
        {mode === 'study' && selectedSetId && (
          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {flashcardSets.find(s => s.id === selectedSetId)?.name || 'Review deck'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Click the card to flip it. Stay in rhythm with quick flips.</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {cards.length > 0 && (
                  <>
                    {/* Progress indicator */}
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] transition-all duration-300"
                          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                        />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                        {currentIndex + 1} / {cards.length}
                      </span>
                    </div>
                    <button
                      onClick={handleShuffle}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Shuffle
                    </button>
                    <button
                      onClick={() => {
                        setCurrentIndex(0)
                        setFlipped(false)
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center">
              {loadingCards ? (
                <div className="flex h-72 w-full max-w-xl items-center justify-center rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading flashcards...
                  </div>
                </div>
              ) : cards.length === 0 ? (
                <div className="flex h-72 w-full max-w-xl flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                  <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="mt-4 text-sm font-medium text-slate-600">No cards in this deck yet</p>
                  <p className="mt-1 text-xs text-slate-400">Add study materials to the course to generate cards</p>
                </div>
              ) : current ? (
                <>
                  {/* 3D Flip Card - Click to flip */}
                  <div
                    className="w-full max-w-xl cursor-pointer"
                    style={{ perspective: '1000px' }}
                    onClick={() => setFlipped(!flipped)}
                  >
                    <div
                      className="relative h-80 w-full transition-transform duration-500"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                      }}
                    >
                      {/* Front of card */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-xl border border-slate-100"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="absolute top-4 left-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          Question
                        </div>
                        <div className="text-center text-xl font-semibold text-slate-900 leading-relaxed">
                          {current.front}
                        </div>
                        <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-slate-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                          Click to reveal answer
                        </div>
                      </div>
                      {/* Back of card */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 shadow-xl"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <div className="absolute top-4 left-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                          Answer
                        </div>
                        <div className="text-center text-xl font-semibold text-white leading-relaxed">
                          {current.back}
                        </div>
                        <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-white/70">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                          Click to see question
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <button
                      onClick={() => {
                        setCurrentIndex(Math.max(0, currentIndex - 1))
                        setFlipped(false)
                      }}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-2 rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        setCurrentIndex(Math.min(cards.length - 1, currentIndex + 1))
                        setFlipped(false)
                      }}
                      disabled={currentIndex === cards.length - 1}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                    >
                      Next
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Keyboard hint */}
                  <p className="mt-4 text-xs text-slate-400">
                    Tip: Use <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> to flip, <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">←</kbd> <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">→</kbd> to navigate
                  </p>
                </>
              ) : null}
            </div>
          </section>
        )}

        {/* Empty state when no set is selected */}
        {mode === 'study' && !selectedSetId && !loading && flashcardSets.length > 0 && (
          <section className="rounded-3xl bg-gradient-to-br from-slate-50 to-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Ready to study?</h3>
            <p className="mt-2 text-sm text-slate-500">Select a deck above to start reviewing flashcards.</p>
          </section>
        )}
      </div>

      {toast && (
        <div className="fixed right-6 top-24 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg border border-slate-100">
            {toast}
          </div>
        </div>
      )}
    </main>
  )
}

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 pb-20 pt-10"><div className="mx-auto max-w-5xl"><div className="rounded-3xl bg-white p-8 shadow-sm"><p className="text-slate-500">Loading...</p></div></div></div>}>
      <FlashcardsContent />
    </Suspense>
  )
}
