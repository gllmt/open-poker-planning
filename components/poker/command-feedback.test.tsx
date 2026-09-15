// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { sileo } from 'sileo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from './game-controller';
import { Players } from './players';
import { I18nContext } from '@/lib/i18n/context';
import dictionary from '@/lib/i18n/dictionaries/en.json';
import { type Game, GameType } from '@/types/game';
import { Status } from '@/types/status';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('sileo', () => ({ sileo: { info: vi.fn() } }));
vi.mock('./timer/timer', () => ({ Timer: () => null }));
vi.mock('./results/results-section', () => ({ ResultsSection: () => null }));

const game: Game = {
  id: 'game',
  name: 'Sprint',
  createdBy: 'Alice',
  createdById: 'alice',
  gameType: GameType.Fibonacci,
  gameStatus: Status.Started,
  cards: [],
  isAllowMembersToManageSession: true,
};
const players = ['alice', 'bob', 'carol'].map((id) => ({
  id,
  name: id,
  status: Status.NotStarted,
  value: 0,
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nContext value={{ locale: 'en', dictionary }}>{children}</I18nContext>
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('command feedback', () => {
  it.each(['reveal', 'restart', 'autoReveal'] as const)(
    'reports a rejected %s and restores the control',
    async (command) => {
      const reject = vi.fn().mockRejectedValue(new Error('unavailable'));
      render(
        <GameController
          game={game}
          players={players}
          currentPlayerId="bob"
          isAdmin={false}
          onReveal={reject}
          onReset={reject}
          onAutoReveal={reject}
          onTimerUpdate={vi.fn()}
          onDeleteGame={vi.fn()}
          onLeaveGame={vi.fn()}
        />,
        { wrapper }
      );
      const control = screen.getByRole(
        command === 'autoReveal' ? 'switch' : 'button',
        { name: dictionary.game[command] }
      );
      fireEvent.click(control);
      await waitFor(() =>
        expect(sileo.info).toHaveBeenCalledWith(
          expect.objectContaining({ title: dictionary.game.actionFailed })
        )
      );
      expect(control.hasAttribute('disabled')).toBe(false);
    }
  );

  it('offers removal only for another non-owner player and reports failures', async () => {
    const remove = vi.fn().mockRejectedValue(new Error('unavailable'));
    render(
      <Players
        game={game}
        players={players}
        currentPlayerId="bob"
        onRemovePlayer={remove}
      />,
      { wrapper }
    );
    const buttons = screen.getAllByRole('button', {
      name: dictionary.playerCard.removeButton,
    });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(sileo.info).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith('carol');
  });
});
