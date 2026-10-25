import { useRef } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Segmented one-time-code input (default 6 numeric boxes).
 * - Numeric only; typing advances, Backspace steps back, arrows move.
 * - Paste (or OS/SMS autofill via `autocomplete="one-time-code"`) spreads digits across the boxes.
 * - `onComplete` fires once when the last box is filled by the user, for auto-submit.
 * Controlled: `value` is the digits typed so far (no spaces).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  id,
  label = 'One-time code',
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  id?: string
  label?: string
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  const commit = (next: string, focusIndex: number) => {
    onChange(next)
    if (next.length === length && next !== value) onComplete?.(next)
    else focusAt(focusIndex)
  }

  /** Replace digits starting at `start` with `incoming` (already digits-only). */
  const spread = (start: number, incoming: string) => {
    const arr = digits.slice()
    let i = start
    for (const ch of incoming) {
      if (i >= length) break
      arr[i++] = ch
    }
    // Keep the value contiguous: stop at the first gap.
    const firstGap = arr.findIndex((d) => d === '')
    const next = (firstGap === -1 ? arr : arr.slice(0, firstGap)).join('')
    commit(next, Math.min(i, length - 1))
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const incoming = e.target.value.replace(/\D/g, '')
            if (!incoming) {
              // Cleared via selection+delete: drop this digit and everything after it.
              onChange(value.slice(0, i))
              return
            }
            spread(Math.min(i, value.length), incoming)
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
            if (pasted) spread(pasted.length === length ? 0 : Math.min(i, value.length), pasted)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              if (d) onChange(value.slice(0, i))
              else if (i > 0) {
                onChange(value.slice(0, i - 1))
                focusAt(i - 1)
              }
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              focusAt(i - 1)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              focusAt(i + 1)
            }
          }}
          className={cn(
            'h-12 w-full min-w-0 rounded-md border bg-white text-center font-mono text-xl text-gray-900',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-red-500' : 'border-gray-300',
          )}
        />
      ))}
    </div>
  )
}
