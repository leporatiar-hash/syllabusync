export default function TypingIndicator() {
  return (
    <div className="flex justify-start msg-in" aria-hidden="true">
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
