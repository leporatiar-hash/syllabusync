'use client'

import { useEffect, useRef, useState } from 'react'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useSubscription } from '../../hooks/useSubscription'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
}

export default function ChatTab() {
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check if limit is already reached from subscription data
  useEffect(() => {
    if (!subLoading && isPro && chatMessagesMax !== null && chatMessagesUsed >= chatMessagesMax) {
      setLimitReached(true)
      const resetDate = chatMessagesResetAt ? new Date(chatMessagesResetAt) : null
      // Calculate first of next month
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const displayDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      setLimitMessage(`You've used all ${chatMessagesMax} chat messages this month. Your limit resets on ${displayDate}.`)
    }
  }, [subLoading, isPro, chatMessagesUsed, chatMessagesMax, chatMessagesResetAt])

  // Load conversations on mount
  useEffect(() => {
    if (isPro) {
      loadConversations()
    }
  }, [isPro])

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

    // Optimistic user message
    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: sentInput + (sentFile ? `\n\n[Attached: ${sentFile.name}]` : ''),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await fetchWithAuth(
        `${API_URL}/chat/conversations/${activeConversation}/messages`,
        { method: 'POST', body: formData }
      )

      if (res.ok) {
        const data = await res.json()
        // Replace temp message with real one + add assistant response
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          data.user_message,
          data.assistant_message,
        ])
        // Update conversation title in sidebar
        if (conversations.find(c => c.id === activeConversation)?.title === 'New Chat') {
          setConversations(prev =>
            prev.map(c =>
              c.id === activeConversation
                ? { ...c, title: (sentInput || sentFile?.name || 'New Chat').slice(0, 50) }
                : c
            )
          )
        }
      } else {
        const err = await res.json()
        if (err.detail?.error === 'limit_reached') {
          setLimitReached(true)
          setLimitMessage(err.detail.message)
        }
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAttachedFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  // Pro paywall
  if (!subLoading && !isPro) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-8 text-center shadow-md">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900">AI Course Chat</h3>
        <p className="mt-2 text-sm text-slate-600">
          Chat with an AI assistant that knows your courses, deadlines, and study materials.
          Upload files and get personalized help studying.
        </p>
        <Link
          href="/upgrade"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-3 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
        >
          Upgrade to Pro
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
        <p className="mt-2 text-xs text-slate-400">Included with Pro — 50 messages/month</p>
      </div>
    )
  }

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-72 flex-col border-r border-slate-200 bg-slate-50/50`}>
        <div className="p-3">
          <button
            onClick={createConversation}
            disabled={limitReached}
            className="w-full rounded-xl bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
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
                className={`group mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  activeConversation === conv.id
                    ? 'bg-[#5B8DEF]/10 text-[#5B8DEF]'
                    : 'text-slate-600 hover:bg-slate-100'
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
          <div className="border-t border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-400 text-center">
              {chatMessagesUsed}/{chatMessagesMax} messages used this month
            </p>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-1 flex-col`}>
        {/* Mobile back button */}
        <div className="flex items-center border-b border-slate-200 px-4 py-2 md:hidden">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="ml-2 text-sm font-medium text-slate-600">Back to chats</span>
        </div>

        {!activeConversation ? (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5B8DEF]/10">
                <svg className="h-8 w-8 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">ClassMate AI Chat</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Ask questions about your courses, get help studying, or upload files for analysis.
              </p>
              <button
                onClick={createConversation}
                disabled={limitReached}
                className="mt-4 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                Start a new chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-400">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <p className={`mt-1 text-xs ${msg.role === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {sending && (
                <div className="mb-4 flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Limit reached message */}
            {limitReached && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-800">{limitMessage}</p>
              </div>
            )}

            {/* Input area */}
            {!limitReached && (
              <div className="border-t border-slate-200 px-4 py-3">
                {/* Attached file chip */}
                {attachedFile && (
                  <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-[#5B8DEF]/10 px-3 py-1.5 text-sm text-[#5B8DEF]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    <span className="max-w-[200px] truncate">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="rounded-full p-0.5 hover:bg-[#5B8DEF]/20"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* File upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    title="Attach a file"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                  </button>

                  {/* Text input */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your courses..."
                    rows={1}
                    className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-[#5B8DEF] focus:bg-white"
                  />

                  {/* Send button */}
                  <button
                    onClick={sendMessage}
                    disabled={(!input.trim() && !attachedFile) || sending}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] p-2.5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
