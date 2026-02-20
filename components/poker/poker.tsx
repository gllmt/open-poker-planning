'use client';

import { redirect } from 'next/navigation';

import { useI18n } from '@/components/i18n/use-i18n';
import { Loading } from '@/components/ui/loading';
import { withLocale } from '@/lib/i18n/paths';

import { GameArea } from './game-area';
import { usePokerController } from './use-poker-controller';

export function Poker({ gameId }: { gameId: string }) {
  const { locale, t } = useI18n();
  const controller = usePokerController({ gameId, translate: t });

  if (controller.shouldRedirectToJoin) {
    redirect(withLocale(`/join/${gameId}`, locale));
  }

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
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => window.location.reload()}
        >
          {t('common.retry') || 'Retry'}
        </button>
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
      onRemovePlayer={controller.onRemovePlayer}
      voteError={controller.voteError}
      confettiSeed={controller.confettiSeed}
    />
  );
}
