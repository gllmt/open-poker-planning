import { Home, Search } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { i18n, isLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function NotFound() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : i18n.defaultLocale;
  const dictionary = await getDictionary(locale);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-12 px-4 pb-16">
      {/* Hero glow backdrop */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/8 blur-[120px] dark:bg-primary/5" />

      <section className="relative w-full max-w-lg text-center">
        {/* 404 big number */}
        <p className="animate-fade-in-down text-[8rem] md:text-[10rem] font-bold leading-none tracking-tighter text-primary/15 select-none">
          404
        </p>

        {/* Icon */}
        <div className="animate-scale-in stagger-1 mx-auto -mt-8 mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Search className="size-7" />
        </div>

        <p className="animate-fade-in stagger-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
          {dictionary.notFound.eyebrow}
        </p>

        <h1 className="animate-fade-in-down stagger-2 mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          {dictionary.notFound.title}
        </h1>

        <p className="animate-fade-in-up stagger-3 mt-4 text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
          {dictionary.notFound.description}
        </p>

        <div className="animate-fade-in-up stagger-4 mt-8">
          <Link href={`/${locale}`}>
            <Button size="lg">
              <Home data-icon="inline-start" className="size-4" />
              {dictionary.notFound.backHome}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
