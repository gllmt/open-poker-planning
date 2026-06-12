import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';

import { AppPostHogProvider } from '@/components/analytics/posthog-provider';
import { SileoToaster } from '@/components/ui/sileo-toaster';
import { i18n, isLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';
import { getSiteUrl } from '@/lib/seo/site-url';
import { isTheme, THEME_COOKIE_NAME } from '@/lib/theme/constants';

import './globals.css';

const notoSans = Noto_Sans({ variable: '--font-sans' });
const umamiHost = (
  process.env.NEXT_PUBLIC_UMAMI_HOST || 'https://umami.pierreguillemot.dev'
).replace(/\/$/, '');
const umamiWebsiteId =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ||
  '72235807-ee28-4c05-9f7a-a68539283061';

const themeScript =
  "(function(){try{var root=document.documentElement;var stored=localStorage.getItem('theme');var match=document.cookie.match(/(?:^|; )pp_theme=(light|dark)(?:;|$)/);var cookieTheme=match?match[1]:null;var theme=(stored==='light'||stored==='dark')?stored:((cookieTheme==='light'||cookieTheme==='dark')?cookieTheme:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));root.classList.remove('light','dark');root.classList.add(theme);}catch(e){}})();";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: 'Planning Poker',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  title: 'Planning Poker',
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const cookieTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const lang = isLocale(cookieLocale) ? cookieLocale : i18n.defaultLocale;
  const initialThemeClass = isTheme(cookieTheme) ? cookieTheme : undefined;

  return (
    <html lang={lang} className={initialThemeClass} suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className={`${notoSans.variable} antialiased`}>
        <AppPostHogProvider>
          {children}
          <SileoToaster />
        </AppPostHogProvider>
        {umamiHost && umamiWebsiteId ? (
          <Script
            src={`${umamiHost}/script.js`}
            data-website-id={umamiWebsiteId}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
