export interface Flashcard {
  front: string
  back: string
}

export interface DeadlineItem {
  course: string
  title: string
  when: string
}

export type ScriptedAnswer =
  | { kind: 'text'; text: string }
  | { kind: 'deadlines'; intro: string; items: DeadlineItem[] }
  | { kind: 'flashcards'; intro: string; cards: Flashcard[] }

export interface Suggestion {
  id: string
  question: string
  answer: ScriptedAnswer
}

export const introExchange = {
  question: "What's my heaviest week this semester?",
  answer: {
    kind: 'text' as const,
    text: "Looking at your 4 courses — April 14–18 is your busiest week. You have a FINC 400 final, an ENTR 360 presentation, and a FINC 382 quiz all in 5 days. Want me to build a study schedule?",
  },
}

// Hero demo: the push alert that opens it, then the first question. (introExchange above is
// still used by the how-it-works "Ask anything" scene.)
export const heroAlert = {
  title: 'Due date changed: Essay 2',
  body: 'ENGL 110 · now Fri, 11:59 PM (was Tue)',
}

export const heroExchange = {
  question: 'What changed in my classes this week?',
  answer: {
    kind: 'deadlines' as const,
    intro: 'Your professors updated 2 things in your LMS. Your calendar is already fixed:',
    items: [
      { course: 'ENGL 110', title: 'Essay 2', when: 'Fri · was Tue' },
      { course: 'BIO 101', title: 'Quiz 4', when: 'New · Thu' },
    ],
  },
}

export const suggestions: Suggestion[] = [
  {
    id: 'due-tomorrow',
    question: "What's due tomorrow?",
    answer: {
      kind: 'deadlines',
      intro: "Two things. I'll remind you again tonight:",
      items: [
        { course: 'FINC 400', title: 'Problem Set 6', when: '11:59 PM' },
        { course: 'BIO 101', title: 'Lab report', when: '9:00 AM' },
      ],
    },
  },
  {
    id: 'plan-week',
    question: 'Plan my week',
    answer: {
      kind: 'text',
      text: 'You have 6 deadlines this week and Thursday is the busiest: Quiz 4 and the ENTR 360 pitch draft. Start the pitch Tuesday night, since Essay 2 moved to Friday and frees up Wednesday.',
    },
  },
  {
    id: 'late-policy',
    question: 'Can I still submit the BIO lab late?',
    answer: {
      kind: 'text',
      text: "Checking your BIO 101 syllabus: yes, with a penalty. Late work is accepted up to 48 hours late for 10% off per day. After that it needs prior approval. Want me to draft an email to your professor?",
    },
  },
]
