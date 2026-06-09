/**
 * Returns `raw` only if it is a safe same-origin relative path, otherwise
 * `fallback`. Guards against open redirects: rejects absolute URLs, the
 * protocol-relative `//host` form, and the `/\host` / backslash variants that
 * browsers normalize to `//host`.
 */
export function sanitizeInternalPath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (raw[0] !== '/') return fallback;
  // "//host" and "/\host" both resolve to an external origin once normalized.
  if (raw[1] === '/' || raw[1] === '\\') return fallback;
  if (raw.includes('\\')) return fallback;
  // Reject control characters (newlines, NUL, etc.) used to smuggle payloads.
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) < 0x20) return fallback;
  }
  return raw;
}
