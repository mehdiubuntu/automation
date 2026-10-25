import { createContext, forwardRef, useContext } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { tableRowVariants } from '@/lib/motion/variants'
import { spring, stagger } from '@/lib/motion/tokens'

/**
 * Column importance for narrow screens — lower-priority columns disappear
 * first as the table's container narrows, so the essentials (priority 1:
 * name, actions) always stay readable instead of every column crushing
 * together. Container queries, not media queries: a collapsed sidebar or a
 * split view buys columns back automatically.
 *
 *   1 — essential, never hidden
 *   2 — hidden when the table container is under ~576px
 *   3 — hidden under ~768px
 *   4 — hidden under ~1024px (first to go)
 */
export type ColumnPriority = 1 | 2 | 3 | 4

const PRIORITY_CLASS: Record<ColumnPriority, string | undefined> = {
  1: undefined,
  2: '@max-xl:hidden',
  3: '@max-3xl:hidden',
  4: '@max-5xl:hidden',
}

interface PriorityProps {
  /** Column importance — see ColumnPriority. Omit = always visible. */
  priority?: ColumnPriority
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="@container overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

/**
 * Marks the subtree as a table header so `TR` opts out of the body-row
 * entrance/layout animation automatically. Without this every page would have to
 * remember `animate={false}` on its header row, and a forgotten one fades the
 * column titles in on every mount.
 */
const HeaderContext = createContext(false)

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <HeaderContext.Provider value={true}>
      <thead className="border-b border-gray-200 bg-gray-50 text-left" {...props} />
    </HeaderContext.Provider>
  )
}

export function TH({ className, priority, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & PriorityProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
        priority && PRIORITY_CLASS[priority],
        className,
      )}
      {...props}
    />
  )
}

type ClashingHandlers =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onTransitionEnd'

export interface TRProps extends Omit<React.HTMLAttributes<HTMLTableRowElement>, ClashingHandlers> {
  /**
   * Row position — drives the entrance cascade. Omit for static/header rows.
   * Past `stagger.maxChildren` the delay is dropped: a 100-row cascade reads as
   * a slow page, not polish.
   */
  index?: number
  /**
   * Force animation on/off. Defaults to ON in a `<TBody>` and OFF inside
   * `<THead>` (resolved from context). Pass `false` explicitly for windowed or
   * virtualized bodies, where layout projection fights the windowing.
   */
  animate?: boolean
}

/**
 * Table row. `layout="position"` is what makes rows *move* to their new place
 * on sort/filter/paginate instead of jumping — framer measures the old and new
 * boxes and interpolates the delta on the compositor.
 *
 * This only works when each row carries a stable record-id `key`. With an array
 * index as the key, React reuses the same element for a different record and
 * the row cross-fades its contents in place instead of sliding.
 */
export function TR({ className, index, animate, ...props }: TRProps) {
  // Header rows never animate (see HeaderContext); body rows do unless the
  // caller opts out explicitly.
  const isHeader = useContext(HeaderContext)
  const shouldAnimate = animate ?? !isHeader
  if (!shouldAnimate) {
    return <tr className={cn('border-b border-gray-100 last:border-0', className)} {...props} />
  }
  const delay = index != null && index < stagger.maxChildren ? index * stagger.tight : 0
  return (
    <m.tr
      layout="position"
      variants={tableRowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ delay, layout: spring.smooth }}
      className={cn('border-b border-gray-100 last:border-0', className)}
      {...props}
    />
  )
}

/**
 * Body wrapper that lets removed rows play their exit before unmounting.
 * Optional — a plain `<tbody>` still works, rows just disappear instantly.
 */
export const TBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <tbody ref={ref} className={cn(className)} {...props}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </tbody>
  )
)
TBody.displayName = 'TBody'

export function TD({ className, priority, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & PriorityProps) {
  return (
    <td
      className={cn('px-4 py-3 text-gray-700', priority && PRIORITY_CLASS[priority], className)}
      {...props}
    />
  )
}
