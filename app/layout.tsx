import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';
import { cookies } from 'next/headers';

import { i18n, isLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

import './globals.css';

const notoSans = Noto_Sans({ variable: '--font-sans' });

const themeScript =
  "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();";

export const metadata: Metadata = {
  title: 'Planning Poker',
  description: 'Free planning poker app',
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
  const lang = isLocale(cookieLocale) ? cookieLocale : i18n.defaultLocale;

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script>{themeScript}</script>
      </head>
      <body className={`${notoSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
