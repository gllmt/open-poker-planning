import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import { Toolbar } from '@/components/toolbar/toolbar';
import { i18n, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getSiteUrl } from '@/lib/seo/site-url';

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
  const siteUrl = getSiteUrl();
  const canonicalPath = `/${locale}`;
  const canonicalUrl = new URL(canonicalPath, siteUrl).toString();
  const languages = Object.fromEntries(
    i18n.locales.map((entry) => [entry, `/${entry}`] as const)
  ) as Record<string, string>;
  const ogLocale = locale === 'fr' ? 'fr_FR' : 'en_US';
  const title = dictionary.meta.title;
  const description = dictionary.meta.description;
  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...languages,
        'x-default': `/${i18n.defaultLocale}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: canonicalUrl,
      siteName: dictionary.meta.siteName,
      title,
      description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: dictionary.meta.ogAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
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
