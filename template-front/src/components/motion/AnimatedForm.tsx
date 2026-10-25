import { useEffect, useRef } from 'react'
import { AnimatePresence, m, useAnimationControls } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { errorMessageVariants, fadeUpVariants, shakeVariants, stepVariants } from '@/lib/motion/variants'
import { spring } from '@/lib/motion/tokens'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

/**
 * Field wrapper that shakes when a validation error first appears and animates
 * the message in/out with its own height (so nothing below it jumps).
 *
 * The shake fires on the error's *rising edge* only — re-rendering with the
 * same error (typing in another field) must not re-shake, which is the usual
 * bug with this pattern.
 */
export function AnimatedField({
  error,
  children,
  className,
}: {
  error?: string | null
  children: React.ReactNode
  className?: string
}) {
  const controls = useAnimationControls()
  const hadError = useRef(false)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const has = Boolean(error)
    if (has && !hadError.current && !reduced) void controls.start('shake')
    hadError.current = has
  }, [error, controls, reduced])

  return (
    <div className={cn(className)}>
      <m.div variants={shakeVariants} initial="idle" animate={controls}>
        {children}
      </m.div>
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            variants={errorMessageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden text-xs text-red-600"
          >
            <span className="mt-1 block">{error}</span>
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Success confirmation — a checkmark that draws itself in.
 *
 * `pathLength` is the trick: framer normalizes SVG stroke-dash so animating it
 * 0 → 1 draws the stroke, which reads as "completed" far better than a
 * checkmark that simply fades in.
 */
export function AnimatedSuccess({
  show,
  label,
  className,
}: {
  show: boolean
  label?: string
  className?: string
}) {
  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={spring.gentle}
          className={cn('flex items-center gap-2 text-sm font-medium text-green-600', className)}
        >
          <m.span
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ ...spring.gentle, delay: 0.05 }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
              <m.path
                d="M4 12l5 5L20 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
              />
            </svg>
          </m.span>
          {label}
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** Multi-step form/wizard panel. `direction` drives which way the slide goes. */
export function AnimatedStep({
  step,
  direction = 1,
  children,
  className,
}: {
  /** Current step key — changing it plays the transition. */
  step: string | number
  direction?: 1 | -1
  children: React.ReactNode
  className?: string
}) {
  return (
    <m.div layout className={cn('overflow-hidden', className)} transition={spring.smooth}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div
          key={step}
          variants={stepVariants(direction)}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </m.div>
      </AnimatePresence>
    </m.div>
  )
}

/** A dynamically added/removed form row (repeatable field groups). */
export function AnimatedFieldRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <m.div
      layout
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={spring.smooth}
      className={cn(className)}
    >
      {children}
    </m.div>
  )
}
