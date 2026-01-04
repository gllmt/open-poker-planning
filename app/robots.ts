import 'server-only';

import type { MetadataRoute } from 'next';

import { i18n } from '@/lib/i18n/config';
import { getSiteUrl } from '@/lib/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const isGated = Boolean(process.env.SITE_ACCESS_CODE);
  const localizedDisallow = i18n.locales.flatMap((locale) => [
    `/${locale}/access`,
    `/${locale}/access/`,
    `/${locale}/join`,
    `/${locale}/join/`,
    `/${locale}/game/`,
  ]);

  return {
    rules: isGated
      ? { userAgent: '*', disallow: '/' }
      : {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/api/',
            '/access',
            '/access/',
            '/join',
            '/join/',
            '/game/',
            ...localizedDisallow,
          ],
        },
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
    host: siteUrl.toString(),
  };
}
