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
    <aside className="flex h-fit flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <h2 className="text-lg font-semibold">{t('players.title')}</h2>
        <div className="bg-muted/75 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold">
          <UserRound className="size-4" aria-hidden="true" />
          <span>{players.length}</span>
        </div>
      </div>
      <div className="space-y-2 overflow-y-auto px-4 py-4">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            gameStatus={game.gameStatus}
            isSessionOwner={player.id === game.createdById}
            isCurrentPlayerModerator={isCurrentPlayerModerator}
            player={player}
            currentPlayerId={currentPlayerId}
            onRemovePlayer={onRemovePlayer}
          />
        ))}
      </div>
    </aside>
  );
}
