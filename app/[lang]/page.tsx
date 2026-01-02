import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';
import { Loading } from '@/components/ui/loading';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-6">
          <Loading />
          <span className="sr-only">{dictionary.common.loading}</span>
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
