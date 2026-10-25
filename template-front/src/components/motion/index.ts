/**
 * Single import site for every animated primitive.
 *
 *   import { AnimatedCard, AnimatedList } from '@/components/motion'
 *
 * Animation *code* (variants, tokens, interaction presets) lives in
 * `@/lib/motion`; the components here consume it. Feature code should reach for
 * these components first and only drop to raw `m.*` when a surface genuinely
 * needs bespoke motion — that keeps the language consistent.
 */

export { AnimatedPage } from './AnimatedPage'
export { AnimatedCard, type AnimatedCardProps } from './AnimatedCard'
export { AnimatedButton, type AnimatedButtonProps } from './AnimatedButton'
export { AnimatedModal } from './AnimatedModal'
export { AnimatedDrawer } from './AnimatedDrawer'
export { AnimatedList, AnimatedListItem } from './AnimatedList'
export { AnimatedTBody, AnimatedTR, AnimatedExpandRow } from './AnimatedTable'
export { AnimatedTabs, AnimatedTabPanel, type TabItem } from './AnimatedTabs'
export { AnimatedAccordion, AnimatedCollapse } from './AnimatedAccordion'
export { AnimatedTooltip } from './AnimatedTooltip'
export { AnimatedFade, AnimatedSwitch, AnimatedPresenceWrapper } from './AnimatedFade'
export { SkeletonSwap, Skeleton, SkeletonRows } from './AnimatedSkeleton'
export { AnimatedCounter, AnimatedProgress } from './AnimatedCounter'
export {
  AnimatedField,
  AnimatedSuccess,
  AnimatedStep,
  AnimatedFieldRow,
} from './AnimatedForm'
export { AnimatedPopover } from './AnimatedPopover'
export { AnimatedEmptyState } from './AnimatedEmptyState'
export { OrbitLoader, type OrbitLoaderSize } from './OrbitLoader'
