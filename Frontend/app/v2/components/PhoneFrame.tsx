import type { ReactNode } from 'react'

function StatusBarGlyphs() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
        <rect x="0" y="7" width="3" height="4" rx="0.6" fill="currentColor" />
        <rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="currentColor" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="currentColor" />
        <rect x="13" y="0" width="3" height="11" rx="0.6" fill="currentColor" />
      </svg>
      <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="9.3" r="1.15" fill="currentColor" />
        <path
          d="M4.6 6.5a4.1 4.1 0 015.8 0M2.2 3.9a7.6 7.6 0 0110.6 0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <svg width="24" height="11" viewBox="0 0 24 11" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor" />
        <rect x="21.5" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5" />
      </svg>
    </div>
  )
}

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px] select-none">
      <div className="relative rounded-[3rem] bg-slate-900 p-[3%] shadow-2xl shadow-slate-900/25 ring-1 ring-black/5">
        <div className="relative flex aspect-[9/19.5] w-full flex-col overflow-hidden rounded-[2.35rem] bg-white">
          {/* Dynamic island */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-slate-900" />

          {/* Status bar */}
          <div className="flex shrink-0 items-center justify-between px-7 pb-1 pt-3 text-slate-400">
            <span className="text-[11px] font-semibold tabular-nums">9:41</span>
            <StatusBarGlyphs />
          </div>

          {/* Screen content — widgets manage their own internal scroll region */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    </div>
  )
}
