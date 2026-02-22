import type { Metadata } from 'next';
import { Poker } from '@/components/poker/poker';
import { PokerErrorBoundary } from '@/components/poker/poker-error-boundary';

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
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <PokerErrorBoundary>
        <Poker gameId={id} />
      </PokerErrorBoundary>
    </div>
  );
}
