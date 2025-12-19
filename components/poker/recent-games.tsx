'use client';

import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';

export function RecentGames() {
  const router = useRouter();
  const recentGames = getPlayerGamesFromCache();

  if (!recentGames.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No recent sessions found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="truncate">Recent sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" style={{ maxHeight: 250 }}>
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider">
                  Created By
                </th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((g) => (
                <tr
                  key={g.id}
                  className="hover:bg-muted/60 border-border cursor-pointer border-t transition"
                  onClick={() => router.push(`/game/${g.id}`)}
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
