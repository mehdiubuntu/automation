import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { easing, spring } from '@/lib/motion/tokens'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

/** Children arrive in sequence so the state reads as composed, not dumped. */
const softStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const softItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easing.out } },
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <m.div
      variants={softStagger}
      initial="hidden"
      animate="visible"
      className="flex select-none flex-col items-center justify-center gap-1 py-16 text-center"
    >
      <m.p variants={softItem} className="text-sm font-medium text-gray-700">
        {title}
      </m.p>
      {hint && (
        <m.p variants={softItem} className="text-sm text-gray-400">
          {hint}
        </m.p>
      )}
    </m.div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <m.div
      variants={softStagger}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center gap-2 py-16 text-center"
    >
      <m.p variants={softItem} className="text-sm font-medium text-red-600">
        {message}
      </m.p>
      {onRetry && (
        <m.button
          variants={softItem}
          onClick={onRetry}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="text-sm text-brand-600 hover:underline"
        >
          Try again
        </m.button>
      )}
    </m.div>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <m.span
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
      className={cn(
        'inline-block h-5 w-5 rounded-full border-2 border-brand-500 border-t-transparent',
        className,
      )}
    />
  )
}

/**
 * Skeleton rows. The whole block fades in on a short delay so a fast response
 * (warm cache) never flashes a skeleton the user can't read anyway.
 */
export function LoadingRows({ rows = 5 }: { rows?: number }) {
  // The sweep is decoration, not information — drop it entirely when the user
  // asks for reduced motion (the delayed fade-in still marks the loading
  // state). Spinners are exempt from this: there, the motion IS the signal.
  const reduced = usePrefersReducedMotion()

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, delay: 0.15 }}
      className="space-y-2 py-4"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="relative h-10 overflow-hidden rounded-md bg-gray-100">
          {/* Sweep is a transform, not an animated background-position, so it
              composites instead of repainting each frame. */}
          {!reduced && (
            <m.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.045] to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear', delay: i * 0.08 }}
            />
          )}
        </div>
      ))}
    </m.div>
  )
}
