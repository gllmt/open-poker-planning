import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';
import Script from 'next/script';

import { Toolbar } from '@/components/toolbar/toolbar';

import './globals.css';

const notoSans = Noto_Sans({ variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Planning Poker',
  description: 'Free planning poker app',
};

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    const theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : prefersDark
          ? 'dark'
          : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${notoSans.variable} antialiased`}>
        <Script id="theme-script" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="bg-background text-foreground min-h-screen">
          <Toolbar />
          {children}
        </div>
      </body>
    </html>
  );
}
