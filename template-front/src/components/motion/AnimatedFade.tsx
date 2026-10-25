import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { fadeUpVariants, fadeVariants } from '@/lib/motion/variants'

/** Simple fade(-up) wrapper for one-off content that should not just pop in. */
export function AnimatedFade({
  children,
  className,
  /** `up` adds the small Y travel; `plain` is opacity only. */
  variant = 'up',
  delay,
}: {
  children: React.ReactNode
  className?: string
  variant?: 'up' | 'plain'
  delay?: number
}) {
  return (
    <m.div
      variants={variant === 'up' ? fadeUpVariants : fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={delay ? { delay } : undefined}
      className={cn(className)}
    >
      {children}
    </m.div>
  )
}

/**
 * Cross-fades between mutually exclusive states (loading → error → empty →
 * content) without the flash you get from unmount/remount.
 *
 * `mode="wait"` is deliberate: overlapping a skeleton with real content
 * double-renders the same region and reads as a flicker. The outgoing state
 * leaves first, then the incoming one arrives.
 */
export function AnimatedSwitch({
  state,
  children,
  className,
}: {
  /** Discriminator — changing it triggers the cross-fade. */
  state: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={state}
        variants={fadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn(className)}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}

/**
 * Thin re-export of AnimatePresence so feature code has a single import site
 * for motion concerns and doesn't reach into framer directly for the common
 * case.
 */
export { AnimatePresence as AnimatedPresenceWrapper }
