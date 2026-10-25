import { forwardRef, useEffect, useRef } from 'react'
import { AnimatePresence, m, useAnimationControls } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { errorMessageVariants, shakeVariants } from '@/lib/motion/variants'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900',
      // Placeholders sit one type-scale step below the value so hints read as
      // hints — the typed text keeps the visual weight.
      'placeholder:text-xs placeholder:text-gray-400',
      'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  /** Marks the field as mandatory with the standard red asterisk. */
  required?: boolean
  children: React.ReactNode
}) {
  const controls = useAnimationControls()
  const hadError = useRef(false)
  const reduced = usePrefersReducedMotion()

  // Shake on the error's RISING edge only. Re-rendering with the same error
  // (typing in a sibling field) must not re-shake — that's the usual bug with
  // this pattern and it makes a form feel broken.
  useEffect(() => {
    const has = Boolean(error)
    if (has && !hadError.current && !reduced) void controls.start('shake')
    hadError.current = has
  }, [error, controls, reduced])

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" title="Required" aria-hidden>
            *
          </span>
        )}
      </label>
      <m.div variants={shakeVariants} initial="idle" animate={controls}>
        {children}
      </m.div>
      {/* Collapses its own height, so nothing below the field jumps. */}
      <AnimatePresence initial={false}>
        {error && (
          <m.div
            variants={errorMessageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <p className="text-sm text-red-600">{error}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
