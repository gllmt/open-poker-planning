'use client';

import 'sileo/styles.css';

import { useEffect, useState } from 'react';
import { Toaster } from 'sileo';

export function SileoToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setTheme(root.classList.contains('dark') ? 'light' : 'dark');
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      position="top-center"
      offset={{ top: 0 }}
      theme={theme}
      options={{
        duration: 4000,
        roundness: 18,
      }}
    />
  );
}
