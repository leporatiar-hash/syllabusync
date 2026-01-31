'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { jsPDF } from 'jspdf'
import { API_URL, authFetch } from '../../../hooks/useAuthFetch'

interface SummaryDetail {
  id: string
  title: string
  content: string
  created_at: string
  course_id: string
  course_name?: string | null
  course_code?: string | null
}

export default function SummaryPage() {


  const params = useParams()
  const router = useRouter()
  const summaryId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [summary, setSummary] = useState<SummaryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const loadSummary = async () => {
      if (!summaryId) return
      try {
        setLoading(true)
        const res = await authFetch(`${API_URL}/summaries/${summaryId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load summary')
        const data = await res.json()
        setSummary(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load summary')
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [summaryId])

  const courseLabel = useMemo(() => {
    if (!summary) return ''
    return summary.course_code
      ? `${summary.course_code} - ${summary.course_name || ''}`.trim()
      : summary.course_name || ''
  }, [summary])

  const handleCopy = async () => {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary.content)
      setToast('Summary copied to clipboard.')
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('Failed to copy summary.')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const handleDelete = async () => {
    if (!summary) return
    if (!confirm('Delete this summary?')) return
    try {
      const res = await authFetch(`${API_URL}/summaries/${summary.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to delete summary')
      setToast('Summary deleted.')
      setTimeout(() => {
        setToast(null)
        router.push('/flashcards')
      }, 1200)
    } catch {
      setToast('Failed to delete summary.')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const handleDownload = () => {
    if (!summary) return
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 40
    const maxWidth = 520
    const title = summary.title
    const lines = doc.splitTextToSize(summary.content, maxWidth)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(title, margin, 60)

    if (courseLabel) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(courseLabel, margin, 80)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(lines, margin, 110)

    doc.save(`${summary.title.replace(/\s+/g, '_') || 'summary'}.pdf`)
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-10">
      <div className="mx-auto w-full max-w-[900px]">
        <Link
          href="/flashcards"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B8DEF] transition-all duration-300 hover:text-[#4C7FE6]"
        >
          ← Back to Flashcards
        </Link>

        {loading ? (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm text-sm text-slate-500">
            Loading summary...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm text-sm text-red-600">
            {error}
          </div>
        ) : summary ? (
          <div className="mt-8 rounded-3xl bg-white p-10 shadow-sm">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">{summary.title}</h1>
              {courseLabel && (
                <p className="mt-2 text-sm text-slate-500">{courseLabel}</p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {new Date(summary.created_at).toLocaleString()}
              </p>
            </div>

            <div className="mt-8 space-y-4 text-slate-700 leading-relaxed">
              <ReactMarkdown
                components={{
                  h3: ({ node, ...props }) => (
                    <h3 className="text-lg font-semibold text-slate-900 mt-6" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-slate-900" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-6 space-y-1" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="text-sm text-slate-700" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="text-sm text-slate-700" {...props} />
                  ),
                }}
              >
                {summary.content}
              </ReactMarkdown>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownload}
                className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                Download PDF
              </button>
              <button
                onClick={handleCopy}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition-all duration-300 hover:border-slate-300"
              >
                Copy to clipboard
              </button>
              <button
                onClick={handleDelete}
                className="rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:border-red-300"
              >
                Delete summary
              </button>
            </div>
          </div>
        ) : null}
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
