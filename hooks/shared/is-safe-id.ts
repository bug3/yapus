// An id is letters, digits and hyphens, 1 to 128 long, so it is safe as a
// file name: no path separator and no dot.
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,128}$/.test(value);
}
