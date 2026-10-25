import { useId, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { collapseVariants } from '@/lib/motion/variants'
import { spring } from '@/lib/motion/tokens'

/**
 * Expand/collapse with a correct auto-height animation.
 *
 * `height: 'auto'` is animatable here because framer measures the target box
 * and interpolates to the measured pixel value, then hands control back to
 * `auto` on completion — so the section still reflows normally afterwards.
 * The inner wrapper carries `overflow-hidden` so content clips during the
 * transition instead of spilling past the collapsing edge.
 */
export function AnimatedCollapse({
  open,
  children,
  className,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          variants={collapseVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden"
        >
          <div className={cn(className)}>{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** A self-contained accordion section with a chevron that rotates on toggle. */
export function AnimatedAccordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={cn('border-b border-gray-200 last:border-0', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-gray-900"
      >
        <span className="min-w-0">{title}</span>
        <m.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          className="shrink-0 text-gray-400"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </m.span>
      </button>
      <div id={panelId}>
        <AnimatedCollapse open={open} className="pb-3">
          {children}
        </AnimatedCollapse>
      </div>
    </div>
  )
}
