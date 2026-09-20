// Pure helpers for the Notes editor's light markdown formatting, list continuation, search
// highlighting, and turning notes into text for the study-tool generators.
// Kept free of React/DOM so it's testable with `node lib/noteMarkdown.test.ts`.
// Notes are stored as plain text; the markdown is just characters in that text.

export interface EditResult {
  text: string
  start: number
  end: number
}

export type LineKind = 'heading' | 'bullet' | 'check'

const PREFIX: Record<LineKind, string> = { heading: '## ', bullet: '- ', check: '- [ ] ' }
const HAS_KIND: Record<LineKind, RegExp> = {
  heading: /^\s*#{1,6}\s/,
  bullet: /^\s*[-*+]\s+(?!\[[ xX]\]\s)/,
  check: /^\s*[-*+]\s+\[[ xX]\]\s/,
}
// A leading heading / bullet / numbered / checklist marker, keeping the indentation in group 1
const BLOCK_MARKER = /^(\s*)(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/

function lineStartOf(text: string, pos: number): number {
  return pos <= 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1
}

/** Character range covering every line touched by the selection [start, end]. */
function lineRange(text: string, start: number, end: number): { from: number; to: number } {
  const from = lineStartOf(text, start)
  // A selection that ends just after a newline shouldn't drag in the next, untouched line
  const effectiveEnd = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nl = text.indexOf('\n', effectiveEnd)
  return { from, to: nl === -1 ? text.length : nl }
}

/**
 * Toolbar: toggle a heading / bullet / checklist prefix on every selected line.
 * If all (non-empty) selected lines already have it, it's removed; otherwise any other block
 * marker is replaced by it. Returns the new text and selection.
 */
export function toggleLinePrefix(text: string, start: number, end: number, kind: LineKind): EditResult {
  const { from, to } = lineRange(text, start, end)
  const lines = text.slice(from, to).split('\n')
  const considered = lines.filter((l) => l.trim() !== '')
  const remove = considered.length > 0 && considered.every((l) => HAS_KIND[kind].test(l))

  const deltas: number[] = []
  const next = lines.map((line) => {
    if (line.trim() === '' && lines.length > 1) {
      deltas.push(0)
      return line
    }
    const stripped = line.replace(BLOCK_MARKER, '$1')
    const out = remove ? stripped : stripped.replace(/^(\s*)/, `$1${PREFIX[kind]}`)
    deltas.push(out.length - line.length)
    return out
  })

  const newText = text.slice(0, from) + next.join('\n') + text.slice(to)
  const total = deltas.reduce((a, b) => a + b, 0)
  const newStart = Math.max(from, start + deltas[0])
  const newEnd = start === end ? newStart : Math.max(newStart, end + total)
  return { text: newText, start: newStart, end: newEnd }
}

/** Toolbar: wrap the selection in **bold** (or unwrap it). With no selection, inserts **** and puts the caret inside. */
export function toggleBold(text: string, start: number, end: number): EditResult {
  const M = '**'
  if (start === end) {
    return { text: text.slice(0, start) + M + M + text.slice(end), start: start + 2, end: start + 2 }
  }
  const selected = text.slice(start, end)
  // Markers are outside the selection → unwrap
  if (text.slice(start - 2, start) === M && text.slice(end, end + 2) === M && start >= 2) {
    return { text: text.slice(0, start - 2) + selected + text.slice(end + 2), start: start - 2, end: end - 2 }
  }
  // Markers are inside the selection → unwrap
  if (selected.length >= 4 && selected.startsWith(M) && selected.endsWith(M)) {
    const inner = selected.slice(2, -2)
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length }
  }
  // Keep whitespace outside the markers — "** word **" would not render as bold
  const lead = selected.length - selected.trimStart().length
  const trail = selected.length - selected.trimEnd().length
  if (lead + trail >= selected.length) return { text, start, end }
  const core = selected.slice(lead, selected.length - trail)
  const wrapped = selected.slice(0, lead) + M + core + M + selected.slice(selected.length - trail)
  return {
    text: text.slice(0, start) + wrapped + text.slice(end),
    start: start + lead + 2,
    end: start + lead + 2 + core.length,
  }
}

/**
 * Enter key inside a list. With the caret at the end of a bullet / numbered / checklist item,
 * returns the text with the next marker inserted (numbers increment, checkboxes reset to unchecked).
 * On an item with no text, ends the list instead by removing the marker. Returns null when the
 * caret isn't at the end of a list item, so the browser's normal newline applies.
 */
export function continueList(text: string, pos: number): EditResult | null {
  const lineStart = lineStartOf(text, pos)
  const nl = text.indexOf('\n', pos)
  const lineEnd = nl === -1 ? text.length : nl
  if (text.slice(pos, lineEnd).trim() !== '') return null // caret mid-line

  const line = text.slice(lineStart, pos)
  const m = /^(\s*)([-*+]|(\d+)([.)]))\s+(\[[ xX]\]\s+)?/.exec(line)
  if (!m) return null

  if (line.slice(m[0].length).trim() === '') {
    // Empty item: Enter ends the list
    return { text: text.slice(0, lineStart) + text.slice(lineEnd), start: lineStart, end: lineStart }
  }

  const indent = m[1]
  let marker: string
  if (m[3] !== undefined) marker = `${Number(m[3]) + 1}${m[4]} `
  else marker = `${m[2]} ${m[5] ? '[ ] ' : ''}`
  const insert = `\n${indent}${marker}`
  const at = pos
  return { text: text.slice(0, at) + insert + text.slice(at), start: at + insert.length, end: at + insert.length }
}

/** Toggle the `[ ]` / `[x]` on a 1-based source line of a task-list item. Returns the text unchanged if the line isn't one. */
export function toggleChecklistLine(text: string, line: number): string {
  const lines = text.split('\n')
  const i = line - 1
  if (i < 0 || i >= lines.length) return text
  const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](?=\s|$)/.exec(lines[i])
  if (!m) return text
  lines[i] = m[1] + (m[2] === ' ' ? '[x]' : '[ ]') + lines[i].slice(m[0].length)
  return lines.join('\n')
}

/** One-line plain-text preview of a note body. Mirror of `_note_preview` in Backend/main.py. */
export function makePreview(content: string, limit = 120): string {
  const lines = content
    .slice(0, 1000)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, ''))
  return lines.join(' ').split(/\s+/).filter(Boolean).join(' ').replace(/(\*\*|__|~~|`)/g, '').slice(0, limit)
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
