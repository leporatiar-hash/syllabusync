// Converts between a note's plain text and the rich-text editor's document (TipTap/ProseMirror JSON).
//
// Why this exists instead of a markdown library: notes are stored as BOTH the editor document
// (`content_json`, the source of truth for editing) and plain text (`content`, what search, previews,
// chat and the study-tool generators read). Round-tripping real student notes through a markdown
// parser is lossy — `use <div> tags` loses text, `snake_case` gains backslashes, `__init__` turns bold,
// tables vanish. So here the text side is deliberately dumb and verbatim:
//
//   textToDoc:  one line -> one paragraph. Only LINE-START markers become structure (`## `, `- `, `- [ ] `,
//               `1. `, indentation for nesting) and only `**bold**` / `*italic*` become marks. Everything else
//               stays literal text, character for character.
//   docToText:  the exact inverse, so `docToText(textToDoc(t)) === t` for ordinary text.
//
// Pure functions, no DOM: testable with `node lib/noteDoc.test.ts`.

export interface DocMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: DocMark[]
  text?: string
}

export interface NoteDoc extends DocNode {
  type: 'doc'
  content: DocNode[]
}

export function emptyDoc(): NoteDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

// ── text -> document ────────────────────────────────────────────

const HEADING = /^(#{1,3})[ \t]+(.*)$/
// indent, marker, optional [ ]/[x] box, rest of the line
const LIST_ITEM = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(?:\[([ xX])\](?:[ \t]+|$))?(.*)$/

type ListKind = 'bullet' | 'ordered' | 'task'

const isWordChar = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c)

/** `**bold**`, `*italic*` and `***both***`, only when they sit at word boundaries (so `2*3*4` and `2**3` stay literal). */
function parseInline(text: string): DocNode[] {
  const out: DocNode[] = []
  const push = (t: string, marks: DocMark[]) => {
    if (!t) return
    const last = out[out.length - 1]
    const same =
      last &&
      last.type === 'text' &&
      (last.marks?.length ?? 0) === marks.length &&
      marks.every((m) => last.marks?.some((lm) => lm.type === m.type))
    if (same) last.text += t
    else out.push(marks.length ? { type: 'text', text: t, marks: marks.map((m) => ({ ...m })) } : { type: 'text', text: t })
  }

  const walk = (from: number, to: number, marks: DocMark[]) => {
    let buffer = ''
    let i = from
    while (i < to) {
      let matched = false
      if (text[i] === '*') {
        for (const marker of ['***', '**', '*']) {
          if (!text.startsWith(marker, i) || i + marker.length > to) continue
          const len = marker.length
          const next = text[i + len]
          if (isWordChar(text[i - 1]) || next === undefined || /\s/.test(next) || next === '*') continue
          // first closer that hugs non-space text and ends at a boundary
          let j = i + len + 1
          let close = -1
          while (j + len <= to) {
            if (
              text.startsWith(marker, j) &&
              !/\s/.test(text[j - 1]) &&
              !isWordChar(text[j + len]) &&
              (len > 1 || (text[j + 1] !== '*' && text[j - 1] !== '*'))
            ) {
              close = j
              break
            }
            j++
          }
          if (close === -1) continue
          push(buffer, marks)
          buffer = ''
          const added: DocMark[] =
            marker === '***' ? [{ type: 'bold' }, { type: 'italic' }] : marker === '**' ? [{ type: 'bold' }] : [{ type: 'italic' }]
          walk(i + len, close, [...marks, ...added])
          i = close + len
          matched = true
          break
        }
      }
      if (!matched) {
        buffer += text[i]
        i++
      }
    }
    push(buffer, marks)
  }

  walk(0, text.length, [])
  return out
}

function paragraph(text: string): DocNode {
  const content = parseInline(text)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

interface OpenList {
  indent: number
  kind: ListKind
  node: DocNode
  lastItem: DocNode
}

export function textToDoc(text: string): NoteDoc {
  const doc: NoteDoc = { type: 'doc', content: [] }
  let stack: OpenList[] = []

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = HEADING.exec(line)
    if (heading) {
      stack = []
      const content = parseInline(heading[2])
      doc.content.push({ type: 'heading', attrs: { level: heading[1].length }, ...(content.length ? { content } : {}) })
      continue
    }

    const item = LIST_ITEM.exec(line)
    if (!item) {
      stack = []
      doc.content.push(line === '' ? { type: 'paragraph' } : paragraph(line))
      continue
    }

    const indent = item[1].replace(/\t/g, '    ').length
    const numbered = /^\d/.test(item[2])
    let rest = item[4]
    let kind: ListKind
    if (numbered) {
      kind = 'ordered'
      if (item[3] !== undefined) rest = `[${item[3]}] ${rest}` // "1. [ ] x": there are no numbered checklists, keep the text as typed
    } else {
      kind = item[3] !== undefined ? 'task' : 'bullet'
    }

    const body = paragraph(rest)
    const node: DocNode =
      kind === 'task'
        ? { type: 'taskItem', attrs: { checked: item[3] !== ' ' }, content: [body] }
        : { type: 'listItem', content: [body] }

    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop()
    if (stack.length && stack[stack.length - 1].indent === indent && stack[stack.length - 1].kind !== kind) stack.pop()

    const top = stack[stack.length - 1]
    if (top && top.indent === indent) {
      top.node.content!.push(node)
      top.lastItem = node
    } else {
      const listType = kind === 'task' ? 'taskList' : kind === 'ordered' ? 'orderedList' : 'bulletList'
      const list: DocNode = {
        type: listType,
        ...(kind === 'ordered' ? { attrs: { start: parseInt(item[2], 10) } } : {}),
        content: [node],
      }
      if (top) top.lastItem.content!.push(list) // nested under the item above
      else doc.content.push(list)
      stack.push({ indent, kind, node: list, lastItem: node })
    }
  }
  return doc
}

// ── document -> text ────────────────────────────────────────────

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(textOf).join('')
}

interface Run {
  text: string
  bold: boolean
  italic: boolean
}

/** Wrap `inner` in `marker`, keeping any surrounding whitespace outside so the markers still hug the words. */
function wrap(inner: string, marker: string): string {
  const lead = inner.length - inner.trimStart().length
  const trail = inner.length - inner.trimEnd().length
  if (lead + trail >= inner.length) return inner
  return inner.slice(0, lead) + marker + inner.slice(lead, inner.length - trail) + marker + inner.slice(inner.length - trail)
}

/** Group consecutive runs by `outer`'s flag and wrap the flagged groups, nesting the other mark inside — so
 *  overlapping marks nest (`**a *b* c**`) instead of stacking markers around every text piece. */
function renderNested(runs: Run[], outer: 'bold' | 'italic'): string {
  const inner: 'bold' | 'italic' = outer === 'bold' ? 'italic' : 'bold'
  const marker = (m: 'bold' | 'italic') => (m === 'bold' ? '**' : '*')
  const single = (group: Run[], mark: 'bold' | 'italic') => {
    // innermost level: consecutive runs sharing the flag are wrapped once
    let out = ''
    let i = 0
    while (i < group.length) {
      let j = i
      while (j < group.length && group[j][mark] === group[i][mark]) j++
      const text = group.slice(i, j).map((r) => r.text).join('')
      out += group[i][mark] ? wrap(text, marker(mark)) : text
      i = j
    }
    return out
  }
  let out = ''
  let i = 0
  while (i < runs.length) {
    let j = i
    while (j < runs.length && runs[j][outer] === runs[i][outer]) j++
    const group = runs.slice(i, j)
    const body = single(group, inner)
    out += runs[i][outer] ? wrap(body, marker(outer)) : body
    i = j
  }
  return out
}

/** Bold-outside-italic vs italic-outside-bold both read back identically; take whichever needs fewer markers.
 *  (Deterministic, so exporting an imported export gives the same text.) */
function renderRuns(runs: Run[]): string {
  const a = renderNested(runs, 'bold')
  const b = renderNested(runs, 'italic')
  return b.length < a.length ? b : a
}

function inlineToText(nodes: DocNode[] | undefined): string {
  const runs: Run[] = []
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') runs.push({ text: '\n', bold: false, italic: false }) // never inside a mark: a newline ends the line
    else if (n.type === 'text')
      runs.push({ text: n.text ?? '', bold: !!n.marks?.some((m) => m.type === 'bold'), italic: !!n.marks?.some((m) => m.type === 'italic') })
    else runs.push({ text: textOf(n), bold: false, italic: false })
  }
  return renderRuns(runs)
}

function blockToLines(node: DocNode, depth: number, out: string[]): void {
  const indent = '  '.repeat(depth)
  switch (node.type) {
    case 'paragraph':
      out.push(...inlineToText(node.content).split('\n').map((l, i) => (i === 0 ? indent + l : l)))
      return
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1))
      out.push(`${'#'.repeat(level)} ${inlineToText(node.content)}`)
      return
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const start = Number(node.attrs?.start) || 1
      ;(node.content ?? []).forEach((item, i) => {
        const marker =
          node.type === 'taskList' ? (item.attrs?.checked ? '- [x] ' : '- [ ] ') : node.type === 'orderedList' ? `${start + i}. ` : '- '
        const [first, ...others] = item.content ?? []
        const lines: string[] = []
        if (first) blockToLines(first, 0, lines)
        out.push(indent + marker + (lines[0] ?? ''), ...lines.slice(1))
        for (const child of others) blockToLines(child, depth + 1, out) // nested lists (and any extra paragraphs)
      })
      return
    }
    default: {
      // Anything the editor doesn't produce (an unexpected node in stored JSON): keep its text.
      const t = textOf(node)
      out.push(...(t === '' ? [''] : t.split('\n')))
    }
  }
}

export function docToText(doc: DocNode | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return ''
  const lines: string[] = []
  for (const block of doc.content) blockToLines(block, 0, lines)
  return lines.join('\n')
}
