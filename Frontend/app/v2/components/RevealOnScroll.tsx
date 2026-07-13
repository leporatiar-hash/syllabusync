'use client'

import type { ReactNode } from 'react'
import { useInView } from '../../../hooks/useInView'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'

export default function RevealOnScroll({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const reducedMotion = usePrefersReducedMotion()
  const show = reducedMotion || inView

  return (
    <div
      ref={ref}
      className={`${reducedMotion ? '' : 'transition-all duration-700'} ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } ${className}`}
    >
      {children}
    </div>
  )
}
