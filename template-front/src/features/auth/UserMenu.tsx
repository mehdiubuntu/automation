import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { useLogout } from './auth.hooks'
import { ROLE_LABELS } from './auth.types'
import { useAuth } from './useAuth'

/** Header account menu: identity + role badge, link to Account, sign out. */
export function UserMenu() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (user?.email[0] ?? '?').toUpperCase()

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-3">
      <span className="hidden max-w-[16rem] truncate text-sm text-gray-600 sm:block" title={user?.email}>
        {user?.email}
      </span>
      {user && <Badge tone={user.role === 'SUPERADMIN' ? 'purple' : 'gray'}>{ROLE_LABELS[user.role]}</Badge>}
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          // text-[white] literal: dark mode flips --color-white into a surface color.
          'flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-[white]',
          'hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        )}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-gray-900">{user?.email ?? 'User'}</p>
            {user && <p className="truncate text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>}
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={() => go('/account')}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Account
            </button>
            <button
              type="button"
              onClick={() => go('/settings')}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Settings
            </button>
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => {
                setOpen(false)
                if (!logout.isPending) logout.mutate()
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
