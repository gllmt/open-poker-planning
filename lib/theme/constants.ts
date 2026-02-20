export type Theme = 'light' | 'dark';

export const THEME_COOKIE_NAME = 'pp_theme';
export const THEME_STORAGE_KEY = 'theme';
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isTheme(value: string | undefined | null): value is Theme {
  return value === 'light' || value === 'dark';
}
