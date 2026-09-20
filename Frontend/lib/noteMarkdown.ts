// Small pure helpers for the Notes UI: list previews, search highlighting, and turning notes into
// text for the study-tool generators. (Editing lives in lib/noteDoc.ts + components/NoteEditor.tsx.)
// Kept free of React/DOM so it's testable with `node lib/noteMarkdown.test.ts`.

/** One-line plain-text preview of a note body. Mirror of `_note_preview` in Backend/main.py. */
export function makePreview(content: string, limit = 120): string {
  const lines = content
    .slice(0, 1000)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, ''))
  return lines
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1') // *italic*
    .slice(0, limit)
}

/** Split text into runs, flagging the case-insensitive matches of `query` (for search highlighting). */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const at = lower.indexOf(q, i)
    if (at === -1) break
    if (at > i) parts.push({ text: text.slice(i, at), match: false })
    parts.push({ text: text.slice(at, at + q.length), match: true })
    i = at + q.length
  }
  if (i < text.length) parts.push({ text: text.slice(i), match: false })
  return parts.length ? parts : [{ text, match: false }]
}

// ── Notes → study tools ─────────────────────────────────────────

/** Filename for the .txt upload; the backend names the generated set after it (minus the extension). */
export function studyFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return `${cleaned || 'Untitled note'}.txt`
}

/** A note as text for the generators; the title becomes a heading so the model knows the topic. */
export function noteAsText(title: string, content: string): string {
  const t = title.trim()
  return t ? `# ${t}\n\n${content}` : content
}

/**
 * Combine several notes (most-recently-edited first) into one text, keeping whole notes until the
 * character budget is used. A first note that alone exceeds the budget is cut to fit.
 * `used` is how many notes contributed text.
 */
export function joinNotesForStudy(
  notes: { title: string; content: string }[],
  maxChars: number,
): { text: string; used: number } {
  const SEP = '\n\n---\n\n'
  let text = ''
  let used = 0
  for (const n of notes) {
    if (!n.content.trim()) continue
    const piece = noteAsText(n.title, n.content.trim())
    const addition = (text ? SEP : '') + piece
    if (text && text.length + addition.length > maxChars) break
    text += addition
    used++
    if (text.length >= maxChars) {
      text = text.slice(0, maxChars)
      break
    }
  }
  return { text, used }
}
