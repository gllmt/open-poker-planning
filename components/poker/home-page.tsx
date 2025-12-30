'use client';

import dynamic from 'next/dynamic';
import { CreateGame } from './create-game';

const RecentGames = dynamic(
  () => import('./recent-games').then((m) => m.RecentGames),
  { ssr: false }
);

export function HomePage() {
  return (
    <div className="flex flex-col md:flex-row items-center w-full justify-center animate-fade-in-down px-4 gap-10">
      <div className="w-full md:w-1/2 max-w-xl flex flex-col gap-6 pt-8">
        <div className="w-full">
          <CreateGame />
        </div>
      </div>

      <div className="w-full md:w-1/2 max-w-xl">
        <RecentGames />
      </div>
    </div>
  );
}
