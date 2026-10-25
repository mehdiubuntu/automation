/** Request-side facts a use-case needs to describe "where this happened" — captured by the controller, never read ambiently. */
export interface DeviceContext {
  ip?: string
  userAgent?: string
}

export interface DeviceInfo {
  browser?: string
  os?: string
  /** Human label shown in session lists, e.g. "Chrome on Windows". */
  deviceName?: string
}

const BROWSERS: Array<{ name: string; pattern: RegExp }> = [
  // Order matters: Edge/Opera UAs also contain "Chrome"; Chrome/Safari UAs contain "Safari".
  { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\//i },
  { name: 'Opera', pattern: /(?:OPR|Opera)\//i },
  { name: 'Samsung Internet', pattern: /SamsungBrowser\//i },
  { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\//i },
  { name: 'Chrome', pattern: /(?:Chrome|CriOS)\//i },
  { name: 'Safari', pattern: /Safari\//i },
]

const OSES: Array<{ name: string; pattern: RegExp }> = [
  // Order matters: Android UAs contain "Linux"; iOS UAs contain "Mac OS X".
  { name: 'Android', pattern: /Android/i },
  { name: 'iOS', pattern: /(?:iPhone|iPad|iPod)/i },
  { name: 'Windows', pattern: /Windows/i },
  { name: 'macOS', pattern: /Mac OS X|Macintosh/i },
  { name: 'Chrome OS', pattern: /CrOS/i },
  { name: 'Linux', pattern: /Linux/i },
]

/** Best-effort user-agent classification — display metadata only, never a security decision. */
export function parseDevice(userAgent?: string): DeviceInfo {
  if (!userAgent) return {}
  const browser = BROWSERS.find((candidate) => candidate.pattern.test(userAgent))?.name
  const os = OSES.find((candidate) => candidate.pattern.test(userAgent))?.name
  const deviceName = browser && os ? `${browser} on ${os}` : (browser ?? os ?? 'Unknown device')
  return { browser, os, deviceName }
}
