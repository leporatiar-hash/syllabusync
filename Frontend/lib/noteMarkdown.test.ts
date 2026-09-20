// Tests for the Notes editor's pure formatting helpers.
// No test framework in this project — run directly with `node lib/noteMarkdown.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import {
  continueList,
  highlightParts,
  joinNotesForStudy,
  makePreview,
  noteAsText,
  studyFileName,
  toggleBold,
  toggleChecklistLine,
  toggleLinePrefix,
} from './noteMarkdown.ts'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

// ── toggleLinePrefix ────────────────────────────────────────────
test('bullet: adds "- " to the caret line and moves the caret with it', () => {
  const r = toggleLinePrefix('hello', 2, 2, 'bullet')
  assert.equal(r.text, '- hello')
  assert.equal(r.start, 4)
})

test('bullet: removes when the line already is one (toggle)', () => {
  const r = toggleLinePrefix('- hello', 4, 4, 'bullet')
  assert.equal(r.text, 'hello')
  assert.equal(r.start, 2)
})

test('checklist: adds an unchecked box, and toggles off a checked one', () => {
  assert.equal(toggleLinePrefix('task', 0, 0, 'check').text, '- [ ] task')
  assert.equal(toggleLinePrefix('- [x] task', 0, 0, 'check').text, 'task')
})

test('switching bullet -> checklist replaces the marker instead of stacking', () => {
  assert.equal(toggleLinePrefix('- item', 0, 0, 'check').text, '- [ ] item')
  assert.equal(toggleLinePrefix('- [ ] item', 0, 0, 'bullet').text, '- item')
})

test('heading: adds "## ", replaces other markers, toggles off', () => {
  assert.equal(toggleLinePrefix('Title', 0, 0, 'heading').text, '## Title')
  assert.equal(toggleLinePrefix('- item', 0, 0, 'heading').text, '## item')
  assert.equal(toggleLinePrefix('## Title', 0, 0, 'heading').text, 'Title')
  assert.equal(toggleLinePrefix('# Title', 0, 0, 'heading').text, 'Title')
})

test('multi-line selection: applies to every selected line, only those', () => {
  const text = 'one\ntwo\nthree\nfour'
  const start = text.indexOf('two')
  const end = text.indexOf('three') + 5
  const r = toggleLinePrefix(text, start, end, 'bullet')
  assert.equal(r.text, 'one\n- two\n- three\nfour')
  const off = toggleLinePrefix(r.text, r.start, r.end, 'bullet')
  assert.equal(off.text, text)
})

test('multi-line selection: skips blank lines in between', () => {
  const r = toggleLinePrefix('a\n\nb', 0, 4, 'bullet')
  assert.equal(r.text, '- a\n\n- b')
})

test('a selection ending right after a newline does not touch the next line', () => {
  const r = toggleLinePrefix('one\ntwo', 0, 4, 'bullet')
  assert.equal(r.text, '- one\ntwo')
})

test('indentation is preserved', () => {
  assert.equal(toggleLinePrefix('  nested', 0, 0, 'bullet').text, '  - nested')
  assert.equal(toggleLinePrefix('  - nested', 0, 0, 'bullet').text, '  nested')
})

test('an empty document / empty line works', () => {
  assert.equal(toggleLinePrefix('', 0, 0, 'check').text, '- [ ] ')
  assert.equal(toggleLinePrefix('a\n\nb', 2, 2, 'bullet').text, 'a\n- \nb')
})

test('caret at position 0 of a text that starts with a newline stays on the first (empty) line', () => {
  assert.equal(toggleLinePrefix('\nabc', 0, 0, 'bullet').text, '- \nabc')
})

// ── toggleBold ──────────────────────────────────────────────────
test('bold: wraps the selection and keeps it selected', () => {
  const r = toggleBold('make this bold', 5, 9)
  assert.equal(r.text, 'make **this** bold')
  assert.equal(r.text.slice(r.start, r.end), 'this')
})

test('bold: no selection inserts **** with the caret in the middle', () => {
  const r = toggleBold('ab', 1, 1)
  assert.equal(r.text, 'a****b')
  assert.equal(r.start, 3)
})

test('bold: unwraps when the markers are just outside the selection', () => {
  const r = toggleBold('a **this** b', 4, 8)
  assert.equal(r.text, 'a this b')
  assert.equal(r.text.slice(r.start, r.end), 'this')
})

test('bold: unwraps when the selection includes the markers', () => {
  const r = toggleBold('a **this** b', 2, 10)
  assert.equal(r.text, 'a this b')
})

test('bold: trailing/leading whitespace stays outside the markers (so it still renders bold)', () => {
  const r = toggleBold('word next', 0, 5) // "word " selected, as iOS double-tap does
  assert.equal(r.text, '**word** next')
})

test('bold: a whitespace-only selection is left alone', () => {
  assert.equal(toggleBold('a   b', 1, 4).text, 'a   b')
})

// ── continueList ────────────────────────────────────────────────
test('Enter after a bullet inserts the next bullet', () => {
  const r = continueList('- one', 5)!
  assert.equal(r.text, '- one\n- ')
  assert.equal(r.start, 8)
})

test('Enter after a checklist item inserts an UNCHECKED box, even after a checked one', () => {
  assert.equal(continueList('- [x] done', 10)!.text, '- [x] done\n- [ ] ')
})

test('Enter after a numbered item increments the number', () => {
  assert.equal(continueList('1. first', 8)!.text, '1. first\n2. ')
  assert.equal(continueList('9) nine', 7)!.text, '9) nine\n10) ')
})

test('Enter on an empty item ends the list (removes the marker)', () => {
  const r = continueList('- one\n- ', 8)!
  assert.equal(r.text, '- one\n')
  assert.equal(r.start, 6)
  assert.equal(continueList('- [ ] ', 6)!.text, '')
})

test('nested indentation carries over', () => {
  assert.equal(continueList('  - nested', 10)!.text, '  - nested\n  - ')
})

test('returns null for normal text, mid-line carets, bold lines and rules', () => {
  assert.equal(continueList('plain text', 10), null)
  assert.equal(continueList('- one two', 5), null) // caret in the middle
  assert.equal(continueList('**bold** line', 13), null)
  assert.equal(continueList('---', 3), null)
})

test('continues in the middle of a document', () => {
  const r = continueList('- a\n- b\n- c', 7)!
  assert.equal(r.text, '- a\n- b\n- \n- c')
})

// ── toggleChecklistLine ─────────────────────────────────────────
test('toggles [ ] <-> [x] on the given 1-based line only', () => {
  const t = '# T\n- [ ] one\n- [x] two\n- three'
  assert.equal(toggleChecklistLine(t, 2), '# T\n- [x] one\n- [x] two\n- three')
  assert.equal(toggleChecklistLine(t, 3), '# T\n- [ ] one\n- [ ] two\n- three')
})

test('non-checklist lines and out-of-range lines are unchanged', () => {
  const t = '# T\n- three\ntext [ ] not a task'
  assert.equal(toggleChecklistLine(t, 2), t)
  assert.equal(toggleChecklistLine(t, 3), t)
  assert.equal(toggleChecklistLine(t, 99), t)
  assert.equal(toggleChecklistLine(t, 0), t)
})

test('works with indented and numbered tasks, capital X', () => {
  assert.equal(toggleChecklistLine('  - [X] a', 1), '  - [ ] a')
  assert.equal(toggleChecklistLine('1. [ ] a', 1), '1. [x] a')
})

// ── makePreview (mirror of the backend's _note_preview) ─────────
test('preview strips markers and collapses whitespace like the backend', () => {
  const body = '## Heading\n- [ ] task one\n- [x] done **bold** item\n> quoted `code`\n1. first\n* star bullet'
  assert.equal(makePreview(body), 'Heading task one done bold item quoted code first star bullet')
})

test('preview is capped', () => {
  assert.equal(makePreview('word '.repeat(100)).length, 120)
})

// ── highlightParts ──────────────────────────────────────────────
test('highlight: splits on case-insensitive matches and preserves the original casing', () => {
  assert.deepEqual(highlightParts('The Elasticity of elasticity', 'ELASTICITY'), [
    { text: 'The ', match: false },
    { text: 'Elasticity', match: true },
    { text: ' of ', match: false },
    { text: 'elasticity', match: true },
  ])
})

test('highlight: empty query or no match returns the text whole', () => {
  assert.deepEqual(highlightParts('abc', ''), [{ text: 'abc', match: false }])
  assert.deepEqual(highlightParts('abc', 'z'), [{ text: 'abc', match: false }])
  assert.deepEqual(highlightParts('a.b', '.'), [
    { text: 'a', match: false },
    { text: '.', match: true },
    { text: 'b', match: false },
  ])
})

// ── notes → study tools ─────────────────────────────────────────
test('studyFileName: safe characters, .txt, sensible fallback, length cap', () => {
  assert.equal(studyFileName('Ch. 3: Elasticity'), 'Ch. 3- Elasticity.txt')
  assert.equal(studyFileName('  a/b\\c  '), 'a-b-c.txt')
  assert.equal(studyFileName(''), 'Untitled note.txt')
  assert.equal(studyFileName('   '), 'Untitled note.txt')
  assert.equal(studyFileName('Lecture 3 — Élasticité 📚'), 'Lecture 3 — Élasticité 📚.txt')
  assert.ok(studyFileName('x'.repeat(300)).length <= 84)
})

test('noteAsText: title becomes a heading only when present', () => {
  assert.equal(noteAsText('Week 1', 'body'), '# Week 1\n\nbody')
  assert.equal(noteAsText('  ', 'body'), 'body')
})

test('joinNotesForStudy: keeps whole notes within the budget, in the given order', () => {
  const notes = [
    { title: 'A', content: 'a'.repeat(100) },
    { title: 'B', content: 'b'.repeat(100) },
    { title: 'C', content: 'c'.repeat(100) },
  ]
  const r = joinNotesForStudy(notes, 260)
  assert.equal(r.used, 2)
  assert.ok(r.text.startsWith('# A') && r.text.includes('# B') && !r.text.includes('# C'))
  assert.ok(r.text.length <= 260)
})

test('joinNotesForStudy: skips empty notes; cuts a single oversized first note to fit', () => {
  assert.equal(joinNotesForStudy([{ title: 'x', content: '  ' }], 100).used, 0)
  const r = joinNotesForStudy([{ title: 'Big', content: 'z'.repeat(500) }], 100)
  assert.equal(r.used, 1)
  assert.equal(r.text.length, 100)
})
