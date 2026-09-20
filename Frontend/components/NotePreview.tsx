'use client'

// react-markdown hands every renderer its hast `node`; each one destructures it away (`node: _n`) so it
// isn't spread onto the DOM element, which is why the unused-vars rule is off for this file.
/* eslint-disable @typescript-eslint/no-unused-vars */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Read-only rendering of a note's markdown. Safe by construction: react-markdown doesn't render raw
 * HTML, images are disallowed (no remote loads from note text), and it strips javascript: links.
 * Task-list checkboxes are live: tapping one calls onToggleTask with the item's 1-based source line.
 */
export default function NotePreview({
  content,
  onToggleTask,
}: {
  content: string
  onToggleTask: (line: number) => void
}) {
  if (!content.trim()) {
    return <p className="py-6 text-base text-slate-400">Nothing to preview yet. Switch back to Edit to start writing.</p>
  }

  return (
    <div className="min-h-[50dvh] text-base leading-relaxed text-slate-800 [overflow-wrap:anywhere] lg:min-h-[380px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        unwrapDisallowed
        components={{
          h1: ({ node: _n, ...props }) => <h1 className="mb-2 mt-6 text-2xl font-semibold text-slate-900 first:mt-0" {...props} />,
          h2: ({ node: _n, ...props }) => <h2 className="mb-2 mt-6 text-xl font-semibold text-slate-900 first:mt-0" {...props} />,
          h3: ({ node: _n, ...props }) => <h3 className="mb-1 mt-4 text-lg font-semibold text-slate-900 first:mt-0" {...props} />,
          h4: ({ node: _n, ...props }) => <h4 className="mb-1 mt-4 font-semibold text-slate-900" {...props} />,
          p: ({ node: _n, ...props }) => <p className="my-2" {...props} />,
          strong: ({ node: _n, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
          em: ({ node: _n, ...props }) => <em className="italic" {...props} />,
          del: ({ node: _n, ...props }) => <del className="text-slate-400" {...props} />,
          // A list mixing plain bullets and checklist items is ONE list in markdown, so bullets must stay on
          // for the whole <ul>; task rows are display:flex (which drops the marker) and sit in the bullet column.
          // Merge (don't override) react-markdown's own className, e.g. "contains-task-list"
          ul: ({ node: _n, className, ...props }) => <ul className={`my-2 list-disc space-y-1 pl-6 ${className ?? ''}`} {...props} />,
          ol: ({ node: _n, className, ...props }) => <ol className={`my-2 list-decimal space-y-1 pl-6 ${className ?? ''}`} {...props} />,
          li: ({ node, className, children, ...props }) => {
            if (!className?.includes('task-list-item')) {
              return <li className={className} {...props}>{children}</li>
            }
            const line = node?.position?.start.line
            // The whole row is the tap target (bigger than the 20px checkbox); ignore link taps and text selection.
            return (
              <li
                className="-ml-6 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2.5 [&>p]:my-0"
                onClick={(e) => {
                  if (!line || (e.target as HTMLElement).closest('a')) return
                  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return
                  onToggleTask(line)
                }}
              >
                {children}
              </li>
            )
          },
          input: ({ node: _n, type, checked }) =>
            type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={!!checked}
                onChange={() => {}}
                aria-label="Toggle task"
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-[#5B8DEF]"
              />
            ) : null,
          a: ({ node: _n, ...props }) => (
            <a className="text-[#5B8DEF] underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          blockquote: ({ node: _n, ...props }) => (
            <blockquote className="my-3 border-l-4 border-slate-200 pl-4 text-slate-600" {...props} />
          ),
          code: ({ node: _n, ...props }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]" {...props} />,
          pre: ({ node: _n, ...props }) => (
            <pre className="my-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-sm [&>code]:bg-transparent [&>code]:p-0" {...props} />
          ),
          hr: ({ node: _n, ...props }) => <hr className="my-6 border-slate-200" {...props} />,
          table: ({ node: _n, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: ({ node: _n, ...props }) => <th className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-semibold" {...props} />,
          td: ({ node: _n, ...props }) => <td className="border border-slate-200 px-3 py-1.5" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
