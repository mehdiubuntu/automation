import { useEffect } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { modalVariants, overlayVariants } from '@/lib/motion/variants'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // AnimatePresence (not an early `return null`) keeps the dialog mounted for
  // the length of its exit animation, so closing plays in reverse instead of
  // the panel vanishing.
  return (
    <AnimatePresence>
      {open && (
        <m.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
        >
          {/* Viewport-bound: the dialog never grows past the screen — the body
              scrolls inside instead (an over-tall centered dialog would clip both
              its top and bottom out of reach otherwise). */}
          <m.div
            role="dialog"
            aria-modal="true"
            variants={modalVariants}
            className={cn('flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl', className)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              {/* Long unbroken titles (e.g. an email subject) wrap instead of stretching the dialog. */}
              <h2 className="min-w-0 break-words text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">{title}</h2>
              <m.button
                onClick={onClose}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </m.button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
