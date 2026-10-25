import { useEffect, useState, type ReactNode } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import './auth.css'

// Split-screen auth shell (design ported from cue-prod). On mount the brand
// panel fills the viewport and plays its draw-in choreography; after the
// reveal delay it splits to 50/50 (stacked on mobile) and the form panel
// fades/slides in. The choreography is a first-impression beat, so it plays
// once per tab session: the first auth page mounted sets INTRO_SEEN_KEY and
// every later mount renders the finished split immediately (`.is-instant`).
const REVEAL_DELAY_MS = 4000
const REVEAL_DELAY_REDUCED_MS = 200
// Secondary auth pages (forgot/reset) cut the intro short — someone mid
// password-reset just needs the form.
const SHORT_REVEAL_MS = 250
const INTRO_SEEN_KEY = 'app-auth-intro-seen'

// sessionStorage can throw (blocked storage); treat that as "not seen" so the
// worst case is replaying the intro, never a crash.
function introAlreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // ignore — intro will just replay next time
  }
}

// Animated brand panel: the brand mark draws itself in, then the two-line
// tagline rises. All timing lives in auth.css; this only supplies markup.
export function BrandShowcase() {
  return (
    <div className="auth-brand-stage">
      <div className="lockup" role="img" aria-label="App">
        <span className="lk-mark">
          <BrandMark />
        </span>
        <span className="lk-div" aria-hidden="true" />
        <div className="lk-name">
          <span>App</span>
          <span className="lk-name-sub">Platform</span>
        </div>
      </div>

      <div className="tagline">
        <span className="tagline__line tagline__line--primary">Your product name.</span>
        <span className="tagline__line tagline__line--secondary">
          Replace this <span className="tagline__accent">tagline</span>.
        </span>
      </div>
    </div>
  )
}

interface AuthSplitLayoutProps {
  /** Right/bottom panel content (the sign-in card). */
  children: ReactNode
  /** Ms before the brand panel splits and the form appears. */
  revealDelayMs?: number
}

export function AuthSplitLayout({ children, revealDelayMs = REVEAL_DELAY_MS }: AuthSplitLayoutProps) {
  // Read once on mount — mid-session storage changes shouldn't retrigger or
  // cancel a running intro.
  const [instant] = useState(introAlreadySeen)
  const [revealed, setRevealed] = useState(instant)

  useEffect(() => {
    // Mark on mount (not on reveal) so navigating away mid-intro still counts.
    markIntroSeen()
    if (instant) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(
      () => setRevealed(true),
      prefersReduced ? Math.min(REVEAL_DELAY_REDUCED_MS, revealDelayMs) : revealDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [instant, revealDelayMs])

  return (
    <div className={`auth-split${revealed ? ' is-revealed' : ''}${instant ? ' is-instant' : ''}`}>
      <section className="auth-split__brand">
        <div className="auth-split__stage">
          <BrandShowcase />
        </div>
      </section>
      <section className="auth-split__panel">{children}</section>
    </div>
  )
}

interface AuthPageShellProps {
  /** Display-face heading, same treatment as login's "Welcome back". */
  title: ReactNode
  /** Muted one-liner under the title. */
  subtitle?: ReactNode
  children?: ReactNode
}

// Shared shell for the secondary auth pages (forgot/reset password). Reuses
// the login page's split layout and its exact header treatment — eyebrow,
// display-face title, muted subtitle — so every auth surface reads as one
// family, with the intro cut short.
export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <AuthSplitLayout revealDelayMs={SHORT_REVEAL_MS}>
      {/* my-auto keeps the top of a taller-than-viewport form scrollable
        * instead of clipped. */}
      <div className="my-auto w-[min(86%,460px)] py-7">
        <p className="mb-3.5 font-mono text-sm uppercase tracking-[0.24em] text-lime-600">
          App
        </p>
        <h1 className="font-display text-[clamp(28px,2.2vw,54px)] font-normal leading-[1.04] text-[var(--auth-heading)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mb-7 mt-2.5 text-[#6b7280]">{subtitle}</p>
        ) : (
          <div className="mb-7" />
        )}
        {children}
      </div>
    </AuthSplitLayout>
  )
}
