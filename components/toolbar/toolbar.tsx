'use client';

import Link from 'next/link';

import dynamic from 'next/dynamic';

const ThemeControl = dynamic(() => import('./theme-control').then((m) => m.ThemeControl), { ssr: false });

export function Toolbar() {
  return (
    <header className='flex w-full items-center justify-between shadow-sm dark:shadow-gray-800 px-2'>
      <div className='inline-flex items-center'>
        <Link href='/' className='button-ghost flex items-center'>
          <span className='md:text-2xl text-sm font-normal'>Planning Poker</span>
        </Link>
      </div>

      <nav className='inline-flex items-center justify-end gap-1'>
        <Link href='/' className='button-ghost'>
          New session
        </Link>
        <Link href='/join' className='button-ghost'>
          Join session
        </Link>
        <ThemeControl />
      </nav>
    </header>
  );
}
