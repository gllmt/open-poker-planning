'use client';

import { Hourglass } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import type { TimerProps as GameTimerProps } from '@/types/game';

import { TimerProgress } from './timer-progress-popup';

export function Timer({
  timerProps,
  onTimerUpdate,
}: {
  timerProps: {
    isMod?: boolean;
    currentSeconds?: number;
    totalSeconds?: number;
    soundOn?: boolean;
    timerVisible?: boolean;
    timerPaused?: boolean;
  };
  onTimerUpdate: (timer: GameTimerProps) => void;
}) {
  const {
    isMod = false,
    timerVisible = false,
    timerPaused = false,
    currentSeconds = 0,
    totalSeconds = 300,
    soundOn = true,
  } = timerProps;

  const onTimerStateUpdate = useCallback(
    (update: GameTimerProps) => onTimerUpdate(update),
    [onTimerUpdate]
  );

  const onTimerClose = useCallback(() => {
    onTimerStateUpdate({
      currentSeconds: 0,
      totalSeconds: 300,
      soundOn: true,
      timerPaused: false,
      timerVisible: false,
    });
  }, [onTimerStateUpdate]);

  return (
    <>
      {isMod && (
        <Button
          onClick={() =>
            onTimerStateUpdate({
              currentSeconds: 0,
              totalSeconds: 300,
              soundOn: true,
              timerPaused: false,
              timerVisible: true,
            })
          }
          title="Timer"
          aria-label="Timer"
          type="button"
          size="icon"
          variant="ghost"
        >
          <span
            className={`${timerVisible ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Hourglass className="size-5" aria-hidden="true" />
          </span>
        </Button>
      )}

      {timerVisible && (
        <TimerProgress
          currentSeconds={currentSeconds}
          totalSeconds={totalSeconds}
          onTimerClose={onTimerClose}
          isMod={isMod}
          onTimerStateUpdate={(update) =>
            onTimerStateUpdate({ ...update, timerVisible })
          }
          soundOn={soundOn}
          timerPaused={timerPaused}
        />
      )}
    </>
  );
}
