export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2.5">
          <img src="/brand/logo-inverted.svg" alt="" className="h-7 w-7 shrink-0" />
          <div>
            <span className="font-bold block">classmate</span>
            <span className="text-xs text-slate-400">Never get caught off guard by a due date.</span>
          </div>
        </div>
        <div className="flex gap-6 text-sm text-slate-400">
          <a href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white transition-colors">
            Terms
          </a>
          <a href="mailto:hello@tryclassmate.com" className="hover:text-white transition-colors">
            Contact
          </a>
        </div>
        <div className="text-sm text-slate-400">© {new Date().getFullYear()} classmate. All rights reserved.</div>
      </div>
      <p className="max-w-6xl mx-auto mt-6 text-xs text-slate-500 text-center md:text-left">
        classmate is independent and not affiliated with your school, Instructure (Canvas), D2L (Brightspace) or Anthology (Blackboard).
      </p>
    </footer>
  )
}
