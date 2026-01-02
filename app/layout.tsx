import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';

import { Toolbar } from '@/components/toolbar/toolbar';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script>{themeScript}</script>
      </head>
      <body className={`${notoSans.variable} antialiased`}>
        <div className="bg-background text-foreground min-h-screen">
          <Toolbar />
          {children}
        </div>
      </body>
    </html>
  );
}
