import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { pageVariants } from '@/lib/motion/variants'

/**
 * Wraps a route's content so it fades and rises in on mount.
 *
 * Enter-only by design. PanelLayout remounts this per route (keyed on pathname)
 * rather than wrapping it in AnimatePresence: `<Outlet />` always renders the
 * current route, so an "exiting" copy would re-render showing the INCOMING
 * page's content — which left the node stuck at opacity 0 and, under
 * `mode="wait"`, blocked the new page from appearing at all.
 *
 * So `exit` is intentionally absent. If a real cross-fade is ever wanted, the
 * route element has to be captured per location (e.g. `useRoutes` returning the
 * element, or react-router's `useOutlet()` snapshotted in a ref) so the old and
 * new trees are genuinely different content — only then does AnimatePresence
 * have something valid to animate out.
 */
export function AnimatedPage({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <m.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className={cn('h-full', className)}
    >
      {children}
    </m.div>
  )
}
