import 'server-only';

import type { Locale } from './config';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
} as const;

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['en']>>;

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
