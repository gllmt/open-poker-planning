'use client';

import { Hourglass } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { shouldPlayTimerCompletionSound } from '@/lib/timer/completion-sound';
import { clampTimerElapsed } from '@/lib/timer/timer-snapshot';
import type { TimerProps as GameTimerProps } from '@/types/game';

const TimerProgress = dynamic(
  () => import('./timer-progress-popup').then((m) => m.TimerProgress),
  { ssr: false }
);

const playNotification = () => {
  if (typeof Audio === 'undefined') return;
  const notification = new Audio('/timer-notification.mp3');
  notification.play().catch(() => {});
};

export function Timer({
  timerProps,
  timerCompletedAt,
  onTimerUpdate,
}: {
  timerProps: {
    isMod?: boolean;
    startedAt?: number | null;
    pausedAt?: number | null;
    totalSeconds?: number;
    soundOn?: boolean;
    timerVisible?: boolean;
    currentSeconds?: number;
    timerPaused?: boolean;
  };
  timerCompletedAt?: number;
  onTimerUpdate: (timer: GameTimerProps) => Promise<void>;
}) {
  const { t } = useI18n();
  const {
    isMod = false,
    timerVisible = false,
    startedAt,
    pausedAt,
    totalSeconds = 300,
    soundOn = true,
    currentSeconds,
    timerPaused,
  } = timerProps;
  const previousCompletedAtRef = useRef(timerCompletedAt);

  useEffect(() => {
    const previousCompletedAt = previousCompletedAtRef.current;
    previousCompletedAtRef.current = timerCompletedAt;
    if (
      shouldPlayTimerCompletionSound(
        previousCompletedAt,
        timerCompletedAt,
        soundOn,
        Date.now()
      )
    ) {
      playNotification();
    }
  }, [soundOn, timerCompletedAt]);

  const commitTimerUpdate = useCallback(
    async (update: GameTimerProps) => {
      try {
        await onTimerUpdate(update);
      } catch (error) {
        sileo.info({ title: t('game.actionFailed'), position: 'top-center' });
        throw error;
      }
    },
    [onTimerUpdate, t]
  );
  const fireAndForgetTimerUpdate = useCallback(
    (update: GameTimerProps) => {
      void commitTimerUpdate(update).catch(() => {});
    },
    [commitTimerUpdate]
  );

  const legacyMigrationRef = useRef(false);
  useEffect(() => {
    if (!isMod || startedAt !== undefined || pausedAt !== undefined) return;
    if (typeof currentSeconds !== 'number') return;
    if (legacyMigrationRef.current) return;
    legacyMigrationRef.current = true;

    if (timerPaused === false) {
      const legacyElapsedSeconds = clampTimerElapsed(
        currentSeconds,
        totalSeconds
      );
      const legacyStartedAt = Date.now() - legacyElapsedSeconds * 1000;
      fireAndForgetTimerUpdate({
        startedAt: legacyStartedAt,
        elapsedSeconds: legacyElapsedSeconds,
        pausedAt: null,
        totalSeconds,
        soundOn,
        timerVisible,
      });
      return;
    }

    fireAndForgetTimerUpdate({
      startedAt: null,
      pausedAt: currentSeconds,
      totalSeconds,
      soundOn,
      timerVisible,
    });
  }, [
    startedAt,
    pausedAt,
    currentSeconds,
    timerPaused,
    isMod,
    totalSeconds,
    soundOn,
    timerVisible,
    fireAndForgetTimerUpdate,
  ]);

  const normalizedStartedAt = startedAt ?? null;
  const normalizedPausedAt =
    pausedAt ?? (typeof currentSeconds === 'number' ? currentSeconds : null);

  const setTimerVisible = (visible: boolean) => {
    fireAndForgetTimerUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds,
      soundOn,
      timerVisible: visible,
    });
  };

  if (!timerVisible) {
    if (!isMod) return null;
    return (
      <div className="glass-inner dark:dark-glass-inner text-card-foreground flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Hourglass className="size-4" aria-hidden="true" />
          <span>{t('timer.disabled')}</span>
        </div>
        <Button
          onClick={() => setTimerVisible(true)}
          title={t('timer.show')}
          type="button"
          size="sm"
          variant="ghost"
        >
          {t('timer.start')}
        </Button>
      </div>
    );
  }

  return (
    <TimerProgress
      startedAt={normalizedStartedAt}
      pausedAt={normalizedPausedAt}
      totalSeconds={totalSeconds}
      onTimerClose={() => setTimerVisible(false)}
      isMod={isMod}
      onTimerStateUpdate={(update) =>
        commitTimerUpdate({
          ...update,
          timerVisible: timerVisible,
        })
      }
      soundOn={soundOn}
    />
  );
}
