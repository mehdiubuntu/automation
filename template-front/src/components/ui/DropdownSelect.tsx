import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'
import { useAnchoredPanel } from '@/lib/hooks/useAnchoredPanel'
import { popoverVariants } from '@/lib/motion/variants'
import { spring } from '@/lib/motion/tokens'

export interface DropdownSelectOption {
  value: string
  label: string
  /** Optional color swatch before the label (e.g. a status color). */
  dot?: string
}

/**
 * Custom single-select dropdown — same interaction pattern as the record
 * page's Actions menu (button trigger + invisible backdrop to dismiss + styled
 * panel), for places where the native <select> popup can't be themed.
 *
 * Two modes share this component:
 * - Filters (default): `placeholder` is the trigger label while nothing is
 *   picked; the panel's first row (`clearLabel`) clears the value.
 * - Form selects: pass `clearable={false}` (a form field can't be emptied) and
 *   give the wrapper `w-full`; add `searchable` for long lists (time zones).
 *
 * Keyboard: Esc closes, Arrow keys move between options, Enter picks.
 */
export function DropdownSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  clearLabel = 'All',
  clearable = true,
  searchable = false,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: DropdownSelectOption[]
  placeholder: string
  clearLabel?: string
  /** false = no "clear" row (form fields that always hold a value). */
  clearable?: boolean
  /** Adds a filter box at the top of the panel — for long option lists. */
  searchable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // Body-portaled fixed panel: an absolute panel would be clipped inside
  // scrollable modal bodies and mis-anchored inside transformed slide-overs.
  const rect = useAnchoredPanel(open, rootRef, 288)
  const selected = options.find((o) => o.value === value)
  const filtered = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options

  // Esc closes, like the status color palette — expected of any popup filter.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const toggle = () => {
    setQuery('')
    setOpen((o) => !o)
  }

  const pick = (next: string) => {
    setOpen(false)
    if (next !== value) onChange(next)
  }

  // Arrow keys walk the option rows (roving focus) — parity with the native select.
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]') ?? [])]
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0)
    items[next]?.focus()
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            toggle()
          }
        }}
        className={cn(
          'inline-flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-sm transition-colors',
          selected
            ? 'border-brand-300 font-medium text-gray-900'
            : 'border-gray-300 text-gray-700 hover:border-gray-400',
        )}
      >
        {selected?.dot && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: selected.dot }}
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
        <m.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy} className="shrink-0">
          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
        </m.span>
      </button>
      {createPortal(
        <>
          {/* Invisible backdrop — clicking anywhere outside dismisses the menu.
              Kept OUTSIDE AnimatePresence: as a sibling of the exiting panel it
              would stay mounted for the whole exit, leaving a full-viewport
              click-eating layer after the menu looks closed (clicking an option
              then immediately clicking a nearby control would be swallowed). */}
          {open && rect && (
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          )}
          {/* AnimatePresence outside the open check so the panel can play its
              exit; `rect` is still required to position it at all. */}
          <AnimatePresence>
            {open && rect && (
              <m.div
                ref={panelRef}
                role="listbox"
                onKeyDown={onPanelKeyDown}
                variants={popoverVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
                className="fixed z-[60] flex min-w-56 origin-top flex-col rounded-lg border border-gray-200 bg-white shadow-lg"
              >
            {searchable && (
              <div className="border-b border-gray-100 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search options"
                  className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 placeholder:text-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      panelRef.current?.querySelector<HTMLButtonElement>('button[role="option"]')?.focus()
                    }
                  }}
                />
              </div>
            )}
            <div className="min-h-0 overflow-y-auto py-1">
              {clearable && !query && (
                <DropdownItem selected={value === ''} onClick={() => pick('')}>
                  <span className="text-gray-500">{clearLabel}</span>
                </DropdownItem>
              )}
              {filtered.map((o) => (
                <DropdownItem key={o.value} selected={o.value === value} onClick={() => pick(o.value)}>
                  {o.dot && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: o.dot }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{o.label}</span>
                </DropdownItem>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
            </div>
              </m.div>
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </div>
  )
}

function DropdownItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
        selected ? 'font-medium text-brand-600' : 'text-gray-700',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {selected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
    </button>
  )
}
