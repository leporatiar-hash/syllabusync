'use client'

import { useEffect, useRef, useState } from 'react'
import { useContinuousInView } from '../../../../hooks/useContinuousInView'
import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion'
import PhoneFrame from '../PhoneFrame'
import SceneProgress from './SceneProgress'
import StepList from './StepList'
import UploadScene from './UploadScene'
import ConnectScene from './ConnectScene'
import CalendarScene from './CalendarScene'
import ChatStudyScene from './ChatStudyScene'
import { PAUSE_MS, SCENE_MS } from './constants'

const SCENES = [UploadScene, ConnectScene, CalendarScene, ChatStudyScene]

export default function DemoPhone() {
  const { ref, inView } = useContinuousInView<HTMLDivElement>(0.25)
  const reducedMotion = usePrefersReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const pauseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Auto-advance: restarts a fresh SCENE_MS window whenever the active scene
  // or pause state changes, and stands down entirely offscreen or when the
  // visitor prefers reduced motion.
  useEffect(() => {
    if (reducedMotion || !inView || paused) return
    const id = setTimeout(() => {
      setActive((s) => (s + 1) % SCENES.length)
      setCycleKey((k) => k + 1)
    }, SCENE_MS)
    return () => clearTimeout(id)
  }, [active, paused, inView, reducedMotion])

  useEffect(() => () => clearTimeout(pauseTimer.current), [])

  const handleSelect = (i: number) => {
    setActive(i)
    setCycleKey((k) => k + 1)
    clearTimeout(pauseTimer.current)
    if (reducedMotion) return
    setPaused(true)
    pauseTimer.current = setTimeout(() => {
      setPaused(false)
      setCycleKey((k) => k + 1)
    }, PAUSE_MS)
  }

  const Scene = SCENES[active]

  return (
    <div ref={ref} className="grid gap-10 lg:grid-cols-2 lg:items-start">
      <div className="lg:sticky lg:top-24">
        <PhoneFrame>
          <div key={active} className="flex min-h-0 flex-1 flex-col">
            <Scene reducedMotion={reducedMotion} />
          </div>
        </PhoneFrame>
        <SceneProgress
          count={SCENES.length}
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
          cycleKey={cycleKey}
        />
      </div>
      <StepList active={active} onSelect={handleSelect} />
    </div>
  )
}
