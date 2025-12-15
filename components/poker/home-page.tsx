'use client';

import dynamic from 'next/dynamic';
import { CreateGame } from './create-game';
import { JoinGame } from './join-game';

const RecentGames = dynamic(
  () => import('./recent-games').then((m) => m.RecentGames),
  { ssr: false }
);

export function HomePage() {
  return (
    <div className="flex flex-col items-center w-full animate-fade-in-down px-4">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 pt-8">
        <div className="w-full lg:w-1/2">
          <CreateGame />
        </div>
        <div className="w-full lg:w-1/2">
          <JoinGame />
        </div>
      </div>

      <div className="w-full max-w-5xl mt-10">
        <RecentGames />
      </div>
    </div>
  );
}
