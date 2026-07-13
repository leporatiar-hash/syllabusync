export const SCENE_MS = 4000
export const PAUSE_MS = 10000

export const steps = [
  {
    title: 'Upload your syllabus',
    copy: 'ClassMate extracts every deadline — quizzes, exams, assignments, projects. No manual entry required.',
  },
  {
    title: 'Connect Canvas',
    copy: 'Link Canvas or OAKS in a click, or sync via iCal, Google Calendar, or Outlook — whatever you already use.',
  },
  {
    title: 'Your semester, organized',
    copy: "Every deadline lands in one place, automatically sorted by what's coming up next — no more digging through five different PDFs.",
  },
  {
    title: 'Ask anything, study smarter',
    copy: 'Ask ClassMate about any deadline or policy, then turn your notes into flashcards, quizzes, or a summary in seconds.',
  },
] as const

export interface SceneProps {
  reducedMotion: boolean
}
