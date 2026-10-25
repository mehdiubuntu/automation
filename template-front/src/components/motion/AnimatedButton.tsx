/**
 * `Button` itself is motion-driven (hover lift, press, animated loading state),
 * so there is deliberately no second implementation here — two button
 * components would drift apart and the app would animate inconsistently
 * depending on which one a screen imported.
 *
 * `AnimatedButton` is kept only as the name the animation architecture
 * advertises; it is an alias, not a fork.
 */
export { Button as AnimatedButton, type ButtonProps as AnimatedButtonProps } from '@/components/ui/Button'
