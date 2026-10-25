import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

/**
 * Empty state with a softly-arriving illustration and text.
 *
 * The parts arrive in sequence (mark, then title, then hint) rather than all at
 * once — an empty state is a small moment of disappointment, and staging it
 * makes the screen feel considered instead of blank.
 */
export function AnimatedEmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string
  hint?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <m.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
      }}
      className={cn(
        'flex select-none flex-col items-center justify-center gap-1 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <m.div
          variants={{
            hidden: { opacity: 0, scale: 0.85, y: 6 },
            visible: { opacity: 1, scale: 1, y: 0, transition: spring.gentle },
          }}
          className="mb-2 text-gray-300"
        >
          {icon}
        </m.div>
      )}
      <m.p
        variants={{
          hidden: { opacity: 0, y: 6 },
          visible: { opacity: 1, y: 0 },
        }}
        className="text-sm font-medium text-gray-700"
      >
        {title}
      </m.p>
      {hint && (
        <m.p
          variants={{
            hidden: { opacity: 0, y: 6 },
            visible: { opacity: 1, y: 0 },
          }}
          className="text-sm text-gray-400"
        >
          {hint}
        </m.p>
      )}
      {action && (
        <m.div
          variants={{
            hidden: { opacity: 0, y: 6 },
            visible: { opacity: 1, y: 0 },
          }}
          className="mt-3"
        >
          {action}
        </m.div>
      )}
    </m.div>
  )
}
