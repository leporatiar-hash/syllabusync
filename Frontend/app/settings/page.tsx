'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import posthog from 'posthog-js'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'

const CanvasConnectModal = dynamic(() => import('../../components/CanvasConnectModal'), { ssr: false })
const ICalConnectModal = dynamic(() => import('../../components/ICalConnectModal'), { ssr: false })

const schoolTypes = ['High School', 'Community College', 'University', 'Graduate School']
const academicYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD']

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [major, setMajor] = useState('')
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadingPic, setUploadingPic] = useState(false)

  // LMS state
  const [lmsConnections, setLmsConnections] = useState<any[]>([])
  const [lmsLoading, setLmsLoading] = useState(false)
  const [lmsSyncing, setLmsSyncing] = useState(false)
  const [lmsError, setLmsError] = useState<string | null>(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [showICalModal, setShowICalModal] = useState(false)

  const loadLmsConnections = useCallback(async () => {
    setLmsLoading(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/connections`)
      if (res.ok) {
        setLmsConnections(await res.json())
      }
    } catch {
      // non-fatal
    } finally {
      setLmsLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Load text fields from Supabase user_metadata (small, no bloat)
  useEffect(() => {
    if (!user) return
    const metadata = user.user_metadata || {}
    setFullName((metadata.full_name as string) || '')
    setSchoolName((metadata.school_name as string) || '')
    setSchoolType((metadata.school_type as string) || '')
    setAcademicYear((metadata.academic_year as string) || '')
    setMajor((metadata.major as string) || '')
  }, [user])

  // Load LMS connections
  useEffect(() => {
    if (user) loadLmsConnections()
  }, [user, loadLmsConnections])

  // Load profile picture from backend (not JWT — avoids base64 bloat in every request).
  // If the backend profile row doesn't exist yet, seed it from Supabase metadata so that
  // profile-picture uploads will work immediately without a page reload.
  useEffect(() => {
    if (!user) return
    const loadPic = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me`)
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfilePicture(data.profile.profile_picture || null)
          } else {
            // Backend profile row missing — create it now from Supabase metadata
            const metadata = user.user_metadata || {}
            await fetchWithAuth(`${API_URL}/me/profile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                full_name: (metadata.full_name as string) || '',
                school_name: (metadata.school_name as string) || '',
                school_type: (metadata.school_type as string) || '',
                academic_year: (metadata.academic_year as string) || '',
                major: (metadata.major as string) || '',
              }),
            }).catch(() => {})  // best-effort; picture upload endpoint also auto-creates if needed
          }
        }
      } catch {
        // non-fatal — avatar just stays as initials
      }
    }
    loadPic()
  }, [user])

  if (authLoading || !user) {
    return null
  }

  const initials = (fullName?.[0] || user.email?.[0] || 'U').toUpperCase()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName || undefined,
          school_name: schoolName || undefined,
          school_type: schoolType || undefined,
          academic_year: academicYear || undefined,
          major: major || undefined,
        },
      })
      if (error) {
        setSaveError(error.message || 'Failed to save. Please try again.')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setSaveError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPic(true)
    setSaveError(null)
    try {
      // On iOS, camera photos are HEIC which canvas can't encode.
      // Convert to a safe MIME type first if needed, then resize.
      const safeFile = await ensureSafeImageFile(file)
      // Resize and compress image to keep it under the 375 KB backend limit
      const dataUrl = await resizeImage(safeFile, 200, 200)

      // Guard: canvas.toDataURL() silently returns "data:," on iOS when it
      // can't encode the image.  Catch that before we hit the network.
      if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 30) {
        setSaveError('Could not process this image. Please try a different photo.')
        return
      }

      const res = await fetchWithAuth(`${API_URL}/me/profile-picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: dataUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.detail || 'Failed to upload photo. Please try again.')
      } else {
        setProfilePicture(dataUrl)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo.'
      setSaveError(msg)
    } finally {
      setUploadingPic(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDisconnectLms = async (connectionId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/connections/${connectionId}`, { method: 'DELETE' })
      if (res.ok) {
        setLmsConnections((prev) => prev.filter((c) => c.id !== connectionId))
      }
    } catch {
      setLmsError('Failed to disconnect')
    }
  }

  const handleSyncAll = async () => {
    setLmsSyncing(true)
    setLmsError(null)
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/sync`, { method: 'POST' })
      if (res.ok) {
        posthog.capture('deadlines_synced')
        await loadLmsConnections()
      } else {
        const data = await res.json().catch(() => ({}))
        setLmsError(data.detail || 'Sync failed')
      }
    } catch {
      setLmsError('Sync failed')
    } finally {
      setLmsSyncing(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">Profile & Settings</h1>

      {/* Profile Picture */}
      <div className="mb-8 flex items-center gap-5">
        <div
          className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] text-2xl font-bold text-white shadow-md transition-transform hover:scale-105"
          onClick={() => fileInputRef.current?.click()}
        >
          {profilePicture ? (
            <img src={profilePicture} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30">
            <span className="text-xs font-normal text-white opacity-0 transition-opacity hover:opacity-100">
              Edit
            </span>
          </div>
        </div>
        <div>
          <p className="font-medium text-slate-900">{fullName || 'Your Name'}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPic}
            className="mt-1 text-xs font-medium text-[#5B8DEF] hover:underline"
          >
            {uploadingPic ? 'Uploading...' : 'Change photo'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePictureUpload}
        />
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            disabled
            value={user.email || ''}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
        </div>

        <div>
          <label htmlFor="schoolName" className="mb-1 block text-sm font-medium text-slate-700">
            School / University
          </label>
          <input
            id="schoolName"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            placeholder="e.g. University of Michigan"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="schoolType" className="mb-1 block text-sm font-medium text-slate-700">
              School Type
            </label>
            <select
              id="schoolType"
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            >
              <option value="">Select...</option>
              {schoolTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="academicYear" className="mb-1 block text-sm font-medium text-slate-700">
              Academic Year
            </label>
            <select
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            >
              <option value="">Select...</option>
              {academicYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="major" className="mb-1 block text-sm font-medium text-slate-700">
            Major / Field of Study
          </label>
          <input
            id="major"
            type="text"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            placeholder="e.g. Computer Science"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && (
            <span className="text-sm font-medium text-green-600">Saved!</span>
          )}
          {saveError && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
        </div>
      </form>

      {/* LMS Connections */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Sync Your Calendar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pull in assignments and due dates from your school&apos;s calendar so you never miss a deadline.
          </p>
        </div>

        {/* How it works tip */}
        <div className="mb-5 rounded-xl bg-gradient-to-r from-[#EEF2FF] to-[#F0FDFF] px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">How it works</p>
          <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-xs text-slate-600">
            <li>Upload your syllabi on the <Link href="/courses" className="font-medium text-[#5B8DEF] hover:underline">Courses</Link> page to create your courses</li>
            <li>Connect your iCal feed or Canvas below</li>
            <li>Deadlines are automatically matched to your courses</li>
          </ol>
        </div>

        {lmsError && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{lmsError}</div>
        )}

        {lmsLoading ? (
          <div className="py-4 text-center text-sm text-slate-400">Loading connections...</div>
        ) : lmsConnections.length > 0 ? (
          <div className="mb-4 space-y-3">
            {lmsConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${conn.provider === 'canvas' ? 'bg-red-500' : 'bg-orange-500'}`}>
                    {conn.provider === 'canvas' ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {conn.provider === 'canvas' ? 'Canvas LMS' : 'iCal Feed'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {conn.instance_url || 'Feed connected'}
                      {conn.last_synced && (
                        <span> &middot; Last synced {new Date(conn.last_synced).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDisconnectLms(conn.id)}
                  className="text-xs font-medium text-slate-400 transition-colors hover:text-red-500"
                >
                  Disconnect
                </button>
              </div>
            ))}

            {/* Sync Now button - prominent */}
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={lmsSyncing}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            >
              {lmsSyncing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
                  Sync Now
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400">Pull the latest assignments from your connected feeds</p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-400">No calendar feeds connected yet.</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowCanvasModal(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Connect Canvas
          </button>
          <button
            type="button"
            onClick={() => setShowICalModal(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Connect iCal Feed
          </button>
        </div>
      </div>

      {showCanvasModal && (
        <CanvasConnectModal
          onClose={() => setShowCanvasModal(false)}
          onSuccess={() => { setShowCanvasModal(false); loadLmsConnections() }}
        />
      )}
      {showICalModal && (
        <ICalConnectModal
          onClose={() => setShowICalModal(false)}
          onSuccess={() => { setShowICalModal(false); loadLmsConnections() }}
        />
      )}

      {/* Logout */}
      <div className="mt-8 rounded-2xl border border-red-100 bg-white p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Sign Out</h2>
        <p className="mb-4 text-sm text-slate-500">Sign out of your ClassMate account on this device.</p>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}

/**
 * iOS camera photos are HEIC/HEIF by default.  Canvas cannot encode HEIC,
 * so toDataURL() silently returns an empty "data:," string.  This helper
 * draws the original file into a canvas once (which forces the browser to
 * decode it) and re-exports it as a plain JPEG Blob — a format every browser
 * can handle.  For files that are already JPEG/PNG/WEBP we skip the step.
 */
async function ensureSafeImageFile(file: File): Promise<File> {
  const safeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (safeTypes.includes(file.type)) return file

  // Read the original file into an Image via an object URL (works for HEIC on iOS)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onerror = () => reject(new Error('Could not decode this image format.'))
      i.onload = () => resolve(i)
      i.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    // Export as JPEG Blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error('Could not convert image to JPEG.'))
      }, 'image/jpeg', 0.9)
    })

    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read the image file.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load the image.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
