'use client';

import type { ReactNode } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { I18nContext } from '@/lib/i18n/context';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}
