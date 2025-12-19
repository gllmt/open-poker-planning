import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';
import { Loading } from '@/components/ui/loading';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-6">
          <Loading />
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
