import { Clock, Layers, Link2, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { HomePage } from '@/components/poker/home-page';
import { StructuredData } from '@/components/seo/structured-data';
import { Loading } from '@/components/ui/loading';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

const FEATURE_ICONS = [Clock, Layers, Link2, ShieldCheck];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);

  return {
    title: dictionary.home.title,
    description: dictionary.home.description,
  };
}

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
    <div className="flex flex-col items-center gap-12 px-4 pb-16">
      {/* Hero glow backdrop */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/8 blur-[120px] dark:bg-primary/5" />

      <section className="relative w-full max-w-5xl pt-16 md:pt-24 text-center">
        <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
          {dictionary.home.eyebrow}
        </p>
        <h1 className="animate-fade-in-down mt-5 text-4xl font-bold tracking-tight md:text-5xl lg:text-[3.5rem] lg:leading-tight">
          {dictionary.home.title}
        </h1>
        <p className="animate-fade-in-up stagger-2 mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {dictionary.home.description}
        </p>

        <div className="mt-10">
          <p className="animate-fade-in stagger-3 text-sm font-semibold tracking-wide">
            {dictionary.home.featureTitle}
          </p>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index] ?? Clock;
              return (
                <li
                  key={feature}
                  className={`animate-fade-in-up stagger-${index + 1} group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 dark:bg-card/30 p-4 text-left backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary/15">
                    <Icon className="size-4.5" />
                  </div>
                  <span className="text-foreground/80 group-hover:text-foreground transition-colors duration-200">
                    {feature}
                  </span>
                </li>
              );
            })}
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

      <footer className="animate-fade-in w-full max-w-5xl pt-12 text-center">
        <div className="border-t border-border/40 pt-6 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground/60">
            Planning Poker — Open Source
          </p>
          <a
            href="https://github.com/gllmt"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary transition-colors duration-200"
          >
            GitHub
          </a>
        </div>
      </footer>

      <StructuredData
        locale={locale}
        name={dictionary.meta.siteName}
        description={dictionary.meta.description}
      />
    </div>
  );
}
