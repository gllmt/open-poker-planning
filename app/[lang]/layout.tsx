import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import { Toolbar } from '@/components/toolbar/toolbar';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }));
}

const resolveLocale = (lang: string) =>
  isLocale(lang) ? lang : i18n.defaultLocale;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dictionary = await getDictionary(locale);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <div className="bg-background text-foreground min-h-screen">
        <Toolbar />
        {children}
      </div>
    </I18nProvider>
  );
}
