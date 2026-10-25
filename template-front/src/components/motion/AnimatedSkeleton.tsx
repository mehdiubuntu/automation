import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { easing } from '@/lib/motion/tokens'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

/**
 * Skeleton → content handoff without the flash.
 *
 * Two things prevent flashing:
 *  1. The skeleton fades IN on a short delay, so a fast response (the common
 *     case with a warm cache) never shows one at all.
 *  2. The swap is `mode="wait"` — the skeleton finishes leaving before the
 *     content arrives, so the same region is never painted twice in a frame.
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean
  skeleton: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(className)}>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <m.div
            key="skeleton"
            initial={{ opacity: 0 }}
            // Delayed in: a response under ~150ms skips the skeleton entirely.
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: easing.in } }}
          >
            {skeleton}
          </m.div>
        ) : (
          <m.div
            key="content"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: easing.out } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Shimmer bar. The sweep is a transform on a pseudo-layer rather than an
 * animated background-position, so it composites instead of repainting.
 */
export function Skeleton({ className }: { className?: string }) {
  // Decoration, not information — dropped under reduced motion. (Spinners are
  // exempt from that rule: there the motion IS the signal.)
  const reduced = usePrefersReducedMotion()
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-gray-100', className)}>
      {!reduced && (
        <m.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.04] to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

/** Standard multi-row skeleton for table/list loading states. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 py-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  )
}
