import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';
import { StructuredData } from '@/components/seo/structured-data';
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
  const features = dictionary.home.features;
  return (
    <div className="flex flex-col items-center gap-10 px-4 pb-12">
      <section className="w-full max-w-5xl pt-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {dictionary.home.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
          {dictionary.home.title}
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          {dictionary.home.description}
        </p>
        <div className="mt-6">
          <p className="text-sm font-medium">{dictionary.home.featureTitle}</p>
          <ul className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature}
                className="rounded-md border border-border/50 bg-card/40 p-3 text-left"
              >
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

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
      <StructuredData
        locale={locale}
        name={dictionary.meta.siteName}
        description={dictionary.meta.description}
      />
    </div>
  );
}
