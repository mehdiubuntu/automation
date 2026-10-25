/**
 * `Modal` in `components/ui/Modal` is already animated (overlay fade + panel
 * scale/rise, reversed on close via AnimatePresence) and every dialog in the app
 * imports it.
 *
 * Deliberately an alias rather than a second component: an earlier draft here
 * also closed on overlay click, which `ui/Modal` intentionally does NOT do.
 * Shipping both would mean two dialogs with different dismiss behaviour
 * depending on which one a screen happened to import — a worse outcome than
 * having one opinionated modal. If click-outside-to-close is ever wanted, change
 * it in `ui/Modal` so every dialog gets it at once.
 */
export { Modal as AnimatedModal } from '@/components/ui/Modal'
