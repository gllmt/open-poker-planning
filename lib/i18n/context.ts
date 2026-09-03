'use client';

import { createContext } from 'react';

import type { Locale } from './config';
import type { Dictionary } from './types';

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
