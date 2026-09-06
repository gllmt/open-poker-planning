import { UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/components/i18n/use-i18n';
import { isModerator } from '@/lib/is-moderator';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { getCards, normalizeLegacyCards } from './card-configs';
import { PlayerCard } from './player-card';

export function Players({
  game,
  players,
  currentPlayerId,
  onRemovePlayer,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onRemovePlayer: (playerId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const isCurrentPlayerModerator = isModerator(
    game.createdById,
    currentPlayerId,
    game.isAllowMembersToManageSession
  );
  const cardLookup = useMemo(() => {
    const baseCards = game.cards?.length ? game.cards : getCards(game.gameType);
    const cards = normalizeLegacyCards(game.gameType, baseCards);
    return new Map(cards.map((card) => [card.value, card]));
  }, [game.cards, game.gameType]);

  return (
    <div className="glass-card dark:dark-glass-card w-full rounded-2xl p-4 lg:mb-auto lg:mt-5 lg:w-[320px]">
      <div className="flex w-full items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">{t('players.title')}</h2>
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <UserRound className="size-4" />
          <span>{players.length}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {players.map((player, index) => (
          <PlayerCard
            key={player.id}
            gameStatus={game.gameStatus}
            canRemove={
              isCurrentPlayerModerator &&
              player.id !== currentPlayerId &&
              player.id !== game.createdById
            }
            player={player}
            card={
              player.value === undefined
                ? undefined
                : cardLookup.get(player.value)
            }
            revealDelayMs={Math.min(index, 8) * 65}
            onRemovePlayer={onRemovePlayer}
          />
        ))}
      </div>
    </div>
  );
}
