/**
 * Pads a response to at least `minMs` so "this email exists" and "it does not" take the same
 * time (the existing path does DB writes the other path skips).
 */
export async function holdMinimumDuration(startedAtMs: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAtMs)
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining))
  }
}
