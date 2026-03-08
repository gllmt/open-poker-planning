'use client';

import dynamic from 'next/dynamic';
import { CreateGame } from './create-game';
import { RecentGamesSkeleton } from './recent-games-skeleton';

const RecentGames = dynamic(
  () => import('./recent-games').then((m) => m.RecentGames),
  { ssr: false, loading: () => <RecentGamesSkeleton /> }
);

export function HomePage() {
  return (
    <div className="flex flex-col md:flex-row items-start w-full justify-center px-4 gap-8 md:gap-10">
      <div className="animate-scale-in stagger-4 w-full md:w-1/2 max-w-xl flex flex-col gap-6">
        <CreateGame />
      </div>

      <div className="animate-scale-in stagger-5 w-full md:w-1/2 max-w-xl">
        <RecentGames />
      </div>
    </div>
  );
}
