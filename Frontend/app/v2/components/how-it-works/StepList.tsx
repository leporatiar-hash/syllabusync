import { BRAND } from '../tokens'
import { steps } from './constants'

export default function StepList({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const isActive = i === active
        return (
          <button
            key={step.title}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={isActive}
            className={`w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
              isActive
                ? 'border-[#5B4EE8] bg-white shadow-md'
                : 'border-transparent bg-white/60 opacity-60 hover:border-slate-200 hover:opacity-100'
            }`}
          >
            <div className="mb-2 flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors"
                style={{ background: isActive ? BRAND : '#E2E8F0', color: isActive ? '#fff' : '#64748B' }}
              >
                {i + 1}
              </span>
              <span className="text-base font-semibold text-slate-900">{step.title}</span>
            </div>
            <p className="pl-10 text-sm leading-relaxed text-slate-600">{step.copy}</p>
          </button>
        )
      })}
    </div>
  )
}
