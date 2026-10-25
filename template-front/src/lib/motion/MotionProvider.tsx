import { LazyMotion, MotionConfig, domMax } from 'framer-motion'

/**
 * App-wide motion policy. Mounted once, near the root.
 *
 * - `reducedMotion="user"` is the accessibility guarantee: when the OS asks for
 *   reduced motion, framer drops transform/layout animation from every `motion`
 *   component in the tree and animates opacity only. Individual components
 *   don't need to check the media query themselves.
 * - `LazyMotion` keeps the runtime out of the entry chunk: the `m` components
 *   ship a stub and the feature bundle loads alongside. This is why components
 *   in this app import `m`, not `motion`. `domMax` (not `domAnimation`) because
 *   the Kanban board and drag-to-close drawers need drag + layout projection.
 *
 * `strict` is deliberately NOT set: `strict` forbids the full `motion` import
 * anywhere in the tree, and third-party/edge cases (drag-heavy surfaces) still
 * want it. The convention is enforced by review, not by a runtime throw.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
