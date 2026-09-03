import type en from './dictionaries/en.json';

export type Dictionary = typeof en;

type DictionaryPath<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends readonly unknown[]
      ? never
      : T[Key] extends Record<string, unknown>
        ? `${Key}.${DictionaryPath<T[Key]>}`
        : never;
}[keyof T & string];

export type DictionaryKey = DictionaryPath<Dictionary>;
export type InterpolationValues = Record<string, string | number>;
export type Translate = (
  key: DictionaryKey,
  values?: InterpolationValues
) => string;
