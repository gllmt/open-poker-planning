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
    <div className="relative px-4 md:px-6">
      {/* Ambient glow — mirrors home page radial backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 flex items-start justify-center overflow-hidden"
      >
        <div className="h-[420px] w-[600px] translate-y-[-10%] rounded-full bg-primary/8 blur-[120px]" />
      </div>
      <PokerErrorBoundary>
        <Poker gameId={id} />
      </PokerErrorBoundary>
    </div>
  );
}
