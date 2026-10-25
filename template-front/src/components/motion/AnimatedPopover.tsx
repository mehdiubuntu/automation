import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { popoverVariants } from '@/lib/motion/variants'

/**
 * Presence + motion for a dropdown/popover panel. Positioning stays with the
 * caller (this app anchors panels via `useAnchoredPanel` and portals them), so
 * this component deliberately owns *only* the animation and the transform
 * origin.
 *
 * `origin` should match the side the panel opens from — scaling out of the
 * trigger is what makes a menu feel attached to its button rather than dropped
 * on top of the page.
 */
export function AnimatedPopover({
  open,
  children,
  className,
  style,
  origin = 'top',
  role,
  ...rest
}: {
  open: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  origin?: 'top' | 'top-right' | 'top-left' | 'bottom' | 'bottom-right' | 'bottom-left'
  role?: string
} & Omit<React.ComponentProps<typeof m.div>, 'children' | 'className' | 'style' | 'role'>) {
  const originClass = {
    top: 'origin-top',
    'top-right': 'origin-top-right',
    'top-left': 'origin-top-left',
    bottom: 'origin-bottom',
    'bottom-right': 'origin-bottom-right',
    'bottom-left': 'origin-bottom-left',
  }[origin]

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role={role}
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={style}
          className={cn(originClass, className)}
          {...rest}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}
