/** Deterministic UUID-shaped ids for in-memory fakes and specs: fakeId(1) -> 00000000-0000-7000-8000-000000000001. */
export const fakeId = (n: number): string => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`
