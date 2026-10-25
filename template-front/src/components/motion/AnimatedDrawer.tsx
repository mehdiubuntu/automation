import { useEffect } from 'react'
import { AnimatePresence, m, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { drawerVariants, overlayVariants } from '@/lib/motion/variants'

type Side = 'right' | 'left' | 'bottom'

const sideClass: Record<Side, string> = {
  right: 'right-0 top-0 h-full w-full max-w-xl border-l',
  left: 'left-0 top-0 h-full w-full max-w-xl border-r',
  bottom: 'bottom-0 left-0 w-full max-h-[85dvh] rounded-t-2xl border-t',
}

/**
 * Edge-anchored panel with drag-to-close.
 *
 * Drag is constrained to the closing axis with elastic resistance in the
 * opposite direction, so the panel can be flicked away but never dragged off
 * its anchor. Release commits the close when the gesture passes either a
 * distance threshold or a velocity threshold — velocity matters because a fast
 * short flick should dismiss just as a slow long drag does.
 */
export function AnimatedDrawer({
  open,
  onClose,
  side = 'right',
  children,
  className,
  ariaLabel,
  /** Drag-to-close is on by default; disable for panels with draggable content. */
  draggable = true,
}: {
  open: boolean
  onClose: () => void
  side?: Side
  children: React.ReactNode
  className?: string
  ariaLabel?: string
  draggable?: boolean
}) {
  const dragControls = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const axis = side === 'bottom' ? 'y' : 'x'
  // Constraints pin the panel at its anchor; `dragElastic` then allows travel
  // only in the outward (closing) direction, so it can never be pulled inward
  // past the edge it is docked to.
  const constraints = { top: 0, bottom: 0, left: 0, right: 0 }
  const elastic =
    side === 'right'
      ? { top: 0, bottom: 0, left: 0, right: 0.3 }
      : side === 'left'
        ? { top: 0, bottom: 0, left: 0.3, right: 0 }
        : { top: 0, bottom: 0.3, left: 0, right: 0 }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="drawer-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/40"
        >
          <m.aside
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            variants={drawerVariants[side]}
            drag={draggable ? axis : false}
            dragControls={dragControls}
            dragConstraints={constraints}
            dragElastic={elastic}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const travel = axis === 'x' ? info.offset.x : info.offset.y
              const speed = axis === 'x' ? info.velocity.x : info.velocity.y
              const outward = side === 'left' ? -1 : 1
              if (travel * outward > 120 || speed * outward > 500) onClose()
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed flex flex-col border-gray-200 bg-white shadow-2xl',
              sideClass[side],
              className,
            )}
          >
            {side === 'bottom' && (
              <div className="flex shrink-0 justify-center py-2.5">
                <span className="h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
              </div>
            )}
            {children}
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>
  )
}
