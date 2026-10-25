import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

/**
 * Re-exported so components import motion concerns from one place. Framer's
 * hook is already subscription-based (no polling) and SSR-safe.
 *
 * The app-wide policy lives in MotionProvider: with `reducedMotion="user"`,
 * framer automatically strips transform/layout animation from every `motion`
 * component and keeps only opacity. Components therefore do NOT need to branch
 * on this hook for ordinary enter/exit work — reach for it only when an
 * animation is hand-rolled (a `useAnimate` sequence, a canvas loop, an
 * autoplaying loop like the bell ring) and framer can't neutralize it for you.
 */
export const useReducedMotion = useFramerReducedMotion

/** True when the user has asked for less motion. Convenience alias. */
export function usePrefersReducedMotion(): boolean {
  return useFramerReducedMotion() === true
}
