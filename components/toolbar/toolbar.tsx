'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const ThemeControl = dynamic(
  () => import('./theme-control').then((m) => m.ThemeControl),
  { ssr: false }
);

export function Toolbar() {
  return (
    <header className="border-border/80 bg-background/80 flex w-full items-center justify-between border-b px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="inline-flex items-center">
        <Link href="/" className="flex items-center">
          <span className="md:text-2xl text-sm font-normal">
            Planning Poker
          </span>
        </Link>
      </div>

      <nav className="inline-flex items-center justify-end gap-1">
        <Link
          href="/shadcn"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-3 py-2 text-sm font-medium transition"
        >
          Shadcn
        </Link>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-3 py-2 text-sm font-medium transition"
        >
          New
        </Link>
        <Link
          href="/join"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-3 py-2 text-sm font-medium transition"
        >
          Join
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
