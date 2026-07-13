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

export const suggestions: Suggestion[] = [
  {
    id: 'late-policy',
    question: 'Can I still submit the BIO lab late?',
    answer: {
      kind: 'text',
      text: "Checking your BIO 101 syllabus — yes, but with a penalty. Your professor's late policy allows submissions up to 48 hours late for a 10% deduction per day. After that, it needs prior approval. Want me to draft a quick email to your professor?",
    },
  },
  {
    id: 'due-this-week',
    question: "What's due this week?",
    answer: {
      kind: 'deadlines',
      intro: "Here's everything on your plate this week:",
      items: [
        { course: 'FINC 400', title: 'Problem Set 6', when: 'Wed' },
        { course: 'ENTR 360', title: 'Pitch deck draft', when: 'Thu' },
        { course: 'BIO 101', title: 'Lab report', when: 'Fri' },
      ],
    },
  },
  {
    id: 'flashcards',
    question: 'Make me flashcards for Chapter 4',
    answer: {
      kind: 'flashcards',
      intro: 'Done! I pulled the key terms from your BIO 101 Chapter 4 notes — here\'s a preview:',
      cards: [
        { front: 'Mitosis', back: 'Cell division that produces two genetically identical daughter cells.' },
        { front: 'Homeostasis', back: "The body's ability to maintain stable internal conditions despite external change." },
      ],
    },
  },
]
