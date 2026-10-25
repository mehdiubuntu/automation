import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { tooltipVariants } from '@/lib/motion/variants'

type Placement = 'top' | 'bottom' | 'left' | 'right'

/**
 * Centering is done with a flex wrapper per side rather than Tailwind's
 * `-translate-x-1/2`: framer animates `transform` on the tooltip itself, so any
 * class-based translate on the same element would be clobbered mid-animation.
 */
const anchorClass: Record<Placement, string> = {
  top: 'bottom-full left-0 right-0 mb-1.5 justify-center',
  bottom: 'top-full left-0 right-0 mt-1.5 justify-center',
  left: 'right-full top-0 bottom-0 mr-1.5 items-center',
  right: 'left-full top-0 bottom-0 ml-1.5 items-center',
}

/**
 * Hover/focus tooltip with an open delay.
 *
 * The delay matters more than the animation: an instant tooltip fires while the
 * pointer is merely crossing the element. Closing is immediate — a lingering
 * tooltip is worse than an abrupt one.
 */
export function AnimatedTooltip({
  label,
  children,
  placement = 'top',
  delay = 400,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  placement?: Placement
  delay?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // hide() only runs on mouseleave/blur, so without this the open-delay timer
  // outlives an unmount (row removed from a list, route change) and leaks.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <span
        className={cn('pointer-events-none absolute z-[70] flex', anchorClass[placement])}
        aria-hidden={!open}
      >
        <AnimatePresence>
          {open && (
            <m.span
              role="tooltip"
              variants={tooltipVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-[white] shadow-lg"
            >
              {label}
            </m.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  )
}
