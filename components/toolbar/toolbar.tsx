'use client';
import Link from 'next/link';

import { useI18n } from '@/components/i18n/use-i18n';
import { withLocale } from '@/lib/i18n/paths';

import { ThemeControl } from './theme-control';

export function Toolbar() {
  const { locale, t } = useI18n();

  return (
    <header className="border-border/50 bg-background/80 sticky top-0 z-50 flex h-[48px] w-full items-center justify-between border-b px-4 py-2.5 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
      <div className="inline-flex items-center">
        <Link href={withLocale('/', locale)} className="flex items-center">
          <span className="text-base font-semibold tracking-tight">
            {t('toolbar.brand')}
          </span>
        </Link>
      </div>

      <nav className="inline-flex items-center justify-end gap-1">
        <Link
          href={withLocale('/', locale)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg px-3 py-2 text-sm font-medium transition"
        >
          {t('toolbar.new')}
        </Link>
        <Link
          href={withLocale('/join', locale)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg px-3 py-2 text-sm font-medium transition"
        >
          {t('toolbar.join')}
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
