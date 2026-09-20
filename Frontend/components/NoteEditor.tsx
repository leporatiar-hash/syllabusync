'use client'

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import { getSchema, type Editor, type Extensions } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { ArrowLeft, Bold, Heading2, Italic, List, ListChecks, ListOrdered, Sparkles, Trash2 } from 'lucide-react'
import { emptyDoc, textToDoc, type NoteDoc } from '../lib/noteDoc'

// The editor understands exactly what lib/noteDoc.ts can turn back into text: paragraphs, three heading
// levels, bullet / numbered / task lists (nestable), bold and italic. Everything else is switched off so a
// note can never hold something the plain-text side (search, chat, study tools) would silently lose.
const NOTE_EXTENSIONS: Extensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: false,
    underline: false,
    trailingNode: false, // keeps the document 1:1 with the text (no phantom empty line after a list)
    heading: { levels: [1, 2, 3] },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder: 'Write your notes…' }),
]

const schema = getSchema(NOTE_EXTENSIONS)

/**
 * The document to open a note with: its stored editor document if it has one and the editor accepts it,
 * otherwise the plain text imported line by line. (Notes written before the rich editor, notes edited by an
 * older client, and unreadable documents all take the text route.)
 */
export function noteDocFor(contentJson: unknown, text: string): NoteDoc {
  if (contentJson && typeof contentJson === 'object') {
    try {
      schema.nodeFromJSON(contentJson).check()
      return contentJson as NoteDoc
    } catch {
      // fall through to the text
    }
  }
  try {
    const doc = textToDoc(text)
    schema.nodeFromJSON(doc).check()
    return doc
  } catch {
    return emptyDoc()
  }
}

export interface NoteEditorApi {
  /** The document as it is right now (read at save time, not on every keystroke). */
  getDoc: () => NoteDoc
}

function FormatButtons({ editor, className = '' }: { editor: Editor; className?: string }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: e.isActive('heading'),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
    }),
  })
  const buttons = [
    { key: 'heading', label: 'Heading', Icon: Heading2, on: active.heading, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'bold', label: 'Bold', Icon: Bold, on: active.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'Italic', Icon: Italic, on: active.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'bullet', label: 'Bulleted list', Icon: List, on: active.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'ordered', label: 'Numbered list', Icon: ListOrdered, on: active.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'task', label: 'Checklist', Icon: ListChecks, on: active.task, run: () => editor.chain().focus().toggleTaskList().run() },
  ]
  return (
    <div role="toolbar" aria-label="Formatting" className={`flex items-center gap-0.5 ${className}`}>
      {buttons.map(({ key, label, Icon, on, run }) => (
        <button
          key={key}
          type="button"
          // Keep focus (and the on-screen keyboard) in the editor when a button is pressed
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          aria-label={label}
          aria-pressed={on}
          title={label}
          className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors lg:h-9 lg:w-9 ${
            on ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Icon size={19} strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}

export default function NoteEditorPane({
  initialDoc,
  title,
  onTitleChange,
  onTitleBlur,
  titleInputRef,
  autoFocusTitle,
  onContentChange,
  onEditorBlur,
  apiRef,
  meta,
  statusLabel,
  statusIsError,
  onBack,
  onStudy,
  onDelete,
  titleMaxLength,
}: {
  initialDoc: NoteDoc
  title: string
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  titleInputRef: RefObject<HTMLInputElement | null>
  autoFocusTitle: boolean
  /** The document changed (no payload: the parent reads it via apiRef when it saves). */
  onContentChange: () => void
  onEditorBlur: () => void
  apiRef: MutableRefObject<NoteEditorApi | null>
  meta: string
  statusLabel: string
  statusIsError: boolean
  onBack: () => void
  onStudy: () => void
  onDelete: () => void
  titleMaxLength: number
}) {
  // Latest callbacks without re-creating the editor when the parent re-renders
  const changeRef = useRef(onContentChange)
  const blurRef = useRef(onEditorBlur)
  const editorRef = useRef<Editor | null>(null)
  const focusBodyWhenReady = useRef(false) // Enter in the title before the editor has finished starting up
  useEffect(() => {
    changeRef.current = onContentChange
    blurRef.current = onEditorBlur
  })

  // Stable options: TipTap re-applies the options object on every React render, and an unstable one can snap the
  // browser's in-progress selection back to the editor's previous state (e.g. when the save status flips mid-selection).
  const editorOptions = useMemo(
    () => ({
      extensions: NOTE_EXTENSIONS,
      content: initialDoc,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Note body',
          'aria-multiline': 'true',
        },
        // Plain-text pastes (from ChatGPT, a PDF, another notes app) come in as structure: "- item" lines become
        // a list, "## Heading" a heading, "**bold**" bold. Pastes with formatting (Docs, web pages) use the editor's own handling.
        handlePaste: (_view: unknown, event: ClipboardEvent) => {
          const data = event.clipboardData
          if (!data || data.getData('text/html')) return false
          const text = data.getData('text/plain')
          if (!text) return false
          event.preventDefault()
          editorRef.current?.commands.insertContent(textToDoc(text).content)
          return true
        },
      },
      onUpdate: () => changeRef.current(),
      onBlur: () => blurRef.current(),
    }),
    [initialDoc],
  )
  const editor = useEditor(editorOptions)

  useEffect(() => {
    if (!editor) return
    editorRef.current = editor
    apiRef.current = { getDoc: () => editor.getJSON() as NoteDoc }
    if (focusBodyWhenReady.current) {
      focusBodyWhenReady.current = false
      editor.commands.focus('start')
    }
    return () => {
      editorRef.current = null
      apiRef.current = null
    }
  }, [editor, apiRef])

  const focused = useEditorState({ editor, selector: ({ editor: e }) => !!e?.isFocused })

  return (
    <div className="w-full min-w-0">
      {/* Quiet header, sticky under the site header (h-16): back (phones), formatting, status, actions */}
      <div className="sticky top-16 z-10 bg-white lg:rounded-tr-3xl">
        <div className="flex min-h-12 items-center gap-1 px-2 sm:px-4">
          <button
            onClick={onBack}
            aria-label="Back to notes"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-500 hover:text-slate-900 lg:hidden"
          >
            <ArrowLeft size={18} />
            Notes
          </button>
          {/* Desktop: the formatting buttons fade in only while you're writing */}
          {editor && (
            <div
              className={`hidden transition-opacity duration-200 lg:block ${focused ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              aria-hidden={!focused}
            >
              <FormatButtons editor={editor} />
            </div>
          )}
          <span
            aria-live="polite"
            className={`min-w-0 flex-1 truncate px-2 text-right text-xs ${statusIsError ? 'font-medium text-amber-600' : 'text-slate-400'}`}
          >
            {statusLabel}
          </span>
          <button
            onClick={onStudy}
            aria-label="Make study tools from your notes"
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#5B8DEF] transition-colors hover:bg-[#EEF2FF] lg:h-9"
          >
            <Sparkles size={17} />
            Study
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete note"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 lg:h-9 lg:w-9"
          >
            <Trash2 size={17} />
          </button>
        </div>
        {/* Phones: the formatting row is always there (no hover, and a floating menu would fight the system's selection menu) */}
        {editor && (
          <div className="flex items-center px-2 pb-1 sm:px-4 lg:hidden">
            <FormatButtons editor={editor} />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[44rem] px-5 pb-24 pt-4 sm:px-8 lg:pt-8">
        <input
          ref={titleInputRef}
          autoFocus={autoFocusTitle}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (editor) {
                editor.view.focus() // synchronous, so the very next keystroke lands in the body (TipTap's own focus() defers a frame)
                editor.commands.focus('start')
              } else focusBodyWhenReady.current = true
            }
          }}
          maxLength={titleMaxLength}
          placeholder="New note"
          aria-label="Note title"
          className="w-full bg-transparent text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none sm:text-[2rem]"
        />
        <p className="mb-5 mt-1.5 text-sm text-slate-400">{meta}</p>
        <div className="note-editor">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
