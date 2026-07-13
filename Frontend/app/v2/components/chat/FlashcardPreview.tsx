'use client'

import { useState } from 'react'
import type { Flashcard } from './scripts'
import { BRAND } from '../tokens'

export default function FlashcardPreview({ front, back }: Flashcard) {
  const [flipped, setFlipped] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      className="flip-card h-20 w-full text-left cursor-pointer"
      aria-label={`Flashcard: ${front}. Press to reveal ${flipped ? 'front' : 'back'}.`}
    >
      <div
        className="flip-card-inner relative h-full w-full"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        <div
          className="flip-card-front absolute inset-0 flex items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold text-slate-800"
          style={{ background: '#F7F7FB', borderColor: '#E4E1FB' }}
        >
          {front}
        </div>
        <div
          className="flip-card-back absolute inset-0 flex items-center justify-center rounded-xl px-3 text-center text-[11px] leading-snug text-white"
          style={{ background: BRAND }}
        >
          {back}
        </div>
      </div>
    </button>
  )
}
