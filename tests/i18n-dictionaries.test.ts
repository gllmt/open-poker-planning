import { describe, expect, it } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';
import fr from '@/lib/i18n/dictionaries/fr.json';

type DictionaryValue = string | DictionaryObject | DictionaryValue[];
type DictionaryObject = { [key: string]: DictionaryValue };

function flattenDictionary(
  value: DictionaryValue | DictionaryValue[],
  path: string[] = []
): Record<string, string> {
  if (typeof value === 'string') {
    return { [path.join('.')]: value };
  }

  const flattened: Record<string, string> = {};

  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      Object.assign(
        flattened,
        flattenDictionary(child, [...path, String(index)])
      );
    }
    return flattened;
  }

  for (const [key, child] of Object.entries(value)) {
    Object.assign(flattened, flattenDictionary(child, [...path, key]));
  }

  return flattened;
}

const placeholderPattern = /\{[^{}]+\}/g;

function placeholders(value: string) {
  return [...new Set(value.match(placeholderPattern) ?? [])].sort();
}

describe('i18n dictionaries', () => {
  const enFlat = flattenDictionary(en);
  const frFlat = flattenDictionary(fr);

  it('keeps English and French key sets in sync', () => {
    const enKeys = Object.keys(enFlat).sort();
    const frKeys = Object.keys(frFlat).sort();

    expect({
      missingInEnglish: frKeys.filter((key) => !(key in enFlat)),
      missingInFrench: enKeys.filter((key) => !(key in frFlat)),
    }).toEqual({ missingInEnglish: [], missingInFrench: [] });
    expect(enKeys).toEqual(frKeys);
  });

  it('has no empty string values', () => {
    const emptyKeys = [
      ...Object.entries(enFlat).map(([key, value]) => [`en.${key}`, value]),
      ...Object.entries(frFlat).map(([key, value]) => [`fr.${key}`, value]),
    ]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(emptyKeys).toEqual([]);
  });

  it('keeps placeholders consistent between languages', () => {
    const mismatches = Object.keys(enFlat)
      .filter((key) => {
        return (
          JSON.stringify(placeholders(enFlat[key] ?? '')) !==
          JSON.stringify(placeholders(frFlat[key] ?? ''))
        );
      })
      .map((key) => ({
        key,
        en: placeholders(enFlat[key] ?? ''),
        fr: placeholders(frFlat[key] ?? ''),
      }));

    expect(mismatches).toEqual([]);
  });
});
