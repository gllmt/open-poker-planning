'use client';

import { Moon, Sun } from 'lucide-react';
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
      className="rounded-full border border-border/70 px-2.5 hover:border-primary/40 hover:bg-primary/10"
    >
      {theme === 'dark' ? (
        <Sun className="size-4.5" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5" aria-hidden="true" />
      )}
    </Button>
  );
}
