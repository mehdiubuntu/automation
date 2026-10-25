import { Suspense, useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatedPage } from '@/components/motion'
import { spring } from '@/lib/motion/tokens'
import { useAuth } from '@/features/auth/useAuth'
import { UserMenu } from '@/features/auth/UserMenu'
import { ROLE_LABELS, type UserRole } from '@/features/auth/auth.types'
import { FullscreenLoader } from '@/components/feedback/FullscreenLoader'
import { BrandMark } from '@/components/ui/BrandMark'
import {
  BriefcaseIcon,
  DashboardIcon,
  GearIcon,
  UsersIcon,
  type IconProps,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'
import './app-sidebar.css'

interface NavItem {
  to: string
  label: string
  icon: (props: IconProps) => React.ReactNode
  /** Roles that see this item. Omit = every signed-in user. */
  roles?: UserRole[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/projects', label: 'Projects', icon: BriefcaseIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['SUPERADMIN'] },
]

const SIDEBAR_KEY = 'app.sidebar'

export function PanelLayout() {
  const location = useLocation()
  const { user, hasRole } = useAuth()
  const email = user?.email
  const railRef = useRef<HTMLElement | null>(null)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === 'collapsed',
  )

  const toggleSidebar = () => {
    const rail = railRef.current
    if (rail) {
      // Freeze tooltips during the switch so they can't flash outside the
      // rail mid-collapse.
      rail.classList.add('app-switching')
      requestAnimationFrame(() =>
        requestAnimationFrame(() => rail.classList.remove('app-switching')),
      )
    }
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded')
      return next
    })
  }

  // Silk hover: track the cursor per-row so the liquid highlight follows it.
  const trackSheen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--app-mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--app-my', `${e.clientY - r.top}px`)
  }

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      onMouseMove={trackSheen}
      className={({ isActive }) => cn('app-nav-item', isActive && 'app-active')}
    >
      {/*
        No shared `layoutId` indicator here, deliberately. Two reasons, both
        checked: (1) `.app-nav-item` applies its own CSS transform on
        :hover/:active, and framer's layout projection cannot correct for a
        transform on an ancestor it doesn't manage — hovering the item you're
        about to click (the normal case) made the marker land up to 4px off and
        drift as the CSS spring settled; (2) `.app-active` already draws an
        `inset 3px` accent bar in exactly that position, so the marker was
        visually redundant. The existing CSS active treatment stays the
        indicator.
      */}
      <span className="app-ico" aria-hidden="true">
        {item.icon({})}
      </span>
      <span className="app-label">{item.label}</span>
      <span className="app-tip">{item.label}</span>
    </NavLink>
  )

  const visibleNav = NAV.filter((item) => !item.roles || hasRole(item.roles))
  const initial = (email?.[0] ?? '?').toUpperCase()
  const roleName = user ? ROLE_LABELS[user.role] : undefined
  // 2-letter badge code from the role (SUPERADMIN -> SU, SPARTAN -> SP).
  const roleCode = user?.role.slice(0, 2)

  return (
    <div className="flex h-full overflow-hidden">
      <aside ref={railRef} className={cn('app-rail', collapsed && 'app-collapsed')} aria-label="Primary">
        <Starfield railRef={railRef} />

        <div className="app-brand">
          {/* Full lockup cross-fades to the lone mark when the rail collapses. */}
          <span className="app-logo-full" role="img" aria-label="App">
            <span className="app-lk-logo">
              <BrandMark />
            </span>
            <span className="app-lk-title">App</span>
            <span className="app-lk-sub">
              Your tagline
            </span>
          </span>
          <BrandMark className="app-logo-mark" />
        </div>

        <div className="app-profile">
          <div className="app-avatar-wrap">
            <div className="app-avatar">{initial}</div>
            {roleCode && (
              <span className="app-role-badge" title={roleName} aria-label={roleName}>
                {roleCode}
              </span>
            )}
          </div>
          <div className="app-pf-meta">
            <div className="app-profile-name" title={email ?? undefined}>
              {email ?? 'User'}
            </div>
            {roleName && <div className="app-profile-sub">{roleName}</div>}
          </div>
        </div>

        <nav className="app-nav" aria-label="Main">
          {visibleNav.map(renderNavItem)}
          <div className="app-nav-divider" />
          {renderNavItem({ to: '/settings', label: 'Settings', icon: GearIcon })}
        </nav>

        <m.button
          type="button"
          className="app-collapse-toggle"
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebar}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
        >
          <m.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={spring.smooth}
          >
            <path d="M15 6l-6 6 6 6" />
          </m.svg>
        </m.button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-gray-200 bg-white px-6">
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto bg-gray-50">
          {/*
            Enter-only page transition, deliberately WITHOUT AnimatePresence.

            An exit transition is not workable here: `<Outlet />` always renders
            the CURRENT route, so an outgoing child re-renders with the incoming
            page's content instead of its own. Under AnimatePresence that showed
            up as a node stuck at opacity 0 (with `mode="wait"` it blocked the
            new page from ever appearing — the "blank until refresh" bug).
            Freezing the old element would need the route's own element captured
            per location, which react-router's Outlet doesn't hand us here.

            Remounting on `location.pathname` (not the location object, so a
            query-string change from filters/pagination doesn't replay the
            transition) gives the fade+rise on every navigation. Suspense sits
            inside, so a lazy chunk suspends within the keyed child.
          */}
          <AnimatedPage key={location.pathname}>
            <Suspense fallback={<FullscreenLoader />}>
              <Outlet />
            </Suspense>
          </AnimatedPage>
        </main>
      </div>
    </div>
  )
}

// Scoped accent starfield — drifting, twinkling stars with faint constellation
// lines, sized to the rail. A trimmed port of the cue-prod reference (no
// meteors / cursor-repel). Pure presentation: static dots under
// prefers-reduced-motion.
function Starfield({ railRef }: { railRef: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const rail = railRef.current
    const canvas = canvasRef.current
    if (!rail || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let reduce = false
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* no matchMedia — assume motion ok */
    }

    const ACCENT = [181, 229, 31]
    const CONNECT_D = 92
    let W = 0
    let H = 0
    type Star = {
      x: number
      y: number
      r: number
      layer: number
      big: boolean
      vx: number
      vy: number
      phase: number
      twSpeed: number
      baseAlpha: number
    }
    let stars: Star[] = []
    let raf = 0

    const buildStars = () => {
      stars = []
      const count = Math.max(14, Math.round((W * H) / 5200))
      for (let i = 0; i < count; i++) {
        const big = i % 23 === 3
        const layer = 0.3 + Math.random() * 0.7
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: big ? 2.4 + Math.random() * 1.1 : 0.5 + layer * 0.95,
          layer,
          big,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          phase: Math.random() * Math.PI * 2,
          twSpeed: 0.4 + Math.random() * 0.9,
          baseAlpha: big ? 0.42 + Math.random() * 0.16 : 0.12 + layer * 0.16,
        })
      }
    }

    const sizeTo = () => {
      const w = Math.max(1, rail.clientWidth)
      const h = Math.max(1, rail.clientHeight)
      if (W === 0) {
        W = w
        H = h
        canvas.width = w
        canvas.height = h
        buildStars()
        return
      }
      const sx = w / W
      const sy = h / H
      for (const s of stars) {
        s.x *= sx
        s.y *= sy
      }
      W = w
      H = h
      canvas.width = w
      canvas.height = h
    }

    let t = 0
    const frame = () => {
      ctx.clearRect(0, 0, W, H)
      for (const s of stars) {
        s.x += s.vx
        s.y += s.vy
        if (s.x < -5) s.x = W + 5
        if (s.x > W + 5) s.x = -5
        if (s.y < -5) s.y = H + 5
        if (s.y > H + 5) s.y = -5
        const tw = Math.sin(t * s.twSpeed + s.phase)
        const alpha = Math.min(1, s.baseAlpha + tw * 0.08)
        const rad = s.r * (0.86 + tw * 0.14)
        ctx.fillStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, rad, 0, Math.PI * 2)
        ctx.fill()
        if (s.big) {
          const gRad = rad * 4
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, gRad)
          g.addColorStop(0, `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${(alpha * 0.4).toFixed(3)})`)
          g.addColorStop(1, 'transparent')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(s.x, s.y, gRad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      for (let a = 0; a < stars.length; a++) {
        const A = stars[a]
        for (let b = a + 1; b < stars.length; b++) {
          const B = stars[b]
          if (Math.abs(A.layer - B.layer) > 0.3) continue
          const dd = Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2)
          if (dd < CONNECT_D) {
            const la = (1 - dd / CONNECT_D) * 0.1 * A.layer
            ctx.strokeStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${la.toFixed(3)})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(A.x, A.y)
            ctx.lineTo(B.x, B.y)
            ctx.stroke()
          }
        }
      }
      t += 0.006
      raf = requestAnimationFrame(frame)
    }

    sizeTo()

    let ro: ResizeObserver | null = null
    if (reduce) {
      for (const s of stars) {
        ctx.fillStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${s.baseAlpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      if (window.ResizeObserver) {
        ro = new ResizeObserver(sizeTo)
        ro.observe(rail)
      } else {
        window.addEventListener('resize', sizeTo)
      }
      frame()
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', sizeTo)
      if (ro) ro.disconnect()
    }
  }, [railRef])

  return <canvas ref={canvasRef} className="app-stars" aria-hidden="true" />
}
