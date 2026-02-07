'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch'
import { useAuth } from '../../../lib/useAuth'

interface QuizQuestion {
  id: string
  question: string
  options: string[]
}

interface QuizDetail {
  id: string
  name: string
  course_id: string
  question_count: number
  questions: QuizQuestion[]
}

interface QuizResultItem {
  question_id: string
  question: string
  options: string[]
  user_answer: string
  correct_answer: string
  is_correct: boolean
  explanation: string | null
}

interface QuizResults {
  quiz_id: string
  quiz_name: string
  score: number
  total: number
  percentage: number
  results: QuizResultItem[]
}

export default function QuizPage() {
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const params = useParams()
  const router = useRouter()
  const quizId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [quiz, setQuiz] = useState<QuizDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<QuizResults | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) return
      try {
        setLoading(true)
        const res = await fetchWithAuth(`${API_URL}/quizzes/${quizId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load quiz')
        const data = await res.json()
        setQuiz(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz')
      } finally {
        setLoading(false)
      }
    }

    loadQuiz()
  }, [quizId])

  const canSubmit = useMemo(() => {
    if (!quiz) return false
    return quiz.questions.length > 0 && quiz.questions.every(q => answers[q.id])
  }, [quiz, answers])

  const handleSubmit = async () => {
    if (!quizId || !quiz) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`${API_URL}/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) throw new Error('Failed to submit quiz')
      const data = await res.json()
      setResults(data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!quiz || !quizId) return
    if (!confirm('Delete this quiz?')) return
    try {
      const res = await fetchWithAuth(`${API_URL}/quizzes/${quizId}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to delete quiz')
      setToast('Quiz deleted.')
      setTimeout(() => router.push('/flashcards'), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quiz')
    }
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-10">
      {toast && (
        <div className="fixed right-4 top-20 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg toast-slide-in">
          {toast}
        </div>
      )}

      <div className="mx-auto w-full max-w-[900px]">
        <Link
          href="/flashcards"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B8DEF] transition-all duration-300 hover:text-[#4C7FE6]"
        >
          ← Back to Flashcards
        </Link>

        {loading ? (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm text-sm text-slate-500">
            Loading quiz...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm text-sm text-red-600">
            {error}
          </div>
        ) : quiz ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">{quiz.name}</h1>
                  <p className="mt-2 text-sm text-slate-500">{quiz.question_count} questions</p>
                </div>
                <button
                  onClick={handleDelete}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600 transition-all duration-300 hover:border-red-300 hover:bg-red-50"
                >
                  Delete Quiz
                </button>
              </div>

              {results && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Score: {results.score}/{results.total} ({results.percentage}%)
                </div>
              )}
            </div>

            <div className="space-y-4">
              {quiz.questions.map((q, idx) => {
                const result = results?.results.find(r => r.question_id === q.id)
                return (
                  <div key={q.id} className="rounded-3xl bg-white p-6 shadow-sm">
                    <div className="text-sm font-semibold text-slate-500">Question {idx + 1}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{q.question}</div>

                    <div className="mt-4 space-y-2">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt
                        const isCorrect = result?.correct_answer === opt
                        const isUser = result?.user_answer === opt
                        const showResult = Boolean(results)
                        const ring =
                          showResult && isCorrect
                            ? 'border-emerald-300 bg-emerald-50'
                            : showResult && isUser && !isCorrect
                              ? 'border-red-300 bg-red-50'
                              : selected
                                ? 'border-[#5B8DEF] bg-[#F0F6FF]'
                                : 'border-slate-200 bg-white'

                        return (
                          <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-slate-700 transition-all ${ring}`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt}
                              disabled={Boolean(results)}
                              checked={selected}
                              onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                              className="h-4 w-4 text-[#5B8DEF] focus:ring-[#5B8DEF]"
                            />
                            <span>{opt}</span>
                          </label>
                        )
                      })}
                    </div>

                    {results && result?.explanation && (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {result.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {!results && (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
