'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import {
  getStoredTheme,
  getTheme,
  setTheme as persistTheme,
} from '@/lib/browser-storage';

export function ThemeControl() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getTheme());
  const [hasStoredTheme, setHasStoredTheme] = useState(
    () => getStoredTheme() !== null
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
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
      {theme === 'dark' ? t('theme.light') : t('theme.dark')}
    </Button>
  );
}
