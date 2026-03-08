'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { clearGameSession } from '@/lib/api/games';
import { clearPlayerGameSession } from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';

import { GameArea } from './game-area';
import { usePokerController } from './use-poker-controller';

export function Poker({
  gameId,
  initialSession,
}: {
  gameId: string;
  initialSession: {
    adminTokenHash?: string;
    playerId: string;
    playerTokenHash: string;
  };
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const hasHandledSessionExitRef = useRef(false);
  const controller = usePokerController({
    gameId,
    initialSession,
    translate: t,
  });

  useEffect(() => {
    if (!controller.sessionExitReason || hasHandledSessionExitRef.current) {
      return;
    }

    hasHandledSessionExitRef.current = true;
    clearPlayerGameSession(gameId);

    const redirectTo =
      controller.sessionExitReason === 'left'
        ? withLocale('/', locale)
        : withLocale(
            `/join/${gameId}?reason=${controller.sessionExitReason}`,
            locale
          );

    void clearGameSession(gameId)
      .catch(() => {})
      .finally(() => {
        router.replace(redirectTo);
      });
  }, [controller.sessionExitReason, gameId, locale, router]);

  if (controller.loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loading />
      </div>
    );
  }

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
          {t('common.retry') || 'Retry'}
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
