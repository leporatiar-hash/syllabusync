export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
      {/* Animated owl logo */}
      <div className="mb-6 animate-bounce">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-[#5B8DEF]">
          <path
            d="M12 2C8 2 5.5 4 5.5 7.5V13c0 3 2.5 5 6.5 5s6.5-2 6.5-5V7.5C18.5 4 16 2 12 2z"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <circle cx="15" cy="10" r="1.5" fill="currentColor" />
          <path d="M9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Loading text */}
      <h2 className="mb-2 text-xl font-semibold text-slate-900">ClassMate is loading…</h2>
      <p className="text-sm text-slate-500">Organizing your academic life</p>

      {/* Animated progress bar */}
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-2/3 animate-loading-bar rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA]" />
      </div>
    </div>
  )
}
