'use client';

import { useEffect, useState } from 'react';

import { getTheme, setTheme as persistTheme } from '@/lib/browser-storage';

export function ThemeControl() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    persistTheme(theme);
  }, [theme]);

  return (
    <button
      type='button'
      className='button-ghost'
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label='Toggle theme'
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
