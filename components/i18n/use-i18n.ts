'use client';

import { useCallback, useContext } from 'react';
import { I18nContext } from '@/lib/i18n/context';
import type {
  DictionaryKey,
  InterpolationValues,
  Translate,
} from '@/lib/i18n/types';

type DictionaryRecord = Record<string, unknown>;
type DictionaryValue = string | DictionaryRecord;

function resolveKey(
  value: DictionaryValue | undefined,
  key: DictionaryKey
): string {
  if (!value || typeof value !== 'object') return key;
  const parts = key.split('.');
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return key;
    current = (current as DictionaryRecord)[part];
  }
  return typeof current === 'string' ? current : key;
}

function interpolate(template: string, values?: InterpolationValues) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  const { locale, dictionary } = context;

  const t = useCallback<Translate>(
    (key, values) => {
      const resolved = resolveKey(dictionary as DictionaryValue, key);
      return interpolate(resolved, values);
    },
    [dictionary]
  );

  return { locale, t };
}
