'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CourseInfo {
  instructor?: { name?: string | null }
  logistics?: { meeting_times?: string | null }
}

interface Course {
  id: string
  name: string
  code?: string
  semester: string
  deadline_count?: number
  course_info?: CourseInfo | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const gradients = [
  'from-[#E0EAFF] to-[#F5F7FF]',
  'from-[#E6FFFB] to-[#ECFEFF]',
  'from-[#F5E9FF] to-[#FDF2F8]',
  'from-[#FFF7ED] to-[#FEF3C7]',
  'from-[#ECFDF5] to-[#E0F2FE]',
  'from-[#F1F5F9] to-[#E2E8F0]',
]

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formSemester, setFormSemester] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSemester, setEditSemester] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch(`${API_URL}/courses`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setCourses(data)
        }
      } catch (err) {
        console.error('Failed to load courses:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [])

  const handleCreate = async () => {
    if (!formName.trim()) {
      setFormError('Course name is required.')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const url = `${API_URL}/courses`
      console.log('[Create Course] Sending request to:', url)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim() || null,
          semester: formSemester.trim() || null,
        }),
        cache: 'no-store',
      })

      console.log('[Create Course] Response status:', res.status)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[Create Course] Error response:', data)
        throw new Error(data.detail || 'Failed to create course')
      }

      const created = await res.json()
      console.log('[Create Course] Created:', created)
      setCourses([created, ...courses])
      setFormName('')
      setFormCode('')
      setFormSemester('')
      setShowModal(false)
      setToastMessage('Course created successfully!')
      setToastType('success')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
    } catch (err) {
      console.error('[Create Course] Error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to create course'
      setFormError(errorMsg)
      // Also show a toast for network errors
      if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        setToastMessage('Cannot connect to server. Make sure the backend is running.')
        setToastType('error')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 4000)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!courseToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_URL}/courses/${courseToDelete.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete course')
      }
      setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id))
      setToastMessage('Course deleted successfully.')
      setToastType('success')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
      setCourseToDelete(null)
    } catch (err) {
      console.error('[Delete Course] Error:', err)
      setToastMessage('Failed to delete course.')
      setToastType('error')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setDeleting(false)
    }
  }

  const openEditModal = (course: Course) => {
    setCourseToEdit(course)
    setEditName(course.name)
    setEditCode(course.code || '')
    setEditSemester(course.semester || '')
    setEditError(null)
  }

  const handleEdit = async () => {
    if (!courseToEdit) return
    if (!editName.trim()) {
      setEditError('Course name is required.')
      return
    }
    setEditing(true)
    try {
      const res = await fetch(`${API_URL}/courses/${courseToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || null,
          semester: editSemester.trim() || null,
        }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to update course')
      }
      const updated = await res.json()
      setCourses((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      setCourseToEdit(null)
      setToastMessage('Course updated successfully.')
      setToastType('success')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update course'
      setEditError(errorMsg)
    } finally {
      setEditing(false)
    }
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Courses</h1>
            <p className="mt-2 text-sm text-slate-600">Your syllabi, deadlines, and study materials in one place.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
          >
            + Add Course
          </button>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, index) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className={`group relative flex min-h-[180px] flex-col justify-between rounded-2xl bg-gradient-to-br ${gradients[index % gradients.length]} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {course.code || 'Course'}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{course.name}</div>
                  {(course.course_info?.instructor?.name || course.course_info?.logistics?.meeting_times) && (
                    <div className="mt-1.5 space-y-0.5">
                      {course.course_info?.instructor?.name && (
                        <p className="text-xs text-slate-500">{course.course_info.instructor.name}</p>
                      )}
                      {course.course_info?.logistics?.meeting_times && (
                        <p className="text-xs text-slate-500">{course.course_info.logistics.meeting_times}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openEditModal(course)
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-400 shadow-sm transition-colors hover:text-[#5B8DEF]"
                    aria-label="Edit course"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCourseToDelete(course)
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-400 shadow-sm transition-colors hover:text-red-500"
                    aria-label="Delete course"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-600 shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="5" width="16" height="15" rx="3" />
                      <path d="M8 3v4M16 3v4M4 10h16" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
                  {course.semester || 'Semester'}
                </span>
                <span className="text-xs">{course.deadline_count ?? 0} deadlines</span>
              </div>
            </Link>
          ))}

          {courses.length === 0 && !loading && (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
              No courses yet. Add your first one or upload a syllabus.
            </div>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-slate-500 transition-all duration-300 hover:-translate-y-1 hover:border-slate-400 hover:shadow-lg"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-[#5B8DEF]">+</span>
            <span className="text-sm font-semibold">Add Course</span>
          </button>
        </div>

        {loading && (
          <div className="mt-6 text-sm text-slate-500">Loading courses...</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add a new course</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <input
                placeholder="Course name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
              <input
                placeholder="Course code"
                value={formCode}
                onChange={(event) => setFormCode(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
              <input
                placeholder="Semester"
                value={formSemester}
                onChange={(event) => setFormSemester(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
            </div>
            {formError && <div className="mt-3 text-sm text-[#FB7185]">{formError}</div>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Save Course'}
            </button>
          </div>
        </div>
      )}

      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Delete course?</h2>
              <button
                onClick={() => setCourseToDelete(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              This will remove the course and all associated deadlines and study materials.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCourseToDelete(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {courseToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Edit course</h2>
              <button
                onClick={() => setCourseToEdit(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <input
                placeholder="Course name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
              <input
                placeholder="Course code"
                value={editCode}
                onChange={(event) => setEditCode(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
              <input
                placeholder="Semester"
                value={editSemester}
                onChange={(event) => setEditSemester(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-300 focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              />
            </div>
            {editError && <div className="mt-3 text-sm text-[#FB7185]">{editError}</div>}
            <button
              onClick={handleEdit}
              disabled={editing}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editing ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed right-6 top-24 z-50 toast-slide-in">
          <div className={`rounded-2xl px-4 py-3 text-sm shadow-lg ${
            toastType === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-white text-slate-700'
          }`}>
            {toastMessage}
          </div>
        </div>
      )}
    </main>
  )
}
