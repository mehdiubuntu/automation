/**
 * `Card` in `components/ui/Card` is already motion-driven (entrance variant,
 * optional hover-lift/press via `interactive`, `inStagger` to join a parent
 * cascade), and it's what the whole app imports. A second card component would
 * drift from it, so this is an alias, not a fork — same reasoning as
 * AnimatedButton / AnimatedTable.
 */
export { Card as AnimatedCard, type CardProps as AnimatedCardProps } from '@/components/ui/Card'
