import { CheckCircle2 } from 'lucide-react';
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-14 pt-8">
      <section className="mx-auto w-full max-w-4xl space-y-5 text-center">
        {/* <p className="text-primary text-xs font-semibold uppercase tracking-[0.24em]">
          {dictionary.home.eyebrow}
        </p> */}
        <h1 className="text-4xl font-semibold text-balance md:text-5xl">
          {dictionary.home.title}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
          {dictionary.home.description}
        </p>
        <div className="pt-2">
          {/* <p className="text-sm font-medium tracking-wide">
            {dictionary.home.featureTitle}
          </p> */}
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {features.slice(0, 4).map((feature) => (
              <li
                key={feature}
                className="bg-primary/10 text-primary ring-primary/15 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <span className="truncate">{feature}</span>
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
      <footer className="w-full pt-8 text-center text-xs text-muted-foreground">
        <a
          href="https://github.com/gllmt"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary inline-flex items-center justify-center rounded-full px-2 py-1 underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          GitHub
        </a>
      </footer>
      <StructuredData
        locale={locale}
        name={dictionary.meta.siteName}
        description={dictionary.meta.description}
      />
    </div>
  );
}
