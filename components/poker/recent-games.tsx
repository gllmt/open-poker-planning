'use client';

import { ChevronRight, Clock3 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/components/i18n/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';

export function RecentGames() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const recentGames = getPlayerGamesFromCache();

  if (!recentGames.length) {
    return (
      <Card className="h-full border border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock3 className="text-primary size-5" aria-hidden="true" />
            {t('recentGames.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-muted-foreground rounded-2xl border-2 border-dashed border-border/80 px-4 py-10 text-center text-sm">
            {t('recentGames.empty')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock3 className="text-primary size-5" aria-hidden="true" />
          <span className="truncate">{t('recentGames.title')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <ul className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
          {recentGames.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(withLocale(`/game/${game.id}`, locale))
                }
                className="focus-visible:ring-primary/45 group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/65 px-4 py-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                    {game.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {t('recentGames.createdBy')}: {game.createdBy || '-'}
                  </p>
                </div>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
