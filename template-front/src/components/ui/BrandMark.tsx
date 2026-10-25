// Placeholder brand mark (orbit ring + figure + accent bar). Swap the SVG for your
// own logo. It renders on three surfaces: the login brand stage (where the `bm-*`
// classes are animated by auth.css into a draw-in choreography), the sidebar
// lockup, and the collapsed-rail icon. Outside the auth stage no animation CSS
// applies, so it renders as the finished static mark.
// Accent colour (lime).
const ACCENT = '#b5e51f'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      {/* orbit ring */}
      <circle
        className="bm-ring"
        pathLength={1}
        cx="100"
        cy="100"
        r="62"
        stroke="#fff"
        strokeWidth="5"
      />

      {/* satellite nodes sitting on the orbit */}
      <g className="bm-side" stroke="rgba(255,255,255,.35)" strokeWidth="2.5">
        <circle cx="100" cy="38" r="10" />
        <circle cx="46.3" cy="131" r="10" />
        <circle cx="153.7" cy="131" r="10" />
      </g>

      {/* spokes: centre ↔ nodes */}
      <g
        className="bm-side"
        stroke="rgba(255,255,255,.3)"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M100,66 L100,50" />
        <path d="M74,115 L58,124" />
        <path d="M126,115 L142,124" />
      </g>

      <circle className="bm-dot" cx="100" cy="38" r="3.5" fill={ACCENT} />
      <circle className="bm-dot" cx="46.3" cy="131" r="3.5" fill={ACCENT} />
      <circle className="bm-dot" cx="153.7" cy="131" r="3.5" fill={ACCENT} />

      {/* the figure at the centre */}
      <circle
        className="bm-head"
        pathLength={1}
        cx="100"
        cy="86"
        r="14"
        stroke="#fff"
        strokeWidth="3.5"
      />
      <path
        className="bm-body"
        pathLength={1}
        d="M81,124 C81,107 88,101 100,101 C112,101 119,107 119,124"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="bm-ld" cx="100" cy="112" r="4.5" fill={ACCENT} />

      {/* the accent bar */}
      <rect className="bm-bar" x="78" y="138" width="44" height="8" rx="4" fill={ACCENT} />
    </svg>
  )
}
