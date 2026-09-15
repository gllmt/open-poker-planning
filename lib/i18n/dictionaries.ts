import 'server-only';
import { cache } from 'react';
import type { Locale } from './config';
import type { Dictionary } from './types';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
} as const;

export const getDictionary = cache((locale: Locale): Promise<Dictionary> => {
  return dictionaries[locale]();
});
