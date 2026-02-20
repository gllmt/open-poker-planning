import type { Metadata } from 'next';
import { Suspense } from 'react';

import { JoinGame } from '@/components/poker/join-game';
import { Loading } from '@/components/ui/loading';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

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
    token?: string | string[];
  }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
  const resolvedSearchParams = await searchParams;
  const initialInviteToken = readSearchParam(resolvedSearchParams?.token) ?? '';
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
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
