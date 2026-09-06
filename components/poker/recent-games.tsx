'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';

export function RecentGames() {
  const { locale, t } = useI18n();
  const recentGames = getPlayerGamesFromCache();

  if (!recentGames.length) {
    return (
      <Card className="w-full glass-card dark:dark-glass-card">
        <CardHeader className="text-center">
          <CardTitle>{t('recentGames.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center">
            {t('recentGames.empty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full glass-card dark:dark-glass-card">
      <CardHeader className="text-center">
        <CardTitle className="truncate">{t('recentGames.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg" style={{ maxHeight: 250 }}>
          <table className="divide-border/50 min-w-full divide-y">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-bold tracking-wider text-muted-foreground">
                  {t('recentGames.name')}
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-bold tracking-wider text-muted-foreground">
                  {t('recentGames.createdBy')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recentGames.map((g) => (
                <tr
                  key={g.id}
                  className="group transition-colors duration-150 hover:bg-primary/5 dark:hover:bg-primary/10"
                >
                  <td className="px-5 py-3.5 text-sm font-medium group-hover:text-primary transition-colors duration-150">
                    <Link
                      href={withLocale(`/game/${g.id}`, locale)}
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {g.createdBy || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
