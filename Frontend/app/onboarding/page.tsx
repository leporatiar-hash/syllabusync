'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Sparkles, PlusCircle, FileUp, BookOpen, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'

const CanvasConnectModal = dynamic(() => import('../../components/CanvasConnectModal'), { ssr: false })
const ICalConnectModal = dynamic(() => import('../../components/ICalConnectModal'), { ssr: false })

type Path = 'select' | 'quick-setup' | 'add-course' | 'upload-syllabus' | 'upload-material'

const schoolTypes = ['High School', 'Community College', 'University', 'Graduate School']
const academicYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD']
const terms = ['Spring 2026', 'Summer 2026', 'Fall 2026', 'Winter 2027']

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [path, setPath] = useState<Path>('select')

  // Quick Setup state
  const [qsStep, setQsStep] = useState(0)
  const [schoolName, setSchoolName] = useState('')
  const [term, setTerm] = useState('')
  const [courseCount, setCourseCount] = useState(3)
  const [courseNames, setCourseNames] = useState<string[]>(['', '', ''])
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [showICalModal, setShowICalModal] = useState(false)
  const [schoolType, setSchoolType] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [major, setMajor] = useState('')
  const [qsLoading, setQsLoading] = useState(false)

  // Add Course state
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formSemester, setFormSemester] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Syllabus Upload state
  const syllabusInputRef = useRef<HTMLInputElement>(null)
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const uploadDragCount = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Study Material state
  const materialInputRef = useRef<HTMLInputElement>(null)
  const [materialDragOver, setMaterialDragOver] = useState(false)
  const materialDragCount = useRef(0)
  const [materialUploading, setMaterialUploading] = useState(false)
  const [materialError, setMaterialError] = useState<string | null>(null)
  const [generateFlashcards, setGenerateFlashcards] = useState(true)
  const [generateQuiz, setGenerateQuiz] = useState(false)
  const [generateSummary, setGenerateSummary] = useState(false)
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [materialSaving, setMaterialSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
      </main>
    )
  }

  const completeOnboarding = async () => {
    try {
      await fetchWithAuth(`${API_URL}/me/complete-onboarding`, { method: 'POST' })
    } catch {
      // non-fatal
    }
  }

  const handleSkip = async () => {
    await completeOnboarding()
    router.push('/home')
  }

  // ── Quick Setup handlers ──

  const handleCourseCountChange = (n: number) => {
    const clamped = Math.max(1, Math.min(6, n))
    setCourseCount(clamped)
    setCourseNames((prev) => {
      const next = [...prev]
      while (next.length < clamped) next.push('')
      return next.slice(0, clamped)
    })
  }

  const handleQsSubmit = async () => {
    setQsLoading(true)
    try {
      // Save profile info
      await fetchWithAuth(`${API_URL}/me/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: schoolName || undefined,
          school_type: schoolType || undefined,
          academic_year: academicYear || undefined,
          major: major || undefined,
        }),
      })

      // Create courses (up to 3 for free tier)
      const toCreate = courseNames.filter((n) => n.trim()).slice(0, 3)
      for (const name of toCreate) {
        await fetchWithAuth(`${API_URL}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), semester: term || null }),
        })
      }

      await completeOnboarding()
      router.push('/home')
    } catch {
      // still redirect on error
      await completeOnboarding()
      router.push('/home')
    } finally {
      setQsLoading(false)
    }
  }

  // ── Add Course handler ──

  const handleCreateCourse = async () => {
    if (!formName.trim()) {
      setFormError('Course name is required.')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim() || null,
          semester: formSemester.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to create course')
      }
      await completeOnboarding()
      router.push('/home')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create course')
    } finally {
      setCreating(false)
    }
  }

  // ── Syllabus Upload handlers ──

  const preventDefault = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }

  const submitSyllabus = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') {
      setUploadError('Only PDF or Word (.docx) files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large (max 10 MB).')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetchWithAuth(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to process syllabus')
      }
      const data = await res.json()
      await completeOnboarding()
      if (data.course?.id) {
        router.push(`/courses/${data.course.id}`)
      } else {
        router.push('/home')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (syllabusInputRef.current) syllabusInputRef.current.value = ''
    }
  }

  // ── Study Material handlers ──

  const processStudyFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']
    if (!ext || !allowed.includes(ext)) {
      setMaterialError('Supported: PDF, DOCX, TXT, PNG, JPG (max 25MB)')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setMaterialError('File is too large (max 25 MB)')
      return
    }
    setMaterialError(null)
    setMaterialFile(file)
  }

  const handleMaterialGenerate = async () => {
    if (!materialFile) return
    if (!generateFlashcards && !generateQuiz && !generateSummary) {
      setMaterialError('Select at least one option to generate')
      return
    }
    setMaterialSaving(true)
    setMaterialError(null)
    try {
      // Create a temporary course first
      const courseRes = await fetchWithAuth(`${API_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: materialFile.name.replace(/\.[^.]+$/, '') || 'My Course' }),
      })
      if (!courseRes.ok) {
        const data = await courseRes.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to create course')
      }
      const course = await courseRes.json()
      const courseId = course.id

      // Generate selected tools
      if (generateFlashcards) {
        const fd = new FormData()
        fd.append('file', materialFile)
        await fetchWithAuth(`${API_URL}/courses/${courseId}/flashcards`, { method: 'POST', body: fd })
      }
      if (generateQuiz) {
        const fd = new FormData()
        fd.append('file', materialFile)
        await fetchWithAuth(`${API_URL}/courses/${courseId}/generate-quiz`, { method: 'POST', body: fd })
      }
      if (generateSummary) {
        const fd = new FormData()
        fd.append('file', materialFile)
        await fetchWithAuth(`${API_URL}/courses/${courseId}/summaries`, { method: 'POST', body: fd })
      }

      await completeOnboarding()
      router.push(`/courses/${courseId}`)
    } catch (err) {
      setMaterialError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setMaterialSaving(false)
    }
  }

  // ── Render ──

  const progressBar = (step: number, total: number) => (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= step ? 'bg-[#5B8DEF]' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )

  const backButton = () => (
    <button
      onClick={() => {
        if (path === 'select') return
        if (path === 'quick-setup' && qsStep > 0) {
          setQsStep(qsStep - 1)
          return
        }
        setPath('select')
      }}
      className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
    >
      <ChevronLeft size={16} />
      Back
    </button>
  )

  return (
    <main className="min-h-screen px-4 pb-16 pt-8 bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
      <div className="mx-auto max-w-lg">

        {/* ── Path Selection ── */}
        {path === 'select' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!
              </h1>
              <p className="mt-2 text-sm text-slate-500">Get set up in 60 seconds — pick a path to start</p>
            </div>

            <div className="grid gap-3">
              {[
                { id: 'quick-setup' as Path, icon: Sparkles, title: 'Quick Setup', subtitle: 'Answer a few questions — we\'ll build your dashboard', recommended: true },
                { id: 'add-course' as Path, icon: PlusCircle, title: 'Add a Course', subtitle: 'Enter course name, code, and schedule' },
                { id: 'upload-syllabus' as Path, icon: FileUp, title: 'Upload a Syllabus', subtitle: 'Best accuracy for deadlines & policies' },
                { id: 'upload-material' as Path, icon: BookOpen, title: 'Upload Study Material', subtitle: 'Get instant flashcards or quizzes from your notes' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPath(opt.id)}
                  className="relative flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#5B8DEF]/40"
                >
                  {opt.recommended && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-[#5B8DEF] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      Recommended
                    </span>
                  )}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B8DEF]">
                    <opt.icon size={20} />
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">{opt.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-500">{opt.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleSkip}
              className="mt-6 block w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip for now &rarr;
            </button>
          </>
        )}

        {/* ── Quick Setup ── */}
        {path === 'quick-setup' && (
          <>
            {backButton()}
            {progressBar(qsStep, 4)}

            {/* Step 1: School & Term */}
            {qsStep === 0 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-slate-900">Where do you go to school?</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">School / University</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. University of Michigan"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Current term</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  >
                    <option value="">Select term...</option>
                    {terms.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => setQsStep(1)}
                  className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Courses */}
            {qsStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-slate-900">What courses are you taking?</h2>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Number of courses</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleCourseCountChange(courseCount - 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      -
                    </button>
                    <span className="text-2xl font-bold text-slate-900">{courseCount}</span>
                    <button
                      onClick={() => handleCourseCountChange(courseCount + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {courseNames.map((name, i) => (
                    <div key={i}>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const next = [...courseNames]
                          next[i] = e.target.value
                          setCourseNames(next)
                        }}
                        placeholder={`Course ${i + 1} name`}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                      />
                      {i >= 3 && (
                        <p className="mt-1 text-xs text-amber-600">
                          Free plan includes 3 courses. Upgrade to Pro for more.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setQsStep(2)}
                  className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 3: Connect LMS */}
            {qsStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-slate-900">Connect your school&apos;s LMS?</h2>
                <p className="text-sm text-slate-500">Sync assignments and deadlines automatically. You can always do this later.</p>
                <div className="grid gap-3">
                  <button
                    onClick={() => setShowCanvasModal(true)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#5B8DEF]/40 hover:shadow-sm"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 text-lg font-bold">C</span>
                    <div>
                      <span className="font-semibold text-slate-900">Connect Canvas</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Sync from Canvas LMS</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setShowICalModal(true)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#5B8DEF]/40 hover:shadow-sm"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500 text-lg font-bold">iC</span>
                    <div>
                      <span className="font-semibold text-slate-900">Connect iCal</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Sync from any iCal feed</span>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => setQsStep(3)}
                  className="w-full rounded-full border-2 border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
                >
                  Not now — continue
                </button>

                {showCanvasModal && (
                  <CanvasConnectModal
                    onClose={() => setShowCanvasModal(false)}
                    onSuccess={() => {
                      setShowCanvasModal(false)
                      setQsStep(3)
                    }}
                  />
                )}
                {showICalModal && (
                  <ICalConnectModal
                    onClose={() => setShowICalModal(false)}
                    onSuccess={() => {
                      setShowICalModal(false)
                      setQsStep(3)
                    }}
                  />
                )}
              </div>
            )}

            {/* Step 4: Profile */}
            {qsStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-slate-900">Almost done — tell us about you</h2>
                <p className="text-sm text-slate-500">All fields are optional.</p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">School Type</label>
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  >
                    <option value="">Select type...</option>
                    {schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  >
                    <option value="">Select year...</option>
                    {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Major / Field of Study</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  />
                </div>
                <button
                  onClick={handleQsSubmit}
                  disabled={qsLoading}
                  className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                >
                  {qsLoading ? 'Setting up...' : 'Finish Setup'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Add Course ── */}
        {path === 'add-course' && (
          <>
            {backButton()}
            <h2 className="text-xl font-bold text-slate-900 mb-6">Add your first course</h2>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Course name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Corporate Finance"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Course code</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. FINC 313"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Semester</label>
                <input
                  type="text"
                  value={formSemester}
                  onChange={(e) => setFormSemester(e.target.value)}
                  placeholder="e.g. Spring 2026"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <button
                onClick={handleCreateCourse}
                disabled={creating}
                className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Course & Continue'}
              </button>
            </div>
          </>
        )}

        {/* ── Upload Syllabus ── */}
        {path === 'upload-syllabus' && (
          <>
            {backButton()}
            <h2 className="text-xl font-bold text-slate-900 mb-2">Upload a syllabus</h2>
            <p className="text-sm text-slate-500 mb-6">We&apos;ll extract your course info, deadlines, and policies automatically.</p>

            <input
              ref={syllabusInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) submitSyllabus(file)
              }}
            />
            <div
              onClick={() => !uploading && syllabusInputRef.current?.click()}
              onDragEnter={(e) => { preventDefault(e); uploadDragCount.current += 1; setUploadDragOver(true) }}
              onDragLeave={(e) => { preventDefault(e); uploadDragCount.current -= 1; if (uploadDragCount.current <= 0) { uploadDragCount.current = 0; setUploadDragOver(false) } }}
              onDragOver={preventDefault}
              onDrop={(e) => { preventDefault(e); uploadDragCount.current = 0; setUploadDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) submitSyllabus(f) }}
              className={`relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                uploadDragOver
                  ? 'border-[#5B8DEF] bg-[#EEF2FF]/60 scale-[1.01]'
                  : 'border-slate-300 bg-white hover:border-slate-400'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-full ${uploadDragOver ? 'bg-[#5B8DEF]/10' : 'bg-[#EEF2FF]'}`}>
                <FileUp size={24} className={uploadDragOver ? 'text-[#5B8DEF]' : 'text-slate-400'} />
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {uploading ? 'Processing syllabus...' : uploadDragOver ? 'Drop it here!' : 'Drop syllabus here or click to browse'}
                </p>
                <p className="mt-1 text-sm text-slate-500">PDF or Word (.docx) · Max 10 MB</p>
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5B8DEF] border-t-transparent" />
                </div>
              )}
            </div>
            {uploadError && <p className="mt-3 text-sm text-red-500">{uploadError}</p>}
          </>
        )}

        {/* ── Upload Study Material ── */}
        {path === 'upload-material' && (
          <>
            {backButton()}
            <h2 className="text-xl font-bold text-slate-900 mb-2">Upload study material</h2>
            <p className="text-sm text-slate-500 mb-6">Get instant flashcards, quizzes, or summaries from your notes.</p>

            {/* Generation options */}
            <div className="space-y-3 mb-6">
              {[
                { checked: generateFlashcards, set: setGenerateFlashcards, title: 'Flashcards', desc: 'Generate 10-20 question/answer cards' },
                { checked: generateQuiz, set: setGenerateQuiz, title: 'Mini Quiz', desc: 'Generate 5-10 multiple choice questions' },
                { checked: generateSummary, set: setGenerateSummary, title: 'Summary Notes', desc: 'AI-generated study summaries' },
              ].map((opt) => (
                <label
                  key={opt.title}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${
                    opt.checked ? 'border-[#5B8DEF] bg-[#F0F6FF]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.set(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#5B8DEF] focus:ring-[#5B8DEF]"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">{opt.title}</div>
                    <div className="text-sm text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* File upload */}
            {!materialFile ? (
              <>
                <input
                  ref={materialInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processStudyFile(f) }}
                />
                <div
                  onClick={() => materialInputRef.current?.click()}
                  onDragEnter={(e) => { preventDefault(e); materialDragCount.current += 1; setMaterialDragOver(true) }}
                  onDragLeave={(e) => { preventDefault(e); materialDragCount.current -= 1; if (materialDragCount.current <= 0) { materialDragCount.current = 0; setMaterialDragOver(false) } }}
                  onDragOver={preventDefault}
                  onDrop={(e) => { preventDefault(e); materialDragCount.current = 0; setMaterialDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processStudyFile(f) }}
                  className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                    materialDragOver
                      ? 'border-[#5B8DEF] bg-[#EEF2FF]/60 scale-[1.01]'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full ${materialDragOver ? 'bg-[#5B8DEF]/10' : 'bg-[#EEF2FF]'}`}>
                    <BookOpen size={24} className={materialDragOver ? 'text-[#5B8DEF]' : 'text-slate-400'} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {materialDragOver ? 'Drop it here!' : 'Drop file here or click to browse'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">PDF, DOCX, TXT, PNG, JPG (max 25MB)</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B8DEF]">
                    <BookOpen size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{materialFile.name}</p>
                    <p className="text-xs text-slate-400">{(materialFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    onClick={() => setMaterialFile(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Remove
                  </button>
                </div>
                <button
                  onClick={handleMaterialGenerate}
                  disabled={materialSaving}
                  className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                >
                  {materialSaving ? 'Generating...' : 'Generate & Continue'}
                </button>
              </div>
            )}
            {materialError && <p className="mt-3 text-sm text-red-500">{materialError}</p>}
          </>
        )}
      </div>
    </main>
  )
}
