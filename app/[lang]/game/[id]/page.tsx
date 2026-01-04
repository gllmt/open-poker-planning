import type { Metadata } from 'next';

import { Poker } from '@/components/poker/poker';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-2">
      <Poker gameId={id} />
    </div>
  );
}
