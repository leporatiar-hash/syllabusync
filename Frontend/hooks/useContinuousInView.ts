import { useEffect, useRef, useState } from 'react'

/** Like useInView, but keeps reporting visibility changes as the element enters/exits. */
export function useContinuousInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}
