import type { Transition } from 'framer-motion'

/**
 * The app's motion vocabulary. Every animated component pulls its timing from
 * here so the whole product moves with one voice — change a curve here and it
 * propagates everywhere instead of drifting per-component.
 *
 * Curves are the ones premium tools converge on: a strong ease-out for things
 * entering (fast start, soft landing) and a shorter, flatter curve for things
 * leaving (exits should get out of the way, not perform).
 */
export const easing = {
  /** Default entrance — decelerating, confident. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Exits — quick and unfussy. */
  in: [0.4, 0, 1, 1] as const,
  /** Symmetric moves (indicators sliding between positions). */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Subtle overshoot for elements that should feel physical. */
  emphasized: [0.2, 0, 0, 1] as const,
} as const

/** Durations in seconds. Anything above `slow` reads as sluggish in an admin panel. */
export const duration = {
  instant: 0.12,
  fast: 0.18,
  base: 0.24,
  slow: 0.36,
  page: 0.28,
} as const

/**
 * Springs. Framer's physics springs are preferred wherever an element is
 * responding to direct input (hover, press, drag, layout shifts) because the
 * motion stays interruptible — a tween restarts, a spring redirects.
 */
export const spring = {
  /** Snappy, near-critically damped — hovers, presses, indicators. */
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  /** Default for layout animations — settles without visible wobble. */
  smooth: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
  /** Softer, slightly bouncier — modals, drawers, things with presence. */
  gentle: { type: 'spring', stiffness: 260, damping: 28, mass: 1 },
  /** For dragged/dropped objects settling into place. */
  settle: { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 },
} as const satisfies Record<string, Transition>

/** Named tweens for cases where a deterministic duration matters. */
export const tween = {
  fast: { duration: duration.fast, ease: easing.out },
  base: { duration: duration.base, ease: easing.out },
  exit: { duration: duration.fast, ease: easing.in },
  page: { duration: duration.page, ease: easing.out },
} as const satisfies Record<string, Transition>

/** Stagger timing for lists. Kept small — long cascades feel slow, not premium. */
export const stagger = {
  /** Per-child delay in a standard list. */
  base: 0.035,
  /** Denser lists (table rows) — the cascade must not outlast the scan. */
  tight: 0.022,
  /** Delay before the first child starts. */
  delay: 0.04,
  /**
   * Beyond this many children the stagger is dropped entirely: a 100-row
   * cascade is a progress bar, not a polish detail.
   */
  maxChildren: 24,
} as const

/** Standard distances (px) so every component travels the same amount. */
export const distance = {
  /** Dropdowns, popovers, tooltips. */
  xs: 4,
  /** List items, cards, form rows. */
  sm: 8,
  /** Page content, modals. */
  md: 12,
  /** Hover lift for cards. */
  lift: -2,
} as const
