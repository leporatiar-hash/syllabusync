export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
      {/* Animated logo */}
      <div className="mb-6 animate-bounce">
        <img src="/brand/logo.svg" alt="" width={64} height={64} />
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
