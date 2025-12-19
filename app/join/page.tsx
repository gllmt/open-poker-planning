import { Suspense } from 'react';

import { JoinGame } from '@/components/poker/join-game';
import { Loading } from '@/components/ui/loading';

export default function JoinPage() {
  return (
    <div className="flex flex-col items-center w-full py-8 flex-1 px-4">
      <div className="w-full max-w-5xl flex justify-center">
        <div className="w-full max-w-xl animate-fade-in-down">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-6">
                <Loading />
                <span className="sr-only">Loading</span>
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
