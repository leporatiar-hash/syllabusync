// Tests for the text <-> editor-document converter behind the Notes editor.
// No test framework in this project — run directly with `node lib/noteDoc.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import { docToText, emptyDoc, textToDoc, type DocNode } from './noteDoc.ts'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

const roundTrip = (t: string) => docToText(textToDoc(t))

// Every string a student could plausibly have typed in the old plain-text editor, and the markers the
// toolbar wrote in the markdown version, must come back EXACTLY. The markdown-library experiment that
// motivated this module lost or mangled several of these (`<div>`, `snake_case`, `__init__`, tables).
const LOSSLESS: Record<string, string> = {
  empty: '',
  'one word': 'a',
  'trailing newline': 'a\n',
  'only a newline': '\n',
  'v1 plain text, single newlines': 'Line one\nLine two\n\nNew paragraph after blank',
  'html-ish text': 'use <div> tags and List<String> and a < b > c',
  'underscores, asterisks, dunder': 'snake_case_name and 2*3*4 and __init__ and 2**3 and a*b and x**y**z',
  'backslashes, brackets, percent': 'C:\\path\\file, [brackets], (parens), 50% off, a*b, #hashtag, 1. not a list? 2 + 2 = 4',
  'code fence as plain lines': '```js\nconst x = 1\n```\nand `inline`',
  'markdown table as plain lines': '| a | b |\n|---|---|\n| 1 | 2 |',
  blockquote: '> quoted\n> more',
  'horizontal rule': 'above\n\n---\n\nbelow',
  unicode: 'Ünïcode 😀 — dash “quotes” 日本語',
  'many blank lines': 'a\n\n\n\nb',
  'trailing spaces': 'line with trailing spaces   \nnext',
  'leading spaces on plain text': '   indented text',
  'leading tab on plain text': '\tindented with tab',
  'hash without space / 4+ hashes stay literal': '#hashtag\n#### four\n####### seven',
  'dash in the middle of a line': 'pros - cheap\ncons - slow',
  'checkbox text mid-line': 'todo [ ] not a task',
  'lone dash / asterisk lines': '-\n*\n+',
  'toolbar markdown (headings, bullets, tasks, numbers, bold)': '## Topic\n- first\n- second\n- [ ] task a\n- [x] **task b**\n\n1. one\n2. two',
  'nested bullets': '- a\n  - b\n    - c\n- d',
  'nested tasks': '- [ ] a\n  - [x] b\n- [ ] c',
  'numbered list from 3': '3. three\n4. four',
  'two numbered lists split by a blank line': '1. a\n\n2. b',
  'mixed list kinds in a row': '- a\n- [ ] b\n1. c',
  'bold, italic, both': 'this is **bold** and *italic* and ***both*** text',
  'marks inside headings and items': '## **Big** title\n- **x** y\n1. *z*',
  'bare url': 'see https://example.com/a_b*c for more',
  'stray emphasis markers': 'a * b * c and *not closed and **also not closed',
  'numbered checkbox stays text': '1. [ ] x',
  'long line': 'word '.repeat(2000).trim(),
}

for (const [name, text] of Object.entries(LOSSLESS)) {
  test(`round trip is exact: ${name}`, () => assert.equal(roundTrip(text), text))
}

// Inputs the editor deliberately tidies up (same content, canonical form).
const NORMALISED: [string, string, string][] = [
  ['paren numbering -> dots', '1) one\n2) two', '1. one\n2. two'],
  ['other bullet characters -> dash', '* a\n+ b', '- a\n- b'],
  ['4-space nesting -> 2-space', '- a\n    - b', '- a\n  - b'],
  ['tab nesting -> 2-space', '- a\n\t- b', '- a\n  - b'],
  ['numbering is renumbered from the first number', '1. a\n3. b', '1. a\n2. b'],
  ['CRLF line endings -> LF', 'a\r\nb', 'a\nb'],
  ['extra spaces after a heading marker', '##   spaced', '## spaced'],
  ['capital X checkbox', '- [X] a', '- [x] a'],
  ['checkbox with no text', '- [ ]', '- [ ] '],
]
for (const [name, input, expected] of NORMALISED) {
  test(`tidies: ${name}`, () => assert.equal(roundTrip(input), expected))
}

// ── structure ───────────────────────────────────────────────────
const flatten = (n: DocNode, out: DocNode[] = []): DocNode[] => {
  out.push(n)
  n.content?.forEach((c) => flatten(c, out))
  return out
}

test('headings: levels 1-3 become heading nodes, deeper stay text', () => {
  const doc = textToDoc('# one\n## two\n### three\n#### four')
  assert.deepEqual(doc.content.map((n) => n.type), ['heading', 'heading', 'heading', 'paragraph'])
  assert.deepEqual(doc.content.slice(0, 3).map((n) => n.attrs?.level), [1, 2, 3])
})

test('bullets, tasks and ordered lists get the right node types and attrs', () => {
  const doc = textToDoc('- a\n- b\n\n- [ ] t1\n- [x] t2\n\n3. c\n4. d')
  const types = doc.content.map((n) => n.type)
  assert.deepEqual(types, ['bulletList', 'paragraph', 'taskList', 'paragraph', 'orderedList'])
  assert.equal(doc.content[0].content!.length, 2)
  assert.deepEqual(doc.content[2].content!.map((i) => i.attrs?.checked), [false, true])
  assert.equal(doc.content[4].attrs?.start, 3)
})

test('nesting: a deeper item lives inside the item above it', () => {
  const doc = textToDoc('- a\n  - b\n- c')
  const list = doc.content[0]
  assert.equal(list.content!.length, 2)
  assert.deepEqual(list.content![0].content!.map((n) => n.type), ['paragraph', 'bulletList'])
})

test('marks: bold and italic are marks on text nodes, never characters', () => {
  const p = textToDoc('a **b** *c* ***d***').content[0]
  assert.deepEqual(p.content!.map((n) => [n.text, (n.marks ?? []).map((m) => m.type).sort().join('+')]), [
    ['a ', ''],
    ['b', 'bold'],
    [' ', ''],
    ['c', 'italic'],
    [' ', ''],
    ['d', 'bold+italic'],
  ])
})

test('boundaries: intraword markers stay literal text', () => {
  for (const t of ['2*3*4', 'x**y**z', 'a*b']) {
    const p = textToDoc(t).content[0]
    assert.equal(p.content!.length, 1)
    assert.equal(p.content![0].marks, undefined)
  }
})

test('the document never contains empty text nodes (invalid in the editor)', () => {
  for (const t of Object.values(LOSSLESS)) {
    for (const n of flatten(textToDoc(t))) if (n.type === 'text') assert.ok((n.text ?? '').length > 0, JSON.stringify(t))
  }
})

test('an empty note is one empty paragraph', () => {
  assert.deepEqual(textToDoc(''), emptyDoc())
})

// ── document -> text ────────────────────────────────────────────
test('docToText: a hard break becomes a newline', () => {
  const doc: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] }] }
  assert.equal(docToText(doc), 'a\nb')
})

test('docToText: whitespace stays outside the markers so they still hug the words', () => {
  const doc: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bold ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'next' }] }] }
  assert.equal(docToText(doc), '**bold** next')
  const ws: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ', marks: [{ type: 'bold' }] }] }] }
  assert.equal(docToText(ws), '  ')
})

test('docToText: nodes the editor never produces still keep their text', () => {
  const doc: DocNode = { type: 'doc', content: [{ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }] }, { type: 'codeBlock', content: [{ type: 'text', text: 'x = 1' }] }] }
  assert.equal(docToText(doc), 'quoted\nx = 1')
})

test('docToText: a second paragraph inside a list item is kept as an indented line', () => {
  const doc: DocNode = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'more' }] }] }] }] }
  assert.equal(docToText(doc), '- one\n  more')
})

test('docToText: missing / malformed input gives an empty string, not an exception', () => {
  assert.equal(docToText(null), '')
  assert.equal(docToText(undefined), '')
  assert.equal(docToText({ type: 'doc' } as DocNode), '')
  assert.equal(docToText({ type: 'doc', content: 'nope' } as unknown as DocNode), '')
})

// ── fuzz: no crashes, always stable ─────────────────────────────
test('fuzz: 20,000 random notes never throw, never make empty text nodes, and reach a stable form in one pass', () => {
  let seed = 12345
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
  const alphabet = ['a', 'b', ' ', ' ', '\n', '\n', '-', '*', '**', '#', '##', '1.', '2)', '[ ]', '[x]', '\t', '  ', '_', '<', '>', '`', 'é', '😀', '.', '(', ')']
  for (let i = 0; i < 20000; i++) {
    let t = ''
    const len = Math.floor(rnd() * 30)
    for (let k = 0; k < len; k++) t += alphabet[Math.floor(rnd() * alphabet.length)]
    const doc = textToDoc(t)
    for (const n of flatten(doc)) if (n.type === 'text') assert.ok((n.text ?? '').length > 0, JSON.stringify(t))
    const once = docToText(doc)
    const twice = docToText(textToDoc(once))
    assert.equal(twice, once, `not stable for ${JSON.stringify(t)} -> ${JSON.stringify(once)} -> ${JSON.stringify(twice)}`)
  }
})
