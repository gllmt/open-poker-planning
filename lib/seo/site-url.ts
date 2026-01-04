import 'server-only';

function normalizeUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `https://${value}`;
}

export function getSiteUrl(): URL {
  const raw = process.env.SITE_URL || process.env.VERCEL_URL;
  if (!raw) {
    return new URL('http://localhost:3000');
  }
  return new URL(normalizeUrl(raw));
}
