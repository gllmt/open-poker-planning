import type { CardConfig } from '@/types/cards';
import { type Game, GameType } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards } from '../card-configs';

type ResultSummary = {
  average: number | null;
  mostPlayedCard: CardConfig | null;
  mostPlayedCount: number;
  isMostPlayedTie: boolean;
};

const fallbackCardColor = '#cbd5e1';

function getNumericVote(
  gameType: GameType,
  card: CardConfig,
  playerValue: number
) {
  const displayValue = Number(card.displayValue.replace(',', '.'));

  if (Number.isFinite(displayValue)) return displayValue;
  if (gameType === GameType.Custom) return null;
  return playerValue >= 0 ? playerValue : null;
}

export function getResultSummary(game: Game, players: Player[]): ResultSummary {
  const cards = game.cards?.length ? game.cards : getCards(game.gameType);
  const cardLookup = new Map(cards.map((card) => [card.value, card]));
  const voteCounts = new Map<number, number>();
  const supportsAverage =
    game.gameType !== GameType.TShirt &&
    game.gameType !== GameType.TShirtAndNumber;

  let averageTotal = 0;
  let averageVoteCount = 0;

  for (const player of players) {
    if (player.status !== Status.Finished || player.value === undefined) {
      continue;
    }

    const card = cardLookup.get(player.value) ?? {
      value: player.value,
      displayValue: String(player.value),
      color: fallbackCardColor,
    };

    voteCounts.set(player.value, (voteCounts.get(player.value) ?? 0) + 1);

    if (!supportsAverage) continue;
    const numericVote = getNumericVote(game.gameType, card, player.value);
    if (numericVote === null) continue;

    averageTotal += numericVote;
    averageVoteCount++;
  }

  let mostPlayedValue: number | null = null;
  let mostPlayedCount = 0;
  let mostPlayedWinners = 0;

  for (const [value, count] of voteCounts) {
    if (count > mostPlayedCount) {
      mostPlayedValue = value;
      mostPlayedCount = count;
      mostPlayedWinners = 1;
    } else if (count === mostPlayedCount) {
      mostPlayedWinners++;
    }
  }

  const isMostPlayedTie = mostPlayedWinners > 1;
  const mostPlayedCard =
    mostPlayedValue !== null && !isMostPlayedTie
      ? (cardLookup.get(mostPlayedValue) ?? {
          value: mostPlayedValue,
          displayValue: String(mostPlayedValue),
          color: fallbackCardColor,
        })
      : null;

  return {
    average:
      averageVoteCount > 0
        ? Math.round((averageTotal / averageVoteCount) * 100) / 100
        : null,
    mostPlayedCard,
    mostPlayedCount,
    isMostPlayedTie,
  };
}
