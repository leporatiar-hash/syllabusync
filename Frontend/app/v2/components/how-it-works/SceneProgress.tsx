import { BRAND } from '../tokens'
import { SCENE_MS } from './constants'

export default function SceneProgress({
  count,
  active,
  paused,
  reducedMotion,
  cycleKey,
}: {
  count: number
  active: number
  paused: boolean
  reducedMotion: boolean
  cycleKey: number
}) {
  return (
    <div className="mt-4 flex gap-1.5" role="presentation">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
          {i < active && <div className="h-full w-full rounded-full" style={{ background: BRAND }} />}
          {i === active &&
            (reducedMotion || paused ? (
              <div className="h-full w-full rounded-full" style={{ background: BRAND }} />
            ) : (
              <div
                key={cycleKey}
                className="fill-scene h-full rounded-full"
                style={{ background: BRAND, animationDuration: `${SCENE_MS}ms` }}
              />
            ))}
        </div>
      ))}
    </div>
  )
}
