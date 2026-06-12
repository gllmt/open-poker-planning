import { fetchQuery } from 'convex/nextjs';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { Poker } from '@/components/poker/poker';
import { PokerErrorBoundary } from '@/components/poker/poker-error-boundary';
import { api } from '@/convex/_generated/api';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

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
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(id))?.value;

  if (!playerToken) {
    redirect(`/${lang}/join/${id}`);
  }

  const playerTokenHash = hashToken(playerToken);
  const adminToken = cookieStore.get(cookieNames.adminToken(id))?.value;
  const adminTokenHash = adminToken ? hashToken(adminToken) : undefined;
  const viewerState = await fetchQuery(api.games.getViewerGameState, {
    gameId: id,
    playerTokenHash,
  });

  if (viewerState.type === 'not_found') {
    notFound();
  }

  if (viewerState.type === 'revoked') {
    redirect(`/${lang}/join/${id}?reason=${viewerState.reason}`);
  }

  return (
    <div className="relative px-4 md:px-6">
      {/* Ambient glow — mirrors home page radial backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 flex items-start justify-center overflow-hidden"
      >
        <div className="h-[420px] w-[600px] translate-y-[-10%] rounded-full bg-primary/8 blur-[120px]" />
      </div>
      <PokerErrorBoundary
        genericErrorMessage={dictionary.errorBoundary.genericError}
        retryLabel={dictionary.errorBoundary.retry}
        sessionErrorMessage={dictionary.errorBoundary.sessionError}
      >
        <Poker
          gameId={id}
          initialSession={{
            adminTokenHash,
            playerId: viewerState.currentPlayerId,
            playerTokenHash,
          }}
        />
      </PokerErrorBoundary>
    </div>
  );
}
