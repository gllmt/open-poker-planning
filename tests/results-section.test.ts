import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '@/components/i18n/provider';
import { getCards } from '@/components/poker/card-configs';
import { ResultsSection } from '@/components/poker/results/results-section';
import en from '@/lib/i18n/dictionaries/en.json';
import { type Game, GameType } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

describe('ResultsSection', () => {
  it('stays visible with concealed cards after the game is restarted', () => {
    const game: Game = {
      id: 'game-1',
      name: 'Test game',
      gameStatus: Status.Started,
      gameType: GameType.Fibonacci,
      cards: getCards(GameType.Fibonacci),
      createdBy: 'Alice',
      createdById: 'player-1',
    };
    const players: Player[] = [
      {
        id: 'player-1',
        name: 'Alice',
        status: Status.NotStarted,
        value: 0,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { locale: 'en', dictionary: en },
        createElement(ResultsSection, { game, players })
      )
    );

    expect(markup).toContain('Results');
    expect(markup).toContain('No numeric average is available.');
    expect(markup).toContain('No revealed vote is available.');
    expect(markup.match(/data-face="back"/g)).toHaveLength(2);
  });
});
