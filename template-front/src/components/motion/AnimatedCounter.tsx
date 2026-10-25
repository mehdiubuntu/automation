import { useEffect, useRef } from 'react'
import { m, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

/**
 * Number that counts up to its value when it scrolls into view, and re-counts
 * when the value changes.
 *
 * The tween runs entirely on motion values — the DOM text is written by a
 * subscription, so a counter animating from 0 to 12,000 causes zero React
 * re-renders. A `useState` implementation would re-render the whole KPI card
 * ~60 times a second.
 */
export function AnimatedCounter({
  value,
  className,
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
}: {
  value: number
  className?: string
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = usePrefersReducedMotion()
  const mv = useMotionValue(0)
  const smooth = useSpring(mv, { stiffness: 90, damping: 22, mass: 0.9 })
  const text = useTransform(smooth, format)

  useEffect(() => {
    if (reduced) {
      mv.jump(value)
      return
    }
    if (inView) mv.set(value)
  }, [inView, value, mv, reduced])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <m.span>{text}</m.span>
    </span>
  )
}

/** Progress bar that fills on mount. Animates scaleX — never width. */
export function AnimatedProgress({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number
  max?: number
  className?: string
  barClassName?: string
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-100', className)}>
      <m.div
        className={cn('h-full origin-left rounded-full bg-brand-500', barClassName)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={spring.smooth}
        style={{ width: '100%' }}
      />
    </div>
  )
}
