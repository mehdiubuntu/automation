import { useEffect, useState } from 'react'

/**
 * Reads the theme the same way the rest of the app does — a `dark` class on the
 * root, set by `theme.store` before first paint. Lives here (not in a component
 * file) so both the SVG primitives and the canvas chart engine can share one
 * observer.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return dark
}
