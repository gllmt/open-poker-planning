'use client';

import { type ReactNode, useMemo } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { I18nContext } from '@/lib/i18n/context';
import type { Dictionary } from '@/lib/i18n/types';

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, dictionary }), [locale, dictionary]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
