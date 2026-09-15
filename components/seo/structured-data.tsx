import 'server-only';
import { getSiteUrl } from '@/lib/seo/site-url';

type StructuredDataProps = {
  locale: string;
  name: string;
  description: string;
};

export function StructuredData({
  locale,
  name,
  description,
}: StructuredDataProps) {
  const siteUrl = getSiteUrl();
  const pageUrl = new URL(`/${locale}`, siteUrl).toString();

  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name,
        url: pageUrl,
        inLanguage: locale,
        description,
      },
      {
        '@type': 'SoftwareApplication',
        name,
        applicationCategory: 'ProjectManagementApplication',
        operatingSystem: 'Web',
        url: pageUrl,
        inLanguage: locale,
        description,
        isAccessibleForFree: true,
      },
    ],
  };

  return <script type="application/ld+json">{JSON.stringify(payload)}</script>;
}
