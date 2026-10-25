import { spring } from './tokens'

/**
 * Hover/tap presets. Spread these onto a `motion` element rather than writing
 * `whileHover={{ scale: 1.02 }}` inline, so press/hover feel is identical
 * across buttons, cards, icon triggers and list rows.
 *
 * All are transform-only (GPU compositable) — no width/height/margin, nothing
 * that would force layout during the interaction.
 */

/** Standard button: barely-there grow on hover, real press on tap. */
export const interactiveButton = {
  whileHover: { scale: 1.02, y: -1 },
  whileTap: { scale: 0.975, y: 0 },
  transition: spring.snappy,
} as const

/** Icon-only triggers — scale only; a Y shift on a 36px target reads as jitter. */
export const interactiveIcon = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: spring.snappy,
} as const

/** Card hover lift. Pair with a CSS shadow transition for the depth cue. */
export const interactiveCard = {
  whileHover: { y: -2, scale: 1.004 },
  whileTap: { scale: 0.997 },
  transition: spring.snappy,
} as const

/** Rows and other wide targets: no scale (it distorts long text), lift only. */
export const interactiveRow = {
  whileHover: { x: 2 },
  whileTap: { x: 0, scale: 0.999 },
  transition: spring.snappy,
} as const

/** Subtle press for small chips/tags. */
export const interactiveChip = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.96 },
  transition: spring.snappy,
} as const
