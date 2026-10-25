import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useMotionValue, useTransform } from 'framer-motion'
import { create } from 'zustand'
import { cn } from '@/lib/utils/cn'
import { toastVariants } from '@/lib/motion/variants'

type ToastTone = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone: ToastTone) => void
  dismiss: (id: number) => void
}

const TOAST_MS = 4000

/**
 * The auto-dismiss timer lives in the toast component (so hover can pause it)
 * rather than in the store — the store only owns the list.
 */
let seq = 0
const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative helper usable outside React (mutation onError etc). */
export const toast = {
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  info: (m: string) => useToastStore.getState().push(m, 'info'),
}

const toneStyles: Record<ToastTone, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800',
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      {/* popLayout: a dismissed toast is pulled out of flow immediately so the
          ones below slide up smoothly instead of waiting for its exit. */}
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const x = useMotionValue(0)
  // Fade tracks the drag on the compositor — a useState here would re-render
  // the toast on every pointer frame.
  const opacity = useTransform(x, [0, 140], [1, 0])
  const [paused, setPaused] = useState(false)

  // Remaining-time tracking (not a plain restart) so repeated hovering can't
  // keep a toast alive forever, and so an un-hover resumes where it left off.
  const remaining = useRef(TOAST_MS)
  const startedAt = useRef(0)

  // The caller passes a fresh `onDismiss` closure on every parent render (one
  // per toast in a .map). Keeping it in a ref means it is NOT an effect dep:
  // otherwise every sibling toast's timer would restart — and its cleanup would
  // subtract elapsed time — each time any other toast is pushed or dismissed,
  // making toasts vanish early.
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => dismissRef.current(), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    }
  }, [paused])

  return (
    <m.div
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.7 }}
      style={{ x, opacity }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90 || info.velocity.x > 500) onDismiss()
      }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      className={cn(
        'pointer-events-auto relative max-w-sm cursor-grab overflow-hidden rounded-lg shadow-lg active:cursor-grabbing',
        toneStyles[t.tone],
      )}
    >
      <button
        onClick={onDismiss}
        className="block w-full px-4 py-3 text-left text-sm text-[white]"
      >
        {/* pre-line: multi-rule validation errors arrive newline-joined, one per line. */}
        <span className="whitespace-pre-line">{t.message}</span>
      </button>
      {/* scaleX, not width — keeps the countdown off the layout path.
          `key` restarts the bar's tween whenever pause state flips, so the
          resumed bar animates over the time that's actually left instead of
          reusing the original full duration. */}
      <m.div
        key={paused ? 'paused' : 'running'}
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-[white]/40"
        initial={{ scaleX: remaining.current / TOAST_MS }}
        animate={{ scaleX: paused ? remaining.current / TOAST_MS : 0 }}
        transition={
          paused ? { duration: 0 } : { duration: remaining.current / 1000, ease: 'linear' }
        }
      />
    </m.div>
  )
}
