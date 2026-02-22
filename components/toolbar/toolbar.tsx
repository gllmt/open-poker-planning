'use client';
import { LogIn, Plus } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from '@/components/i18n/use-i18n';
import { withLocale } from '@/lib/i18n/paths';

import { ThemeControl } from './theme-control';

export function Toolbar() {
  const { locale, t } = useI18n();

  return (
    <header className="border-border/70 bg-background/85 sticky top-0 z-50 border-b px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <Link
          href={withLocale('/', locale)}
          className="focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground inline-flex size-8 items-center justify-center rounded-lg text-sm font-bold">
            P
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">
            {t('toolbar.brand')}
          </span>
        </Link>

        <nav className="inline-flex items-center gap-2">
          <Link
            href={withLocale('/', locale)}
            className="focus-visible:ring-ring/50 text-foreground/80 hover:text-foreground hover:bg-muted/70 inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('toolbar.new')}</span>
          </Link>
          <Link
            href={withLocale('/join', locale)}
            className="focus-visible:ring-ring/50 text-foreground/80 hover:text-foreground hover:bg-muted/70 inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogIn className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('toolbar.join')}</span>
          </Link>
          <span className="bg-border/80 h-6 w-px" aria-hidden="true" />
          <ThemeControl />
        </nav>
      </div>
    </header>
  );
}
