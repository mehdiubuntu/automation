import { useMemo } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { usePrefersReducedMotion } from '@/lib/motion/useReducedMotion'

/**
 * Three balls orbiting a shared center with depth, each casting a soft shadow
 * that tightens as it rises. Adapted from Zoie Deng's "Loading Animation"
 * (dribbble.com/shots/4375418) — rebuilt from scratch in motion/CSS rather than
 * shipping the 640kB GIF.
 *
 * What sells the effect (and is easy to get wrong):
 * - The orbit is elliptical, not circular: a wide X and a shallow Y radius read
 *   as a ring tilted away from the viewer.
 * - Depth is faked from the orbit phase — a ball at the FRONT of the ring is
 *   scaled up and fully opaque; at the back it shrinks, dims, and drops behind
 *   the others via z-index. That parallax is what makes it feel 3D.
 * - Each ball's shadow is a separate element pinned to the ellipse's floor. It
 *   scales and fades with the ball's height, which is what grounds the motion —
 *   without it the balls look like they're sliding on glass.
 * - All three share ONE period and are offset by phase, so they converge into a
 *   single stack once per cycle (the beat in the original) for free.
 */

const BALLS = [
  { color: '#fbbf5a', shadow: 'rgba(251,191,90,0.45)' }, // amber
  { color: '#fb8a5c', shadow: 'rgba(251,138,92,0.42)' }, // orange
  { color: '#f8536b', shadow: 'rgba(248,83,107,0.40)' }, // red
] as const

export type OrbitLoaderSize = 'sm' | 'md' | 'lg'

const SIZES: Record<OrbitLoaderSize, { box: number; ball: number; rx: number; ry: number }> = {
  sm: { box: 44, ball: 9, rx: 13, ry: 5 },
  md: { box: 84, ball: 16, rx: 24, ry: 9 },
  lg: { box: 132, ball: 25, rx: 38, ry: 14 },
}

/** One full orbit, in seconds. Slow enough to read as motion, not a spinner. */
const PERIOD = 2.2
/** Keyframe resolution — 24 steps is smooth without bloating the style object. */
const STEPS = 24

/**
 * Module scope, not per-render: it depends only on the constants above, and a
 * fresh `times` array each render would defeat the same memoization the
 * keyframe tracks below rely on.
 */
const ORBIT_TRANSITION = {
  duration: PERIOD,
  repeat: Infinity,
  ease: 'linear' as const,
  times: Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS),
}

export function OrbitLoader({
  size = 'md',
  className,
  label,
}: {
  size?: OrbitLoaderSize
  className?: string
  /** Optional caption under the orbit (e.g. "Loading"). Dots are animated. */
  label?: string
}) {
  const { box, ball, rx, ry } = SIZES[size]
  const reduced = usePrefersReducedMotion()

  // Precompute the keyframe arrays once per size. Building them inline would
  // hand motion a new array identity every render and restart the animation.
  const tracks = useMemo(
    () =>
      BALLS.map((_, index) => {
        const phase = (index / BALLS.length) * Math.PI * 2
        const x: number[] = []
        const y: number[] = []
        const scale: number[] = []
        const opacity: number[] = []
        const shadowX: number[] = []
        const shadowScale: number[] = []
        const shadowOpacity: number[] = []

        for (let step = 0; step <= STEPS; step++) {
          const t = (step / STEPS) * Math.PI * 2 + phase
          // sin drives depth: +1 = nearest the viewer, -1 = farthest.
          const depth = Math.sin(t)
          x.push(Math.cos(t) * rx)
          y.push(depth * ry)
          scale.push(1 + depth * 0.32)
          opacity.push(0.72 + (depth + 1) * 0.14)
          // The shadow tracks X but stays on the floor; it shrinks and fades as
          // the ball lifts away from it.
          shadowX.push(Math.cos(t) * rx)
          shadowScale.push(0.85 + depth * 0.3)
          shadowOpacity.push(0.34 - depth * 0.16)
        }
        return { x, y, scale, opacity, shadowX, shadowScale, shadowOpacity }
      }),
    [rx, ry],
  )


  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="relative"
        style={{ width: box, height: box }}
        role="status"
        aria-label={label ?? 'Loading'}
      >
        {/* Shadow layer sits under the balls, on the ellipse's floor. */}
        <div className="absolute inset-0" aria-hidden>
          {BALLS.map((b, i) => (
            <m.span
              key={`shadow-${i}`}
              className="absolute rounded-[50%]"
              style={{
                width: ball * 1.15,
                height: ball * 0.42,
                left: '50%',
                top: '50%',
                marginLeft: -(ball * 1.15) / 2,
                // Sits just under the orbit's lowest point — close enough to
                // read as contact shadow, not a detached blob.
                marginTop: ry + ball * 0.12,
                background: b.shadow,
                filter: `blur(${Math.max(2, ball * 0.28)}px)`,
              }}
              animate={
                reduced
                  ? { opacity: 0.2 }
                  : {
                      x: tracks[i].shadowX,
                      scale: tracks[i].shadowScale,
                      opacity: tracks[i].shadowOpacity,
                    }
              }
              transition={reduced ? { duration: 0 } : ORBIT_TRANSITION}
            />
          ))}
        </div>

        {/* Balls. zIndex is static per ball; the scale/opacity parallax carries
            the depth read, and restacking every frame would thrash the
            compositor for a detail nobody can see at this size. */}
        {BALLS.map((b, i) => (
          <m.span
            key={`ball-${i}`}
            className="absolute rounded-full"
            style={{
              width: ball,
              height: ball,
              left: '50%',
              top: '50%',
              marginLeft: -ball / 2,
              marginTop: -ball / 2,
              background: `radial-gradient(circle at 32% 28%, ${b.color} 0%, ${b.color} 55%, color-mix(in oklab, ${b.color} 78%, black) 100%)`,
              zIndex: i,
            }}
            animate={
              reduced
                ? { opacity: 0.9 }
                : {
                    x: tracks[i].x,
                    y: tracks[i].y,
                    scale: tracks[i].scale,
                    opacity: tracks[i].opacity,
                  }
            }
            transition={reduced ? { duration: 0 } : ORBIT_TRANSITION}
          />
        ))}
      </div>

      {label && (
        // aria-hidden: the role="status" box above already carries this text as
        // its aria-label, so without this AT announces "Loading" twice.
        <p
          aria-hidden
          className="flex items-baseline text-sm font-medium tracking-wide text-gray-500"
        >
          {/* Callers pass either "Loading" or "Loading…"; strip any trailing
              ellipsis so the animated dots don't double up on it. Kept on ONE
              line — a newline between the two expressions makes JSX emit a
              visible space ("Loading ..."). */}
          {label.replace(/[.…]+$/, '')}<LoadingDots reduced={reduced} />
        </p>
      )}
    </div>
  )
}

/** Three dots that fill in one at a time, matching the original's caption. */
function LoadingDots({ reduced }: { reduced: boolean }) {
  if (reduced) return <span aria-hidden>…</span>
  return (
    <span className="inline-flex" aria-hidden>
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.18 + i * 0.16, 0.34 + i * 0.16, 1],
          }}
        >
          .
        </m.span>
      ))}
    </span>
  )
}
