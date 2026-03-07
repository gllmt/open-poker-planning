'use client';
import { Spade } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useI18n } from '@/components/i18n/use-i18n';
import { cn } from '@/lib/utils';
import { withLocale } from '@/lib/i18n/paths';

import { ThemeControl } from './theme-control';

export function Toolbar() {
  const { locale, t } = useI18n();
  const pathname = usePathname();

  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`;
  const isJoin = pathname.startsWith(`/${locale}/join`);

  return (
    <header className="border-border/40 bg-background/70 sticky top-0 z-50 flex w-full items-center justify-between border-b px-4 py-2 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
      <div className="inline-flex items-center">
        <Link href={withLocale('/', locale)} className="flex items-center gap-2 group">
          <Spade className="size-5 text-primary transition-transform duration-200 group-hover:scale-110" />
          <span className="md:text-xl text-sm font-semibold tracking-tight">
            {t('toolbar.brand')}
          </span>
        </Link>
      </div>

      <nav className="inline-flex items-center justify-end gap-1">
        <Link
          href={withLocale('/', locale)}
          className={cn(
            'rounded-full px-3 py-2 text-sm font-medium transition-all duration-150',
            isHome
              ? 'text-foreground bg-muted/80'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {t('toolbar.new')}
        </Link>
        <Link
          href={withLocale('/join', locale)}
          className={cn(
            'rounded-full px-3 py-2 text-sm font-medium transition-all duration-150',
            isJoin
              ? 'text-foreground bg-muted/80'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {t('toolbar.join')}
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
