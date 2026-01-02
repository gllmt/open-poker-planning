import type { Locale } from './config';

export function withLocale(path: string, locale: Locale) {
  if (!path.startsWith('/')) {
    return `/${locale}`;
  }
  if (path === `/${locale}` || path.startsWith(`/${locale}/`)) {
    return path;
  }
  if (path === '/') {
    return `/${locale}`;
  }
  return `/${locale}${path}`;
}
