'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import {
  getStoredTheme,
  getTheme,
  setTheme as persistTheme,
} from '@/lib/browser-storage';
import type { Theme } from '@/lib/theme/constants';

export function ThemeControl() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [hasStoredTheme, setHasStoredTheme] = useState(
    () => getStoredTheme() !== null
  );

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    if (hasStoredTheme) {
      persistTheme(theme);
    }
  }, [theme, hasStoredTheme]);

  useEffect(() => {
    if (hasStoredTheme) return;
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [hasStoredTheme]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        setHasStoredTheme(true);
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
      }}
      aria-label={t('theme.toggle')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        className="size-4.5 transition-transform duration-300 hover:rotate-45"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke="none" d="M0 0h24v24H0z" />
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 3v18M12 9l4.65-4.65M12 14.3l7.37-7.37M12 19.6l8.85-8.85" />
      </svg>
    </Button>
  );
}
