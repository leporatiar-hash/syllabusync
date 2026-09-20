'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { NotebookPen, Plus, Search, X } from 'lucide-react'
import posthog from 'posthog-js'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'
import { docToText, emptyDoc, type NoteDoc } from '../lib/noteDoc'
import { highlightParts, makePreview } from '../lib/noteMarkdown'
import NoteEditorPane, { noteDocFor, type NoteEditorApi } from './NoteEditor'
import NoteStudyDialog from './NoteStudyDialog'

interface NoteListItem {
  id: string
  title: string
  preview: string
  updated_at: string
}

interface Draft {
  id: string
  title: string
  content: string // plain text derived from the document; refreshed from the editor whenever we save
  createdAt: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Keep in sync with NOTE_TITLE_MAX_CHARS / NOTE_CONTENT_MAX_CHARS in Backend/main.py.
// (JS string length counts UTF-16 units, so this is never looser than the server's limit.)
const TITLE_MAX = 200
const CONTENT_MAX = 100_000

const SAVE_DEBOUNCE_MS = 800 // save this long after the last keystroke
const SAVE_MAX_WAIT_MS = 8000 // ...but never let continuous typing go unsaved longer than this
const SAVE_RETRY_MS = 4000
// fetch(keepalive) bodies are capped at 64KB by browsers; bigger notes fall back to a normal fetch
const KEEPALIVE_MAX_BYTES = 60_000

/** Backend timestamps are naive UTC (no "Z"); without it `new Date()` would read them as local time. */
function parseUtc(ts: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`)
}

function formatWhen(ts: string): string {
  const d = parseUtc(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

/** "Sun, Sep 20 · ECON 101" under the title. */
function formatMeta(createdAt: string, courseName?: string): string {
  const d = parseUtc(createdAt)
  const date = Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
  return [date, courseName].filter(Boolean).join(' · ')
}

function sortNotes(notes: NoteListItem[]): NoteListItem[] {
  return [...notes].sort((a, b) => parseUtc(b.updated_at).getTime() - parseUtc(a.updated_at).getTime())
}

/** Renders `text` with the case-insensitive matches of `query` highlighted (search results). */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded bg-yellow-100 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

export default function CourseNotes({
  courseId,
  courseName,
  onStudyToolsCreated,
}: {
  courseId: string
  /** Shown under the title, and used to name study sets built from "all notes in this class". */
  courseName?: string
  /** Called after study tools are created from a note, so the page can refresh its Study Tools list. */
  onStudyToolsCreated?: () => void
}) {
  const { fetchWithAuth } = useAuthFetch()

  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // activeId is set the moment a note is chosen (so the editor pane appears immediately on
  // mobile); draft holds its title once the full note has loaded, and editorDoc the document the
  // editor opens with. The editor owns the text from then on (it isn't controlled by React state).
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editorDoc, setEditorDoc] = useState<NoteDoc | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [studyNote, setStudyNote] = useState<{ title: string; content: string } | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NoteListItem[] | null>(null)
  const [searchError, setSearchError] = useState(false)
  const [autoFocusTitle, setAutoFocusTitle] = useState(false)

  // Autosave state lives in refs so timers, unload handlers and the save loop always see the
  // latest text without re-subscribing on every keystroke.
  const draftRef = useRef<Draft | null>(null)
  const dirtyRef = useRef(false)
  const savingRef = useRef<Promise<boolean> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openSeqRef = useRef(0)
  const unmountedRef = useRef(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorApiRef = useRef<NoteEditorApi | null>(null)
  const editorChangedRef = useRef(false) // the editor has changes we haven't pulled into draftRef yet
  const docRef = useRef<NoteDoc | null>(null) // document as of the last pull (sent as content_json)
  const contentVersionRef = useRef(0) // bumped each time the body changes...
  const savedVersionRef = useRef(0) // ...and the version the server has, so title-only saves don't resend the body
  const flushRef = useRef<(keepalive?: boolean) => Promise<boolean>>(async () => true)
  const timerSaveRef = useRef<() => void>(() => {})
  const searchSeqRef = useRef(0)
  const finishActiveRef = useRef<(keepalive?: boolean) => Promise<boolean>>(async () => true)

  const clearTimers = () => {
    for (const ref of [debounceRef, maxWaitRef, retryRef]) {
      if (ref.current) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
  }

  const dropNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setSearchResults((prev) => (prev ? prev.filter((n) => n.id !== id) : prev))
  }, [])

  // ── Loading the list ────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListError(null)
    try {
      const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/notes`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load notes')
      setNotes(await res.json())
    } catch {
      setListError("Couldn't load your notes.")
    } finally {
      setListLoading(false)
    }
  }, [courseId, fetchWithAuth])

  useEffect(() => {
    void loadList()
  }, [loadList])

  // ── Autosave ────────────────────────────────────────────────────
  // Only one PATCH is ever in flight, so a slow older request can never land after (and
  // overwrite) a newer one. Timer-driven saves wait for a pause in typing and never queue
  // behind an in-flight save; explicit flushes (leaving the note, blur, backgrounding the
  // app) loop until nothing is left unsaved.
  const armDebounce = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      timerSaveRef.current()
    }, SAVE_DEBOUNCE_MS)
  }, [])

  /** Pull the editor's current document (and the plain text derived from it) into the draft. */
  const syncFromEditor = useCallback(() => {
    const api = editorApiRef.current
    const current = draftRef.current
    if (!editorChangedRef.current || !api || !current) return
    editorChangedRef.current = false
    const doc = api.getDoc()
    docRef.current = doc
    draftRef.current = { ...current, content: docToText(doc) }
    contentVersionRef.current++
  }, [])

  /** One PATCH of the current draft. Resolves false if it failed (text stays dirty) or the note is gone. */
  const saveOnce = useCallback(
    (keepalive = false): Promise<boolean> => {
      const scheduleRetry = () => {
        if (unmountedRef.current) return // don't keep retrying in the background once the editor is gone
        if (retryRef.current) clearTimeout(retryRef.current)
        retryRef.current = setTimeout(() => {
          retryRef.current = null
          timerSaveRef.current()
        }, SAVE_RETRY_MS)
      }

      const run = (async () => {
        syncFromEditor()
        const snapshot = draftRef.current
        if (!snapshot) return true
        const { id, title, content } = snapshot
        const sendBody = contentVersionRef.current !== savedVersionRef.current
        const sentVersion = contentVersionRef.current
        if (sendBody && content.length > CONTENT_MAX) {
          // Not retryable: it won't get shorter by itself
          dirtyRef.current = true
          setSaveStatus('error')
          setNotice('This note is too long to save (the limit is about 100,000 characters). Trim it or split it into two notes.')
          return false
        }
        dirtyRef.current = false
        if (maxWaitRef.current) {
          clearTimeout(maxWaitRef.current)
          maxWaitRef.current = null
        }
        setSaveStatus('saving')
        try {
          const body = JSON.stringify(sendBody ? { title, content, content_json: docRef.current } : { title })
          const res = await fetchWithAuth(`${API_URL}/notes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body,
            cache: 'no-store',
            keepalive: keepalive && body.length < KEEPALIVE_MAX_BYTES,
          })
          if (res.status === 404) {
            // Deleted from another device — nothing left to save into.
            draftRef.current = null
            setDraft(null)
            setActiveId(null)
            dropNote(id)
            setNotice('That note no longer exists.')
            setSaveStatus('idle')
            return false
          }
          if (!res.ok) {
            dirtyRef.current = true
            setSaveStatus('error')
            if (res.status >= 500 || res.status === 408 || res.status === 429) scheduleRetry()
            return false
          }
          const saved = await res.json()
          if (sendBody) savedVersionRef.current = sentVersion
          setNotes((prev) =>
            sortNotes(
              prev.map((n) =>
                n.id === id
                  ? { ...n, title: saved.title, preview: makePreview(saved.content), updated_at: saved.updated_at }
                  : n,
              ),
            ),
          )
          // Only claim "Saved" if nothing was typed while the request was in flight.
          if (!dirtyRef.current) setSaveStatus('saved')
          return true
        } catch {
          dirtyRef.current = true
          setSaveStatus('error')
          scheduleRetry()
          return false
        }
      })()
      savingRef.current = run
      void run.finally(() => {
        if (savingRef.current === run) savingRef.current = null
      })
      return run
    },
    [fetchWithAuth, dropNote, syncFromEditor],
  )

  /** Fired by the debounce / max-wait / retry timers. */
  const timerSave = useCallback(() => {
    if (!dirtyRef.current || !draftRef.current) return
    if (savingRef.current) {
      armDebounce() // a save is already running; check again after the next pause
      return
    }
    void saveOnce().then((ok) => {
      // Typed during the request: make sure another save is still scheduled.
      if (ok && dirtyRef.current && !debounceRef.current) armDebounce()
    })
  }, [saveOnce, armDebounce])

  /** Explicit flush: resolves true only once nothing is left unsaved (or the note no longer exists). */
  const flush = useCallback(
    async (keepalive = false): Promise<boolean> => {
      clearTimers()
      for (;;) {
        if (savingRef.current) {
          await savingRef.current
          continue
        }
        if (!dirtyRef.current || !draftRef.current) return true
        if (!(await saveOnce(keepalive))) return !draftRef.current
      }
    },
    [saveOnce],
  )

  useEffect(() => {
    flushRef.current = flush
    timerSaveRef.current = timerSave
  }, [flush, timerSave])

  /** Something changed (title or body): mark unsaved and schedule a save. */
  const markEdited = () => {
    dirtyRef.current = true
    setSaveStatus('saving')
    armDebounce()
    if (!maxWaitRef.current) {
      maxWaitRef.current = setTimeout(() => {
        maxWaitRef.current = null
        timerSaveRef.current()
      }, SAVE_MAX_WAIT_MS)
    }
  }

  const handleTitleChange = (value: string) => {
    const current = draftRef.current
    if (!current) return
    const next = { ...current, title: value }
    draftRef.current = next
    setDraft(next)
    markEdited()
  }

  const handleContentChange = () => {
    if (!draftRef.current) return
    editorChangedRef.current = true
    markEdited()
  }

  /**
   * Save whatever is open and close it. Returns false (and leaves the note open) if the save
   * failed, so navigating away can never silently drop unsaved text. A note left completely
   * empty is deleted rather than kept around as a blank "New note".
   */
  const finishActive = useCallback(
    async (keepalive = false): Promise<boolean> => {
      const ok = await flushRef.current(keepalive)
      if (!ok) return false
      syncFromEditor()
      const current = draftRef.current
      draftRef.current = null
      if (current && !current.title.trim() && !current.content.trim()) {
        dropNote(current.id)
        void fetchWithAuth(`${API_URL}/notes/${current.id}`, { method: 'DELETE', cache: 'no-store', keepalive })
      }
      return true
    },
    [fetchWithAuth, dropNote, syncFromEditor],
  )

  useEffect(() => {
    finishActiveRef.current = finishActive
  }, [finishActive])

  // Flush when the tab is switched away from / the page is left, and warn if something is unsaved.
  useEffect(() => {
    unmountedRef.current = false // strict mode runs cleanup and re-mounts in dev
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flushRef.current(true)
    }
    const onPageHide = () => void flushRef.current(true)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      // Leaving the Notes tab (or the course page) mid-edit: save best-effort. The editor is
      // still mounted at this point, so its latest document can be read.
      void finishActiveRef.current(true)
      unmountedRef.current = true
      clearTimers()
    }
  }, [])

  // ── Opening / creating / deleting ───────────────────────────────
  const resetSaveTracking = () => {
    dirtyRef.current = false
    editorChangedRef.current = false
    docRef.current = null
    contentVersionRef.current = 0
    savedVersionRef.current = 0
  }

  const openNote = async (id: string) => {
    if (id === activeId) return
    setNotice(null)
    if (!(await finishActive())) {
      setNotice("Your last changes haven't saved yet. Check your connection and try again.")
      return
    }
    await loadNote(id)
  }

  const loadNote = async (id: string) => {
    const seq = ++openSeqRef.current
    setActiveId(id)
    setDraft(null)
    setEditorDoc(null)
    setOpenError(null)
    setSaveStatus('idle')
    setAutoFocusTitle(false)
    try {
      const res = await fetchWithAuth(`${API_URL}/notes/${id}`, { cache: 'no-store' })
      if (seq !== openSeqRef.current) return
      if (res.status === 404) {
        dropNote(id)
        setActiveId(null)
        setNotice('That note no longer exists.')
        return
      }
      if (!res.ok) throw new Error('Failed to load note')
      const note = await res.json()
      if (seq !== openSeqRef.current) return
      const next: Draft = { id: note.id, title: note.title, content: note.content, createdAt: note.created_at }
      draftRef.current = next
      resetSaveTracking()
      setEditorDoc(noteDocFor(note.content_json, note.content))
      setDraft(next)
    } catch {
      if (seq === openSeqRef.current) setOpenError("Couldn't open that note.")
    }
  }

  const closeEditor = async () => {
    setNotice(null)
    if (!(await finishActive())) {
      setNotice("Your last changes haven't saved yet. Check your connection and try again.")
      return
    }
    openSeqRef.current++
    setActiveId(null)
    setDraft(null)
    setEditorDoc(null)
    setOpenError(null)
    setSaveStatus('idle')
  }

  const createNote = async () => {
    if (creating) return
    setCreating(true)
    setNotice(null)
    try {
      if (!(await finishActive())) {
        setNotice("Your last changes haven't saved yet. Check your connection and try again.")
        return
      }
      const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : "Couldn't create a note. Please try again.")
      }
      const note = await res.json()
      posthog.capture('note_created', { course_id: courseId })
      const next: Draft = { id: note.id, title: note.title, content: note.content, createdAt: note.created_at }
      openSeqRef.current++
      draftRef.current = next
      resetSaveTracking()
      setNotes((prev) => [{ id: note.id, title: '', preview: '', updated_at: note.updated_at }, ...prev])
      setQuery('') // a search would hide the brand-new note
      setEditorDoc(emptyDoc())
      setAutoFocusTitle(true)
      setActiveId(note.id)
      setDraft(next)
      setOpenError(null)
      setSaveStatus('idle')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't create a note. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  const deleteActive = async () => {
    const current = draftRef.current
    if (!current) return
    setDeleting(true)
    // Stop autosave from PATCHing a note we're about to delete.
    clearTimers()
    if (savingRef.current) await savingRef.current
    draftRef.current = null
    try {
      const res = await fetchWithAuth(`${API_URL}/notes/${current.id}`, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok && res.status !== 404) throw new Error('Delete failed')
      dirtyRef.current = false
      openSeqRef.current++
      dropNote(current.id)
      setDraft(null)
      setEditorDoc(null)
      setActiveId(null)
      setSaveStatus('idle')
      setConfirmDelete(false)
    } catch {
      // Delete failed: the note is still there, so keep it open and keep autosaving it.
      draftRef.current = current
      setConfirmDelete(false)
      setNotice("Couldn't delete that note. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const openStudy = () => {
    syncFromEditor()
    const current = draftRef.current
    if (current) setStudyNote({ title: current.title, content: current.content })
  }

  // ── Search (debounced, server-side so it covers full note bodies) ──
  useEffect(() => {
    const q = query.trim()
    const seq = ++searchSeqRef.current
    if (!q) {
      setSearchResults(null)
      setSearchError(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/notes?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
        if (seq !== searchSeqRef.current) return
        if (!res.ok) throw new Error('search failed')
        setSearchResults(await res.json())
        setSearchError(false)
      } catch {
        if (seq === searchSeqRef.current) setSearchError(true)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, courseId, fetchWithAuth])

  // ── Rendering ───────────────────────────────────────────────────
  const statusLabel =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? "Couldn't save — retrying" : ''
  const visibleNotes = searchResults ?? notes
  const searching = query.trim().length > 0

  return (
    <section className="mt-6 rounded-3xl bg-white shadow-sm lg:grid lg:grid-cols-[300px_1fr]">
      {/* ── Note list (hidden on mobile while a note is open) ── */}
      <div className={`${activeId ? 'hidden lg:block' : 'block'} lg:rounded-l-3xl lg:border-r lg:border-slate-100`}>
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 lg:px-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Notes</h2>
          <button
            onClick={() => void createNote()}
            disabled={creating}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#5B8DEF] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#4A7BDD] disabled:opacity-50 lg:min-h-9 lg:px-3.5"
          >
            <Plus size={16} />
            New note
          </button>
        </div>

        {(notes.length > 0 || query) && (
          <div className="px-5 pb-3 lg:px-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {/* text-base (16px): avoids the iOS focus-zoom */}
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                placeholder="Search notes"
                aria-label="Search notes"
                className="min-h-11 w-full rounded-xl border border-transparent bg-slate-50 pl-10 pr-11 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:outline-none lg:min-h-10"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 lg:h-10 lg:w-10"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <p role="alert" className="mx-5 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700 lg:mx-4">
            {notice}
          </p>
        )}

        {listLoading ? (
          <p className="px-5 pb-8 text-sm text-slate-500 lg:px-4">Loading notes…</p>
        ) : listError ? (
          <div className="px-5 pb-8 lg:px-4">
            <p className="text-sm text-slate-600">{listError}</p>
            <button
              onClick={() => {
                setListLoading(true)
                void loadList()
              }}
              className="mt-3 min-h-11 rounded-full border border-slate-200 px-4 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300"
            >
              Try again
            </button>
          </div>
        ) : searching && searchError ? (
          <p className="px-5 pb-8 text-sm text-slate-600 lg:px-4">Search isn&apos;t working right now. Try again in a moment.</p>
        ) : searching && !searchResults ? (
          <p className="px-5 pb-8 text-sm text-slate-500 lg:px-4">Searching…</p>
        ) : searching && searchResults && searchResults.length === 0 ? (
          <p className="px-5 pb-8 text-sm text-slate-500 lg:px-4">No notes match &ldquo;{query.trim()}&rdquo;.</p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-12 pt-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <NotebookPen size={22} />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">No notes yet</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-500">
              Take notes for this class right here. They save automatically.
            </p>
          </div>
        ) : (
          <ul className="pb-3 lg:max-h-[70vh] lg:overflow-y-auto">
            {visibleNotes.map((n) => {
              const isActive = n.id === activeId
              const live = isActive && draft?.id === n.id && !searchResults
              const title = live ? draft.title : n.title
              return (
                <li key={n.id} className="px-2.5">
                  <button
                    onClick={() => void openNote(n.id)}
                    className={`block min-h-[4.25rem] w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-[15px] font-medium ${title ? 'text-slate-900' : 'text-slate-400'}`}>
                        {title ? <Highlight text={title} query={searchResults ? query : ''} /> : 'New note'}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{formatWhen(n.updated_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                      {n.preview ? <Highlight text={n.preview} query={searchResults ? query : ''} /> : 'No additional text'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Editor (full-width on mobile; right-hand pane on desktop) ── */}
      <div className={`${activeId ? 'block' : 'hidden lg:flex'} min-w-0 lg:min-h-[520px]`}>
        {!activeId ? (
          <div className="m-auto px-6 text-center text-sm text-slate-400">Select a note, or create a new one.</div>
        ) : openError ? (
          <div className="w-full px-6 py-8">
            <p className="text-sm text-slate-600">{openError}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void loadNote(activeId)}
                className="min-h-11 rounded-full border border-slate-200 px-4 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300"
              >
                Try again
              </button>
              <button
                onClick={() => void closeEditor()}
                className="min-h-11 rounded-full px-4 text-sm text-slate-500 hover:text-slate-700 lg:hidden"
              >
                Back to notes
              </button>
            </div>
          </div>
        ) : !draft || !editorDoc ? (
          <div className="w-full px-6 py-8 text-sm text-slate-500">Loading note…</div>
        ) : (
          <NoteEditorPane
            key={draft.id}
            initialDoc={editorDoc}
            title={draft.title}
            onTitleChange={handleTitleChange}
            onTitleBlur={() => void flushRef.current()}
            titleInputRef={titleInputRef}
            autoFocusTitle={autoFocusTitle}
            onContentChange={handleContentChange}
            onEditorBlur={() => void flushRef.current()}
            apiRef={editorApiRef}
            meta={formatMeta(draft.createdAt, courseName)}
            statusLabel={statusLabel}
            statusIsError={saveStatus === 'error'}
            onBack={() => void closeEditor()}
            onStudy={openStudy}
            onDelete={() => setConfirmDelete(true)}
            titleMaxLength={TITLE_MAX}
          />
        )}
      </div>

      {studyNote && (
        <NoteStudyDialog
          courseId={courseId}
          courseName={courseName}
          note={studyNote}
          noteCount={notes.length}
          beforeGenerate={() => flushRef.current()}
          onClose={() => setStudyNote(null)}
          onCreated={() => onStudyToolsCreated?.()}
        />
      )}

      {/* ── Delete confirmation (same look as the course page's confirm modal) ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Delete note?</h2>
            <p className="mt-4 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-800">{draft?.title.trim() || 'this note'}</span>? This action
              cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="min-h-11 rounded-full border border-slate-200 px-5 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteActive()}
                disabled={deleting}
                className="min-h-11 rounded-full bg-red-500 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
