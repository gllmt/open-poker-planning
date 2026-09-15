import 'server-only';
import type { MetadataRoute } from 'next';
import { i18n } from '@/lib/i18n/config';
import { getSiteUrl } from '@/lib/seo/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.SITE_ACCESS_CODE) {
    return [];
  }

  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  const languages = Object.fromEntries(
    i18n.locales.map((locale) => [
      locale,
      new URL(`/${locale}`, siteUrl).toString(),
    ])
  ) as Record<string, string>;

  return i18n.locales.map((locale) => ({
    url: new URL(`/${locale}`, siteUrl).toString(),
    lastModified,
    changeFrequency: 'weekly',
    priority: locale === i18n.defaultLocale ? 1 : 0.9,
    alternates: {
      languages,
    },
  }));
}
