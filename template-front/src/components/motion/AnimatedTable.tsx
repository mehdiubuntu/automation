import { AnimatePresence, m } from 'framer-motion'
import { collapseVariants } from '@/lib/motion/variants'

/**
 * Table row motion lives in `components/ui/Table` (`TBody` + `TR`), not here —
 * those animate the real `<tr>`/`<tbody>` and are what all nine table pages
 * already use. A second implementation would drift from it, so `AnimatedTBody`
 * and `AnimatedTR` are aliases, not forks (same reasoning as AnimatedButton).
 */
export { TBody as AnimatedTBody, TR as AnimatedTR } from '@/components/ui/Table'

/**
 * Expandable detail row — genuinely additive, so it lives here.
 *
 * Rendered as a full-width `<tr>` so it stays inside the table's box model; the
 * height animation happens on a div inside the cell because a `<td>` cannot be
 * height-animated reliably across browsers.
 */
export function AnimatedExpandRow({
  open,
  colSpan,
  children,
}: {
  open: boolean
  colSpan: number
  children: React.ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        // The <tr> must itself be a motion element, otherwise AnimatePresence
        // has no component to defer the unmount on and the row vanishes before
        // the inner collapse can play.
        <m.tr initial={false}>
          <td colSpan={colSpan} className="p-0">
            <m.div
              variants={collapseVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
            >
              <div className="bg-gray-50 px-4 py-3">{children}</div>
            </m.div>
          </td>
        </m.tr>
      )}
    </AnimatePresence>
  )
}
