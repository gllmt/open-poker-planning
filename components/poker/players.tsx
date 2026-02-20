import { UserRound } from 'lucide-react';
import { useI18n } from '@/components/i18n/use-i18n';
import { isModerator } from '@/lib/is-moderator';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
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

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card shadow-[var(--shadow-sm)] dark:border dark:border-border/50 p-3 w-full md:w-[220px] md:mt-5 md:mb-auto">
      <div className="flex w-full items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('players.title')}</h2>
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <UserRound className="size-4" />
          <span>{players.length}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            gameStatus={game.gameStatus}
            isCurrentPlayerModerator={isCurrentPlayerModerator}
            player={player}
            currentPlayerId={currentPlayerId}
            onRemovePlayer={onRemovePlayer}
          />
        ))}
      </div>
    </div>
  );
}
