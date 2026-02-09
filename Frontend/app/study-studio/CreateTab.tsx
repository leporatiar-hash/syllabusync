'use client'

import { useRef, useState } from 'react'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'

interface CreateTabProps {
  courses: any[]
  onSuccess: () => void
}

export default function CreateTab({ courses, onSuccess }: CreateTabProps) {
  const { fetchWithAuth } = useAuthFetch()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [generateFlashcards, setGenerateFlashcards] = useState(true)
  const [generateQuiz, setGenerateQuiz] = useState(false)
  const [generateSummary, setGenerateSummary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const processFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExts = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']

    if (!ext || !allowedExts.includes(ext)) {
      setError('Supported formats: PDF, DOCX, TXT, PNG, JPG (max 10MB)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large (max 10 MB)')
      return
    }

    if (!selectedCourse) {
      setError('Please select a course first')
      return
    }

    if (!generateFlashcards && !generateQuiz && !generateSummary) {
      setError('Please select at least one option to generate')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Generate flashcards
      if (generateFlashcards) {
        const flashcardsRes = await fetchWithAuth(
          `${API_URL}/courses/${selectedCourse}/generate-flashcards`,
          {
            method: 'POST',
            body: formData.get('file') as Blob,
            cache: 'no-store',
          }
        )
        if (!flashcardsRes.ok) {
          const data = await flashcardsRes.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to generate flashcards')
        }
      }

      // Generate quiz
      if (generateQuiz) {
        const quizFormData = new FormData()
        quizFormData.append('file', file)
        const quizRes = await fetchWithAuth(
          `${API_URL}/courses/${selectedCourse}/generate-quiz`,
          {
            method: 'POST',
            body: quizFormData,
            cache: 'no-store',
          }
        )
        if (!quizRes.ok) {
          const data = await quizRes.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to generate quiz')
        }
      }

      // Generate summary
      if (generateSummary) {
        const summaryFormData = new FormData()
        summaryFormData.append('file', file)
        const summaryRes = await fetchWithAuth(
          `${API_URL}/courses/${selectedCourse}/generate-summary`,
          {
            method: 'POST',
            body: summaryFormData,
            cache: 'no-store',
          }
        )
        if (!summaryRes.ok) {
          const data = await summaryRes.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to generate summary')
        }
      }

      // Success!
      onSuccess()
      setSelectedCourse('')
      setGenerateFlashcards(true)
      setGenerateQuiz(false)
      setGenerateSummary(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setUploading(false)
    }
  }

  const canGenerate = selectedCourse && (generateFlashcards || generateQuiz || generateSummary) && !uploading

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          dragOver
            ? 'border-[#5B8DEF] bg-[#EEF2FF]/60 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${dragOver ? 'bg-[#5B8DEF]/10' : 'bg-[#EEF2FF]'}`}>
          <svg viewBox="0 0 24 24" className={`h-8 w-8 transition-colors ${dragOver ? 'text-[#5B8DEF]' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">
            {uploading ? 'Generating...' : dragOver ? 'Drop file here' : 'Drop file here or click to browse'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            PDF, DOCX, TXT, PNG, JPG (max 10MB)
          </p>
        </div>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/80">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5B8DEF] border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Generation Options */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          What would you like to generate?
        </h3>
        <div className="space-y-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${generateFlashcards ? 'border-[#5B8DEF] bg-[#F0F6FF]' : 'border-slate-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={generateFlashcards}
              onChange={(e) => setGenerateFlashcards(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#5B8DEF] focus:ring-[#5B8DEF]"
            />
            <div>
              <div className="font-semibold text-slate-900">Flashcards</div>
              <div className="text-sm text-slate-500">Generate 10-20 question/answer cards</div>
            </div>
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${generateQuiz ? 'border-[#5B8DEF] bg-[#F0F6FF]' : 'border-slate-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={generateQuiz}
              onChange={(e) => setGenerateQuiz(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#5B8DEF] focus:ring-[#5B8DEF]"
            />
            <div>
              <div className="font-semibold text-slate-900">Mini Quiz</div>
              <div className="text-sm text-slate-500">Generate 5-10 multiple choice questions</div>
            </div>
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${generateSummary ? 'border-[#5B8DEF] bg-[#F0F6FF]' : 'border-slate-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={generateSummary}
              onChange={(e) => setGenerateSummary(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#5B8DEF] focus:ring-[#5B8DEF]"
            />
            <div>
              <div className="font-semibold text-slate-900">Summary Notes</div>
              <div className="text-sm text-slate-500">AI-generated study summaries</div>
            </div>
          </label>
        </div>
      </div>

      {/* Course Selector */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <label htmlFor="course-select" className="mb-3 block text-sm font-semibold uppercase tracking-wider text-slate-500">
          Save to course:
        </label>
        <select
          id="course-select"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 transition-all focus:border-[#5B8DEF] focus:outline-none focus:ring-2 focus:ring-[#5B8DEF]/20"
        >
          <option value="">Select a course...</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code ? `${course.code} - ${course.name}` : course.name}
            </option>
          ))}
        </select>
      </div>

      {/* Generate Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={!canGenerate}
        className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-4 text-base font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {uploading ? 'Generating Study Tools...' : 'Generate Study Tools'}
      </button>
    </div>
  )
}
