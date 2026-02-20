'use client';

import { Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/components/i18n/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';

export function RecentGames() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const recentGames = getPlayerGamesFromCache();

  if (!recentGames.length) {
    return (
      <Card className="w-full">
        <CardContent>
          <EmptyState
            icon={<Clock className="size-6 text-muted-foreground" />}
            title={t('recentGames.title')}
            description={t('recentGames.empty')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="truncate">{t('recentGames.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" style={{ maxHeight: 250 }}>
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider">
                  {t('recentGames.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider">
                  {t('recentGames.createdBy')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((g) => (
                <tr
                  key={g.id}
                  className="hover:bg-muted/60 border-border cursor-pointer border-t transition"
                  onClick={() =>
                    router.push(withLocale(`/game/${g.id}`, locale))
                  }
                >
                  <td className="px-6 py-4 text-sm">{g.name}</td>
                  <td className="px-6 py-4 text-sm">{g.createdBy || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
