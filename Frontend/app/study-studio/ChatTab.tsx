'use client'

import { useEffect, useRef, useState } from 'react'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useSubscription } from '../../hooks/useSubscription'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { Copy, Check, Square, PanelLeft, Plus } from 'lucide-react'
import { BRAND, BRAND_SOFT_BG, BRAND_SOFT_TEXT } from '../v2/components/tokens'

interface CreatedStudySet {
  type: 'flashcards' | 'quiz' | 'summary'
  id: string
  name: string
  count: number
  course_name: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  created_study_set?: CreatedStudySet
}

interface Conversation {
  id: string
  title: string
  created_at: string
}

interface ChatTabProps {
  onViewLibrary?: () => void
  triggerProactive?: boolean
  initialPrompt?: string
}

function Mark({ size = 22, radius = 7, fontSize = 12 }: { size?: number; radius?: number; fontSize?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center font-extrabold text-white"
      style={{ width: size, height: size, borderRadius: radius, background: BRAND, fontSize }}
    >
      C
    </div>
  )
}

interface ChatComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  sending: boolean
  onStop: () => void
  attachedFile: File | null
  onRemoveAttachment: () => void
  onAttachClick: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  placeholder: string
  disabled?: boolean
  autoFocus?: boolean
}

function ChatComposer({
  value, onChange, onSubmit, onKeyDown, sending, onStop, attachedFile,
  onRemoveAttachment, onAttachClick, textareaRef, placeholder, disabled, autoFocus,
}: ChatComposerProps) {
  const canSend = !disabled && (value.trim().length > 0 || !!attachedFile)

  return (
    <div>
      {attachedFile && (
        <div
          className="mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
          style={{ background: BRAND_SOFT_BG, color: BRAND_SOFT_TEXT }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
          </svg>
          <span className="max-w-[200px] truncate">{attachedFile.name}</span>
          <button onClick={onRemoveAttachment} className="rounded-full p-0.5 hover:bg-black/5">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-1 rounded-3xl border border-slate-200 bg-white px-2 py-1.5 transition-colors focus-within:border-[#5B4EE8]">
        <button
          onClick={onAttachClick}
          disabled={disabled}
          className="flex-shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          title="Attach a file"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-slate-800 outline-none placeholder-slate-400"
        />

        <button
          onClick={sending ? onStop : onSubmit}
          disabled={!sending && !canSend}
          aria-label={sending ? 'Stop generating' : 'Send message'}
          className="flex flex-shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            width: 32,
            height: 32,
            background: sending ? '#1E293B' : canSend ? BRAND : '#EDEDF2',
            color: sending || canSend ? '#fff' : '#9CA3AF',
          }}
        >
          {sending ? (
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function ChatTab({ onViewLibrary, triggerProactive = false, initialPrompt }: ChatTabProps) {
  const { fetchWithAuth } = useAuthFetch()
  const { isPro, chatMessagesUsed, chatMessagesMax, chatMessagesResetAt, loading: subLoading } = useSubscription()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [limitReached, setLimitReached] = useState(false)
  const [limitMessage, setLimitMessage] = useState('')
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const [proactiveLoading, setProactiveLoading] = useState(false)
  const [pendingChipInput, setPendingChipInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialPromptFiredRef = useRef(false)

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard access can be blocked — button still gives feedback below
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
  }

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
  }

  // Check if limit is already reached from subscription data
  useEffect(() => {
    if (!subLoading && chatMessagesMax !== null && chatMessagesUsed >= chatMessagesMax) {
      setLimitReached(true)
      const resetDate = chatMessagesResetAt ? new Date(new Date(chatMessagesResetAt).getTime() + 7 * 24 * 60 * 60 * 1000) : null
      const displayDate = resetDate ? resetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'soon'
      setLimitMessage(`You've used all ${chatMessagesMax} chat messages this week. Your limit resets on ${displayDate}.`)
    }
  }, [subLoading, chatMessagesUsed, chatMessagesMax, chatMessagesResetAt])

  // Proactive opening message — fires once per browser session on the /chat page
  useEffect(() => {
    if (!triggerProactive) return
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem('chat_proactive_shown')) return

    const fetchProactive = async () => {
      setProactiveLoading(true)
      try {
        const res = await fetchWithAuth(`${API_URL}/chat/proactive-message`, { method: 'POST' })
        if (!res.ok) return
        const data = await res.json()
        if (data.skipped) return
        const newConv = { id: data.conversation_id, title: data.conversation_title, created_at: new Date().toISOString() }
        setConversations(prev => [newConv, ...prev])
        setActiveConversation(data.conversation_id)
        setMessages([data.message])
        setShowSidebar(false)
        sessionStorage.setItem('chat_proactive_shown', '1')
      } catch {
        // non-fatal — fall through to normal empty state
      } finally {
        setProactiveLoading(false)
      }
    }
    fetchProactive()
  }, [triggerProactive])

  // Load conversations on mount
  useEffect(() => {
    if (!subLoading) {
      loadConversations()
    }
  }, [subLoading])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/chat/conversations`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true)
    setActiveConversation(conversationId)
    setShowSidebar(false) // On mobile, switch to chat view
    try {
      const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const createConversation = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/chat/conversations`, { method: 'POST' })
      if (res.ok) {
        const conv = await res.json()
        setConversations(prev => [conv, ...prev])
        setActiveConversation(conv.id)
        setMessages([])
        setShowSidebar(false)
      } else {
        const err = await res.json()
        if (err.detail?.error === 'pro_required') return
        if (err.detail?.error === 'limit_reached') {
          setLimitReached(true)
          setLimitMessage(err.detail.message)
        }
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetchWithAuth(`${API_URL}/chat/conversations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id))
        if (activeConversation === id) {
          setActiveConversation(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || sending || !activeConversation) return

    setSending(true)
    const formData = new FormData()
    if (input.trim()) formData.append('content', input.trim())
    if (attachedFile) formData.append('file', attachedFile)

    const sentInput = input
    const sentFile = attachedFile
    setInput('')
    setAttachedFile(null)

    const tempId = 'temp-' + Date.now()
    const streamId = 'streaming-' + Date.now()

    // Optimistic user message
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: sentInput + (sentFile ? `\n\n[Uploaded file: ${sentFile.name}]\n` : ''),
      created_at: new Date().toISOString(),
    }])

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetchWithAuth(
        `${API_URL}/chat/conversations/${activeConversation}/messages`,
        { method: 'POST', body: formData, signal: controller.signal }
      )

      if (!res.ok) {
        const err = await res.json()
        if (err.detail?.error === 'limit_reached') {
          setLimitReached(true)
          setLimitMessage(err.detail.message)
        }
        setMessages(prev => prev.filter(m => m.id !== tempId))
        return
      }

      // Add empty streaming bubble immediately
      setStreamingMsgId(streamId)
      setMessages(prev => [...prev, {
        id: streamId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }])

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'user_message') {
              setMessages(prev => prev.map(m => m.id === tempId ? event.message : m))
              if (conversations.find(c => c.id === activeConversation)?.title === 'New Chat') {
                setConversations(prev => prev.map(c =>
                  c.id === activeConversation
                    ? { ...c, title: (sentInput || sentFile?.name || 'New Chat').slice(0, 50) }
                    : c
                ))
              }
            } else if (event.type === 'chunk') {
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: m.content + event.content } : m
              ))
            } else if (event.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === streamId
                  ? { ...m, id: event.message_id, created_at: event.created_at, created_study_set: event.created_study_set || undefined }
                  : m
              ))
              setStreamingMsgId(null)
            } else if (event.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: event.content } : m
              ))
              setStreamingMsgId(null)
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // User-initiated stop — keep the user message and whatever partial
        // reply already streamed in, just close out the "generating" state.
        setStreamingMsgId(null)
      } else {
        console.error('Failed to send message:', err)
        setMessages(prev => prev.filter(m => m.id !== tempId && m.id !== streamId))
        setStreamingMsgId(null)
      }
    } finally {
      setSending(false)
      abortControllerRef.current = null
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAttachedFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleChipClick = async (text: string) => {
    if (activeConversation) {
      setInput(text)
      setTimeout(() => textareaRef.current?.focus(), 0)
      return
    }
    setPendingChipInput(text)
    await createConversation()
  }

  // Apply pending chip input once a conversation becomes active
  useEffect(() => {
    if (activeConversation && pendingChipInput) {
      setInput(pendingChipInput)
      setPendingChipInput('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [activeConversation, pendingChipInput])

  // Deep-link entry point (e.g. from the "Get more out of your courses" panel on /home):
  // pre-fill the composer with a suggested first prompt, same mechanism as a suggestion chip.
  useEffect(() => {
    if (!initialPrompt || initialPromptFiredRef.current || activeConversation) return
    initialPromptFiredRef.current = true
    handleChipClick(initialPrompt)
  }, [initialPrompt, activeConversation])

  // Shared by both composer instances (centered empty-state one and the bottom
  // dock): before a conversation exists, submitting behaves like a suggestion
  // chip — create the conversation and pre-fill the typed text.
  const handleComposerSubmit = () => {
    if (activeConversation) {
      sendMessage()
    } else if (input.trim()) {
      handleChipClick(input.trim())
    }
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleComposerSubmit()
    }
  }

  const handleAttachClickInEmptyState = async () => {
    if (!activeConversation) await createConversation()
    fileInputRef.current?.click()
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (subLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B4EE8] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Sidebar — collapsible on every breakpoint via the header's panel toggle */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} w-full md:w-72 flex-col border-r border-slate-200 bg-slate-50/50`}>
        <div className="p-3">
          <button
            onClick={createConversation}
            disabled={limitReached}
            style={{ background: BRAND }}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5B4EE8] border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              No conversations yet. Start a new chat!
            </p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                style={activeConversation === conv.id ? { background: BRAND_SOFT_BG, color: BRAND_SOFT_TEXT } : undefined}
                className={`group mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  activeConversation === conv.id ? '' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{conv.title}</p>
                  <p className="text-xs text-slate-400">{formatTime(conv.created_at)}</p>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="ml-2 shrink-0 rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>

        {/* Usage counter */}
        {chatMessagesMax !== null && (
          <div className="border-t border-slate-200 px-3 py-2 space-y-1">
            <p className={`text-xs text-center ${chatMessagesUsed >= chatMessagesMax * 0.8 && !limitReached ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
              {chatMessagesUsed}/{chatMessagesMax} messages used this week
            </p>
            {chatMessagesUsed >= chatMessagesMax * 0.8 && !limitReached && (
              <p className="text-xs text-amber-500 text-center">
                {chatMessagesMax - chatMessagesUsed} message{chatMessagesMax - chatMessagesUsed === 1 ? '' : 's'} left
                {!isPro && <> — <a href="/upgrade" className="underline hover:text-amber-600">Upgrade for more</a></>}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-1 flex-col`}>
        {/* Header — panel toggle collapses the sidebar on every breakpoint now,
            and Library lives here (not just in the sidebar) so it stays
            reachable even when the sidebar is collapsed. */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3" style={{ height: 56 }}>
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label={showSidebar ? 'Hide conversations' : 'Show conversations'}
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Mark size={22} radius={6} fontSize={12} />
            <span className="text-sm font-semibold text-slate-900">ClassMate</span>
          </div>
          <div className="flex items-center gap-1">
            {onViewLibrary && (
              <button
                onClick={onViewLibrary}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                aria-label="Library"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25m19.5 0v.75A2.25 2.25 0 0 1 19.5 17.25h-15A2.25 2.25 0 0 1 2.25 15v-.75" />
                </svg>
                <span className="hidden sm:inline">Library</span>
              </button>
            )}
            <button
              onClick={createConversation}
              disabled={limitReached}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!activeConversation ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 text-center">
            <div className="w-full max-w-sm">
              <Mark size={44} radius={14} fontSize={22} />
              <h3 className="mt-4 text-xl font-semibold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
                How can I help you study?
              </h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Ask anything about your courses, or tap a prompt below to get started.
              </p>

              <div className="mt-6">
                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={handleComposerSubmit}
                  onKeyDown={handleComposerKeyDown}
                  sending={sending}
                  onStop={stopGeneration}
                  attachedFile={attachedFile}
                  onRemoveAttachment={() => setAttachedFile(null)}
                  onAttachClick={handleAttachClickInEmptyState}
                  textareaRef={textareaRef}
                  placeholder="Message ClassMate"
                  disabled={limitReached}
                  autoFocus
                />
              </div>

              {/* Prompt chips */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'What are my upcoming deadlines?',
                  'Make flashcards for my next exam',
                  'Quiz me on a topic',
                  'Summarize my notes',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleChipClick(prompt)}
                    disabled={limitReached}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5B4EE8] border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-400">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`mb-5 flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2.5'}`}>
                    {msg.role === 'assistant' && <Mark size={23} radius={7} />}
                    <div className={msg.role === 'user' ? 'flex max-w-[80%] flex-col items-end' : 'flex min-w-0 max-w-[85%] flex-col items-start'}>
                      <div
                        className={`text-sm leading-relaxed text-slate-800 ${msg.role === 'user' ? 'rounded-2xl px-4 py-3' : ''}`}
                        style={msg.role === 'user' ? { background: BRAND_SOFT_BG, borderTopRightRadius: 6 } : undefined}
                      >
                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap">
                            {(() => {
                              // Strip file content from display — show text + a compact file chip only
                              const marker = msg.content.match(/\[(?:Uploaded file|Attached): ([^\]]+)\]/)
                              const fileName = marker ? marker[1] : null
                              const displayText = fileName
                                ? msg.content.substring(0, msg.content.indexOf(marker![0])).trim()
                                : msg.content
                              return (
                                <>
                                  {displayText && <span>{displayText}</span>}
                                  {fileName && (
                                    <div className={`${displayText ? 'mt-2' : ''} flex items-center gap-1.5 rounded-lg bg-white/50 px-3 py-1.5 text-xs text-slate-700`}>
                                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                      </svg>
                                      {fileName}
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        ) : msg.id === streamingMsgId && msg.content === '' ? (
                          <div className="flex gap-1 py-1">
                            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                              h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold text-slate-900 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold text-slate-900 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-bold text-slate-800 first:mt-0">{children}</h3>,
                              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              code: ({ children }) => <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs text-slate-800">{children}</code>,
                              hr: () => <hr className="my-2 border-slate-300" />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-slate-400">{formatTime(msg.created_at)}</p>
                        {msg.role === 'assistant' && msg.content && msg.id !== streamingMsgId && (
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
                          >
                            {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                      {msg.created_study_set && (
                        <div className="mt-2 flex w-full flex-col gap-1.5">
                          <Link
                            href={
                              msg.created_study_set.type === 'flashcards'
                                ? `/flashcards?set=${msg.created_study_set.id}`
                                : msg.created_study_set.type === 'quiz'
                                ? `/quizzes/${msg.created_study_set.id}`
                                : `/summaries/${msg.created_study_set.id}`
                            }
                            className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm transition-colors hover:border-slate-300"
                            style={{ background: BRAND_SOFT_BG }}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60">
                              {msg.created_study_set.type === 'flashcards' ? (
                                <svg className="h-5 w-5" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                              ) : msg.created_study_set.type === 'quiz' ? (
                                <svg className="h-5 w-5" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-800">{msg.created_study_set.name}</p>
                              <p className="text-xs text-slate-500">
                                {msg.created_study_set.type === 'flashcards'
                                  ? `${msg.created_study_set.count} flashcards`
                                  : msg.created_study_set.type === 'quiz'
                                  ? `${msg.created_study_set.count} questions`
                                  : 'Summary notes'}
                                {' · '}{msg.created_study_set.course_name}
                              </p>
                            </div>
                            <svg className="h-4 w-4 shrink-0" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                          {onViewLibrary && (
                            <button
                              onClick={onViewLibrary}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25m19.5 0v.75A2.25 2.25 0 0 1 19.5 17.25h-15A2.25 2.25 0 0 1 2.25 15v-.75" />
                              </svg>
                              View all in Library
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Inline upgrade card — appears in thread when weekly limit is hit */}
              {limitReached && (
                <div className="mb-4 flex justify-start">
                  <div className="max-w-[80%] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <p className="text-sm font-semibold text-amber-900">
                      {isPro
                        ? limitMessage
                        : `You've used your ${chatMessagesMax} free messages this week. Upgrade to Pro for 50 messages/week, proactive deadline nudges, and unlimited study material generation.`}
                    </p>
                    {!isPro && (
                      <Link
                        href="/upgrade"
                        style={{ background: BRAND }}
                        className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                      >
                        Upgrade to Pro
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Typing indicator — shown only while waiting for the stream to start */}
              {sending && !streamingMsgId && (
                <div className="mb-5 flex items-center gap-2.5">
                  <Mark size={23} radius={7} />
                  <div className="flex gap-1 py-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {!limitReached && (
              <div className="border-t border-slate-200 px-4 py-3">
                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={handleComposerSubmit}
                  onKeyDown={handleComposerKeyDown}
                  sending={sending}
                  onStop={stopGeneration}
                  attachedFile={attachedFile}
                  onRemoveAttachment={() => setAttachedFile(null)}
                  onAttachClick={() => fileInputRef.current?.click()}
                  textareaRef={textareaRef}
                  placeholder="Ask a question or attach a file to create flashcards/quiz..."
                />
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  ClassMate can make mistakes — check important dates.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
