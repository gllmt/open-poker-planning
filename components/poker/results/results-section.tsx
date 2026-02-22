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
    <section className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('results.title')}</h3>
        {showAverage && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">
              {t('results.avg')}
            </span>
            <Badge
              variant="secondary"
              className="bg-primary/15 text-primary rounded-lg px-2.5 py-1 font-semibold"
            >
              {averageLabel}
            </Badge>
          </div>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/35">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('results.player')}
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                {t('results.vote')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
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
                <tr key={player.id} className="bg-background/80">
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium">{player.name}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                        hasVoted
                          ? 'bg-primary/20 text-primary'
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
    </section>
  );
}
