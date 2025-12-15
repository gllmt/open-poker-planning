import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Toolbar } from '@/components/toolbar/toolbar';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  preload: false,
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
          <Toolbar />
          {children}
        </div>
      </body>
    </html>
  );
}
