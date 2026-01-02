import { Suspense } from 'react';

import { JoinGame } from '@/components/poker/join-game';
import { Loading } from '@/components/ui/loading';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function JoinGamePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
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
            <JoinGame initialGameId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
