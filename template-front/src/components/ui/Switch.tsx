import { cn } from '@/lib/utils/cn'

export function Switch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-gray-300',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      {/* bg-[white] literal: the knob must stay light in dark mode too. */}
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-[white] shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}
