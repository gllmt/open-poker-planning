import { CircleQuestionMark, Coffee } from 'lucide-react';
import { useMemo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Badge } from '@/components/ui/badge';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards, normalizeLegacyCards } from '../card-configs';

export function ResultsSection({
  game,
  players,
  averageLabel,
  showAverage,
}: {
  game: Game;
  players: Player[];
  averageLabel: string;
  showAverage: boolean;
}) {
  const { t } = useI18n();
  const cardLookup = useMemo(() => {
    const baseCards = game.cards?.length ? game.cards : getCards(game.gameType);
    const cards = normalizeLegacyCards(game.gameType, baseCards);
    return new Map(cards.map((card) => [card.value, card]));
  }, [game.cards, game.gameType]);

  if (game.gameStatus !== Status.Finished) return null;

  return (
    <div className="mt-4 border-t border-border/40 pt-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('results.title')}</h3>
        {showAverage && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('results.avg')}</span>
            <Badge variant="secondary" className="font-semibold">
              {averageLabel}
            </Badge>
          </div>
        )}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl glass-inner dark:dark-glass-inner">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-muted-foreground"
              >
                {t('results.player')}
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right font-medium text-muted-foreground"
              >
                {t('results.vote')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {players.map((player) => {
              const hasVoted =
                player.status === Status.Finished && player.value !== undefined;
              const card = hasVoted
                ? cardLookup.get(player.value as number)
                : null;
              const displayValue =
                card?.displayValue ?? player.value?.toString() ?? '';
              const voteContent = hasVoted ? (
                player.value === -1 ? (
                  <Coffee className="size-4" aria-hidden="true" />
                ) : player.value === -2 ? (
                  <CircleQuestionMark className="size-4" aria-hidden="true" />
                ) : (
                  displayValue || '-'
                )
              ) : (
                '-'
              );

              return (
                <tr key={player.id}>
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium">{player.name}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                        hasVoted
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      title={displayValue || t('results.noVote')}
                    >
                      {voteContent}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
