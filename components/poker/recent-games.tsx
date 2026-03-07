'use client';

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
                  className="group cursor-pointer transition-all duration-150 hover:bg-primary/5 dark:hover:bg-primary/10"
                  onClick={() =>
                    router.push(withLocale(`/game/${g.id}`, locale))
                  }
                >
                  <td className="px-5 py-3.5 text-sm font-medium group-hover:text-primary transition-colors duration-150">
                    {g.name}
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
