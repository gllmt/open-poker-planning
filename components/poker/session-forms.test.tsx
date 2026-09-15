// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateGame } from './create-game';
import { JoinGame } from './join-game';
import { RecentGames } from './recent-games';
import { I18nContext } from '@/lib/i18n/context';
import dictionary from '@/lib/i18n/dictionaries/en.json';

vi.mock('@posthog/next', () => ({ usePostHog: () => null }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nContext value={{ locale: 'en', dictionary }}>{children}</I18nContext>
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('session forms', () => {
  it.each([CreateGame, JoinGame])(
    'prefills the remembered name once and lets the user clear it',
    (Form) => {
      localStorage.setItem('recentPlayerName', 'Alice');
      render(<Form />, { wrapper });
      const name = screen.getByDisplayValue<HTMLInputElement>('Alice');
      fireEvent.change(name, { target: { value: '' } });
      expect(name.value).toBe('');
      fireEvent.change(name, { target: { value: 'Bob' } });
      expect(name.value).toBe('Bob');
    }
  );

  it('exposes each recent game as a native link', () => {
    localStorage.setItem(
      'playerGames',
      JSON.stringify([{ id: 'sprint', name: 'Sprint', createdBy: 'Alice' }])
    );
    render(<RecentGames />, { wrapper });
    const link = screen.getByRole('link', { name: 'Sprint' });
    expect(link.getAttribute('href')).toBe('/en/game/sprint');
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});
