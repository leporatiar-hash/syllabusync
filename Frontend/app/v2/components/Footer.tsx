export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/brand/classmate-owl.png" alt="" className="h-6 w-auto" />
          <div>
            <span className="font-bold block">ClassMate</span>
            <span className="text-xs text-slate-400">The AI that knows your entire semester.</span>
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
        <div className="text-sm text-slate-400">© {new Date().getFullYear()} ClassMate. All rights reserved.</div>
      </div>
    </footer>
  )
}
