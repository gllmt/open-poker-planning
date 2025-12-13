import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';

export default function Home() {
  return (
    <Suspense fallback={<div className='p-6 text-sm text-gray-600 dark:text-gray-300'>Loading…</div>}>
      <HomePage />
    </Suspense>
  );
}
