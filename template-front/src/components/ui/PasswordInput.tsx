import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { EyeIcon, EyeOffIcon } from './icons'
import { Input, type InputProps } from './Input'

/**
 * Password field with its own show/hide toggle (the GitHub/Google pattern).
 * Every instance toggles independently; `type` is managed internally.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
