import { Suspense } from 'react';

import { JoinGame } from '@/components/poker/join-game';

export default function JoinPage() {
  return (
    <div className="flex flex-col items-center w-full py-8 flex-1 px-4">
      <div className="w-full max-w-5xl flex justify-center">
        <div className="w-full max-w-xl animate-fade-in-down">
          <Suspense
            fallback={
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Loading…
              </div>
            }
          >
            <JoinGame />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
