export const SCENE_MS = 4000
export const PAUSE_MS = 10000

export const steps = [
  {
    title: 'Upload your syllabus',
    copy: 'ClassMate extracts every deadline — quizzes, exams, assignments, projects. No manual entry required.',
  },
  {
    title: 'Connect your LMS',
    copy: 'Canvas or Brightspace (D2L), including OAKS. Connect once and ClassMate checks it every few hours for new and changed due dates.',
  },
  {
    title: 'Your semester, organized',
    copy: "Every deadline in one calendar, sorted by what's next, with reminders before things are due. No more digging through five PDFs.",
  },
  {
    title: 'Ask anything, study smarter',
    copy: 'Ask ClassMate about any deadline or policy, then turn your notes into flashcards, quizzes, or a summary in seconds.',
  },
] as const

export interface SceneProps {
  reducedMotion: boolean
}
