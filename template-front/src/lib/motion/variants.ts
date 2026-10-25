import type { Variants } from 'framer-motion'
import { distance, easing, spring, stagger, tween } from './tokens'

/**
 * Shared variant presets. Components reference these by name rather than
 * inlining `initial`/`animate` objects, which keeps the animation language
 * consistent and means the objects are module-constant (stable identity — no
 * new object per render, so no needless re-renders in motion's diffing).
 */

/** Plain opacity fade — the safest transition, used as the universal fallback. */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: tween.base },
  exit: { opacity: 0, transition: tween.exit },
}

/** Fade + rise. The default entrance for content blocks. */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: distance.sm },
  visible: { opacity: 1, y: 0, transition: tween.base },
  exit: { opacity: 0, y: -distance.xs, transition: tween.exit },
}

/** Page-level: fade, a touch of scale, small Y. Reads as "this is new". */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: distance.md, scale: 0.994 },
  visible: { opacity: 1, y: 0, scale: 1, transition: tween.page },
  exit: {
    opacity: 0,
    y: -distance.sm,
    scale: 0.996,
    transition: { duration: 0.16, ease: easing.in },
  },
}

/** Card entrance — same family as fadeUp but with the scale cue. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: distance.sm, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring.smooth },
  exit: { opacity: 0, scale: 0.985, transition: tween.exit },
}

/** Modal dialog — scales up from just below, settles with a gentle spring. */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: distance.md },
  visible: { opacity: 1, scale: 1, y: 0, transition: spring.gentle },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: distance.xs,
    transition: { duration: 0.14, ease: easing.in },
  },
}

/** The dimmed backdrop behind modals/drawers — fade only, never scale. */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: easing.out } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: easing.in } },
}

/**
 * Popovers/dropdowns/tooltips. Scale from the anchor edge (pair with a
 * transform-origin matching the trigger) so the panel reads as growing out of
 * the button rather than appearing over it.
 */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -distance.xs },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: easing.out },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -distance.xs / 2,
    transition: { duration: 0.11, ease: easing.in },
  },
}

/** Tooltip — faster and smaller than a popover; it must never feel like UI. */
export const tooltipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: distance.xs },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.13, ease: easing.out } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.09, ease: easing.in } },
}

/** Toast/notification — slides in from the right edge and settles. */
export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.96 },
  visible: { opacity: 1, x: 0, scale: 1, transition: spring.snappy },
  exit: {
    opacity: 0,
    x: 24,
    scale: 0.96,
    transition: { duration: 0.18, ease: easing.in },
  },
}

/** List rows — the child half of a staggered container. */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: distance.sm },
  visible: { opacity: 1, y: 0, transition: tween.base },
  exit: { opacity: 0, y: -distance.xs, transition: tween.exit },
}

/** Table rows — flatter travel than list items so dense tables stay calm. */
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: distance.xs },
  visible: { opacity: 1, y: 0, transition: tween.fast },
  exit: { opacity: 0, transition: { duration: 0.12, ease: easing.in } },
}

/** Gentle horizontal shake for a rejected input. Deliberately small. */
export const shakeVariants: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -4, 3.5, -2.5, 1.5, 0],
    transition: { duration: 0.36, ease: easing.inOut },
  },
}

/** Field-level validation message — collapses its own height. */
export const errorMessageVariants: Variants = {
  hidden: { opacity: 0, height: 0, y: -2 },
  visible: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: { height: tween.fast, opacity: tween.fast, y: tween.fast },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -2,
    transition: { duration: 0.14, ease: easing.in },
  },
}

/** Accordion/expanding section — auto-height done correctly. */
export const collapseVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.26, ease: easing.out }, opacity: { duration: 0.2, ease: easing.out, delay: 0.04 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.2, ease: easing.in }, opacity: { duration: 0.12, ease: easing.in } },
  },
}

/** Drawer/side panel, per edge. Position is handled by the component's classes. */
export const drawerVariants = {
  right: {
    hidden: { x: '100%' },
    visible: { x: 0, transition: spring.gentle },
    exit: { x: '100%', transition: { duration: 0.2, ease: easing.in } },
  },
  left: {
    hidden: { x: '-100%' },
    visible: { x: 0, transition: spring.gentle },
    exit: { x: '-100%', transition: { duration: 0.2, ease: easing.in } },
  },
  bottom: {
    hidden: { y: '100%' },
    visible: { y: 0, transition: spring.gentle },
    exit: { y: '100%', transition: { duration: 0.2, ease: easing.in } },
  },
} satisfies Record<string, Variants>

/**
 * Container that staggers its children. `count` disables the cascade past
 * `stagger.maxChildren` — see the token comment for why.
 */
export function staggerContainer(count = 0, step: number = stagger.base): Variants {
  const on = count > 0 && count <= stagger.maxChildren
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: on ? step : 0,
        delayChildren: on ? stagger.delay : 0,
      },
    },
    exit: { transition: { staggerChildren: 0 } },
  }
}

/** Directional slide for step/wizard transitions. */
export function stepVariants(direction: 1 | -1): Variants {
  return {
    hidden: { opacity: 0, x: direction * 24 },
    visible: { opacity: 1, x: 0, transition: tween.base },
    exit: { opacity: 0, x: direction * -24, transition: tween.exit },
  }
}
