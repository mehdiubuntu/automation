import { forwardRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// text-[white] (literal), not text-white: the dark theme flips --color-white
// into a surface color (see styles/index.css); text on colored fills must not.
const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-[white] hover:bg-brand-700 dark:hover:bg-brand-500 focus-visible:ring-brand-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-[white] hover:bg-red-700 focus-visible:ring-red-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
}

/**
 * Motion props framer owns on a `motion` element — they collide with the React
 * DOM handlers of the same name, so they're excluded from the passthrough.
 */
type ClashingHandlers =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onTransitionEnd'

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, ClashingHandlers> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const inert = disabled || loading
    return (
      <m.button
        ref={ref}
        disabled={inert}
        // Skipped while inert: a button that still springs under the cursor
        // reads as clickable when it isn't.
        whileHover={inert ? undefined : { scale: 1.02, y: -1 }}
        whileTap={inert ? undefined : { scale: 0.975, y: 0 }}
        // `inert`, not `disabled`: the original dimmed via
        // `disabled:opacity-50` with `disabled={disabled || loading}`, so a
        // loading button was also dimmed. Keying on `disabled` alone dropped
        // that.
        animate={{ opacity: inert ? 0.5 : 1 }}
        transition={spring.snappy}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md font-medium',
          // transform is framer's; only the color/shadow cues stay on CSS.
          'transition-[background-color,box-shadow,border-color] duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {/* The spinner overlays the (still-mounted, faded) label, so the
            button never changes size while loading — no layout shift. */}
        <AnimatePresence>
          {loading && (
            <m.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <m.span
                className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
            </m.span>
          )}
        </AnimatePresence>
        <m.span
          animate={{ opacity: loading ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center justify-center gap-2"
        >
          {children}
        </m.span>
      </m.button>
    )
  }
)
Button.displayName = 'Button'
