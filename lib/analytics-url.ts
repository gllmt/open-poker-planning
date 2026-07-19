const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

// PostHog derives implicit current, initial, and session-entry URL properties
// from window.location. Mask the invite bearer token at that source so none of
// those derived properties can contain the plaintext token.
export const POSTHOG_URL_PRIVACY_OPTIONS = {
  custom_personal_data_properties: ['token'],
  disable_capture_url_hashes: true,
  mask_personal_data_properties: true,
};

export function getAnalyticsPageviewUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}
