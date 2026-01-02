export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export function isLocale(locale: string | undefined): locale is Locale {
  return i18n.locales.includes(locale as Locale);
}
