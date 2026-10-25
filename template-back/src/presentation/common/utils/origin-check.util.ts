const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface OriginCheckInput {
  method: string
  origin?: string
  referer?: string
  hasCookies: boolean
  allowedOrigins: readonly string[]
}

function originOf(referer: string): string | null {
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

/**
 * CSRF defence for cookie-authenticated APIs: a state-changing request must come from an allowed origin.
 * The Origin header wins, then Referer. With neither, only cookie-less callers (curl, server-to-server) pass:
 * a browser always sends one of them on a cross-site POST, so a cookie-bearing request without both is refused.
 */
export function isOriginAllowed(input: OriginCheckInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true
  if (input.origin !== undefined) return input.allowedOrigins.includes(input.origin)
  if (input.referer !== undefined) {
    const origin = originOf(input.referer)
    return origin !== null && input.allowedOrigins.includes(origin)
  }
  return !input.hasCookies
}
