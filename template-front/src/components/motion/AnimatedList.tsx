import { Children, isValidElement, useMemo } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { listItemVariants, staggerContainer } from '@/lib/motion/variants'
import { stagger } from '@/lib/motion/tokens'

/**
 * Staggered list container. Children mount in a short cascade; inserts,
 * removals and reorders are animated by `layout` on each item.
 *
 * Each child MUST carry a stable, meaningful `key` (a record id — not the array
 * index) or AnimatePresence cannot tell an insert from a reorder, and rows will
 * cross-fade in place instead of sliding.
 *
 * The cascade auto-disables past `stagger.maxChildren` items — see the token.
 */
export function AnimatedList({
  children,
  className,
  as: Tag = 'div',
  step = stagger.base,
  /** Set false for lists that only ever grow at one end (chat/timeline feeds). */
  layout = true,
}: {
  children: React.ReactNode
  className?: string
  /**
   * Deliberately no 'tbody': each child is wrapped in a <div>, which is invalid
   * inside a table and would break the row layout. Tables use `TBody`/`TR` from
   * `components/ui/Table` instead — those animate the <tr> itself.
   */
  as?: 'div' | 'ul' | 'ol'
  step?: number
  layout?: boolean
}) {
  const items = Children.toArray(children).filter(isValidElement)
  const container = useMemo(() => staggerContainer(items.length, step), [items.length, step])
  const MotionTag = m[Tag]

  return (
    <MotionTag
      variants={container}
      initial="hidden"
      animate="visible"
      // `relative` is required, not cosmetic: mode="popLayout" pins the exiting
      // child with position:absolute and left/top from its offsetParent. Without
      // a positioned container that offsetParent is some arbitrary ancestor and
      // the leaving row jumps across the page.
      className={cn('relative', className)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((child) => (
          <AnimatedListItem key={child.key} layout={layout}>
            {child}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </MotionTag>
  )
}

/**
 * One row. Exported so callers that need their own element type (a `<tr>`, a
 * custom wrapper) can compose the same motion without the container.
 */
export function AnimatedListItem({
  children,
  className,
  layout = true,
  standalone = false,
}: {
  children: React.ReactNode
  className?: string
  layout?: boolean
  /**
   * Set ONLY when using this outside an `AnimatedList`. It declares
   * `initial`/`animate` so the item animates on its own.
   *
   * Inside a container this must stay false: declaring string variant labels
   * makes an element "controlling its own variants", which excludes it from the
   * parent's variant-children set — and a parent's `staggerChildren` only
   * applies to that set. Setting them here silently kills the cascade (the
   * container's own `initial`/`animate` propagate down via context instead).
   */
  standalone?: boolean
}) {
  return (
    <m.div
      layout={layout ? 'position' : false}
      variants={listItemVariants}
      {...(standalone ? { initial: 'hidden', animate: 'visible' } : {})}
      exit="exit"
      className={cn(className)}
    >
      {children}
    </m.div>
  )
}
