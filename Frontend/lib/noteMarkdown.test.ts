// Tests for the Notes UI's pure helpers (previews, search highlighting, notes -> study-tool text).
// No test framework in this project — run directly with `node lib/noteMarkdown.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import { highlightParts, joinNotesForStudy, makePreview, noteAsText, studyFileName } from './noteMarkdown.ts'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

// ── makePreview (mirror of the backend's _note_preview) ─────────
test('preview strips markers and collapses whitespace like the backend', () => {
  const body = '## Heading\n- [ ] task one\n- [x] done **bold** item\n> quoted `code`\n1. first\n* star bullet'
  assert.equal(makePreview(body), 'Heading task one done bold item quoted code first star bullet')
})

test('preview strips italics and bold-italics, but leaves multiplication and stray asterisks alone', () => {
  assert.equal(makePreview('an *important* idea and ***vital*** one'), 'an important idea and vital one')
  assert.equal(makePreview('2*3*4 = 24 and a * b'), '2*3*4 = 24 and a * b')
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
