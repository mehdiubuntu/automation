import { useLayoutEffect, useState } from 'react'

export interface AnchoredPanelRect {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * Viewport-fixed coordinates for a dropdown panel anchored under `anchorRef`,
 * for panels rendered through a body portal. Absolute panels get clipped by
 * `overflow-y-auto` ancestors (modal bodies) and mis-anchored by transformed
 * ancestors (slide-overs); portal + fixed escapes both. Re-measures while open
 * on scroll (capturing, so nested scroll containers count) and resize; pass
 * `watch` to re-measure on state that changes the anchor's height (e.g. chips
 * wrapping to a new line). `maxHeight` shrinks near the viewport bottom so the
 * panel scrolls instead of running off-screen.
 */
export function useAnchoredPanel(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  maxHeight: number,
  watch?: unknown,
): AnchoredPanelRect | null {
  const [rect, setRect] = useState<AnchoredPanelRect | null>(null)

  useLayoutEffect(() => {
    void watch
    if (!open) {
      setRect(null)
      return
    }
    const measure = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      setRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(160, Math.min(maxHeight, window.innerHeight - r.bottom - 12)),
      })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, anchorRef, maxHeight, watch])

  return rect
}
