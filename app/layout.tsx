import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';

import { Toolbar } from '@/components/toolbar/toolbar';

import './globals.css';

const notoSans = Noto_Sans({ variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Planning Poker',
  description: 'Free planning poker app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} antialiased`}>
        <div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
          <Toolbar />
          {children}
        </div>
      </body>
    </html>
  );
}
