import { fetchQuery } from 'convex/nextjs';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { JoinGame } from '@/components/poker/join-game';
import { Loading } from '@/components/ui/loading';
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

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JoinGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{
    reason?: string | string[];
    token?: string | string[];
  }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
  const resolvedSearchParams = await searchParams;
  const initialInviteToken = readSearchParam(resolvedSearchParams?.token) ?? '';
  let initialReason = readSearchParam(resolvedSearchParams?.reason) as
    | 'left'
    | 'missing-session'
    | 'removed'
    | undefined;

  if (!initialReason) {
    const cookieStore = await cookies();
    const playerToken = cookieStore.get(cookieNames.playerToken(id))?.value;

    if (playerToken) {
      const viewerState = await fetchQuery(api.games.getViewerGameState, {
        gameId: id,
        playerTokenHash: hashToken(playerToken),
      });

      if (viewerState.type === 'ready') {
        redirect(`/${locale}/game/${id}`);
      }

      if (viewerState.type === 'revoked') {
        initialReason = viewerState.reason;
      }
    }
  }

  return (
    <div className="flex flex-col items-center w-full py-8 flex-1 px-4">
      <div className="w-full max-w-5xl flex justify-center">
        <div className="w-full max-w-xl animate-fade-in-down">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-6">
                <Loading />
                <span className="sr-only">{dictionary.common.loading}</span>
              </div>
            }
          >
            <JoinGame
              initialGameId={id}
              initialInviteToken={initialInviteToken}
              initialReason={initialReason}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
