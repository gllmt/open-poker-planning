'use client';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';

import { GameArea } from './game-area';
import { useSessionExitRedirect } from './hooks/use-session-exit-redirect';
import { type PreloadedGame, usePokerController } from './use-poker-controller';

export function Poker({
  gameId,
  initialSession,
  preloadedGame,
}: {
  gameId: string;
  preloadedGame: PreloadedGame;
  initialSession: {
    adminTokenHash?: string;
    playerId: string;
    playerTokenHash: string;
  };
}) {
  const { locale, t } = useI18n();
  const controller = usePokerController({
    gameId,
    initialSession,
    preloadedGame,
    translate: t,
  });

  useSessionExitRedirect({
    gameId,
    locale,
    reason: controller.sessionExitReason,
  });

  if (controller.queryError) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive">{controller.queryError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          {t('errorBoundary.retry')}
        </Button>
      </div>
    );
  }

  if (!controller.game || !controller.players || !controller.currentPlayerId) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm">{t('game.gameNotFound')}</p>
      </div>
    );
  }

  return (
    <GameArea
      game={controller.game}
      players={controller.players}
      currentPlayerId={controller.currentPlayerId}
      isAdmin={controller.isAdmin}
      onVote={controller.onVote}
      onReveal={controller.onReveal}
      onReset={controller.onReset}
      onTimerUpdate={controller.onTimerUpdate}
      onAutoReveal={controller.onAutoReveal}
      onDeleteGame={controller.onDeleteGame}
      onLeaveGame={controller.onLeaveGame}
      onRemovePlayer={controller.onRemovePlayer}
      voteError={controller.voteError}
      confettiSeed={controller.confettiSeed}
    />
  );
}
