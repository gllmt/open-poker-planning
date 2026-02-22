'use client';

import dynamic from 'next/dynamic';
import { CreateGame } from './create-game';

const RecentGames = dynamic(
  () => import('./recent-games').then((m) => m.RecentGames),
  { ssr: false }
);

export function HomePage() {
  return (
    <div className="animate-fade-in-down grid w-full items-start gap-6 lg:grid-cols-3">
      <div className="w-full lg:col-span-2">
        <div className="w-full">
          <CreateGame />
        </div>
      </div>

      <div className="w-full">
        <RecentGames />
      </div>
    </div>
  );
}
