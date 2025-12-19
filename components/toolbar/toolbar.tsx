'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const ThemeControl = dynamic(
  () => import('./theme-control').then((m) => m.ThemeControl),
  { ssr: false }
);

export function Toolbar() {
  return (
    <header className="flex w-full items-center justify-between shadow-sm dark:shadow-gray-800 p-2 px-4">
      <div className="inline-flex items-center">
        <Link href="/" className="flex items-center">
          <span className="md:text-2xl text-sm font-normal">
            Planning Poker
          </span>
        </Link>
      </div>

      <nav className="inline-flex items-center justify-end gap-1">
        <Link href="/shadcn" className="cursor-pointer px-4 py-2">
          Shadcn
        </Link>
        <Link href="/" className="cursor-pointer px-4 py-2">
          New
        </Link>
        <Link href="/join" className="cursor-pointer px-4 py-2">
          Join
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
