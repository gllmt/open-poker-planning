import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground p-6 text-sm">Loading…</div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
