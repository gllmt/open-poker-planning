'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CircularProgressBar } from './circular-progress';

type TimerProps = {
  isMod?: boolean;
  startedAt?: number | null;
  pausedAt?: number | null;
  totalSeconds?: number;
  soundOn?: boolean;
  onTimerClose: () => void;
  onTimerStateUpdate: (update: {
    startedAt: number | null;
    pausedAt: number | null;
    totalSeconds: number;
    soundOn: boolean;
  }) => void;
};

const getMinutesAndSeconds = (time: number) =>
  [Math.floor(time / 60), time % 60] as const;

const playNotification = () => {
  if (typeof Audio === 'undefined') return;
  const notification = new Audio('/timer-notification.mp3');
  notification.play().catch(() => {});
};

const nowStore = {
  current: 0,
  listeners: new Set<() => void>(),
  intervalId: null as ReturnType<typeof setInterval> | null,
  subscribe: (listener: () => void) => {
    nowStore.listeners.add(listener);
    if (!nowStore.intervalId) {
      nowStore.current = Date.now();
      nowStore.intervalId = setInterval(() => {
        nowStore.current = Date.now();
        nowStore.listeners.forEach((cb) => {
          cb();
        });
      }, 1000);
    }
    return () => {
      nowStore.listeners.delete(listener);
      if (nowStore.listeners.size === 0 && nowStore.intervalId) {
        clearInterval(nowStore.intervalId);
        nowStore.intervalId = null;
      }
    };
  },
  getSnapshot: () => nowStore.current,
  getServerSnapshot: () => 0,
};

function useNow(active: boolean) {
  return useSyncExternalStore(
    (onStoreChange) => (active ? nowStore.subscribe(onStoreChange) : () => {}),
    nowStore.getSnapshot,
    nowStore.getServerSnapshot
  );
}

export function TimerProgress(props: TimerProps) {
  if (props.isMod) return <TimerProgressMod {...props} />;
  return <TimerProgressView {...props} />;
}

function TimerProgressView({
  startedAt = null,
  pausedAt = 0,
  totalSeconds = 300,
  soundOn = true,
}: TimerProps) {
  const startedAtValue = startedAt ?? 0;
  const inProgress = startedAt != null;
  const now = useNow(inProgress);
  const elapsed = inProgress
    ? Math.floor((now - startedAtValue) / 1000)
    : (pausedAt ?? 0);
  const clampedElapsed = Math.min(
    Math.max(elapsed, 0),
    Math.max(totalSeconds, 0)
  );
  const remaining = Math.max(0, totalSeconds - clampedElapsed);

  const [minutes, seconds] = getMinutesAndSeconds(totalSeconds);
  const [runningMinutes, runningSeconds] = getMinutesAndSeconds(remaining);
  const percentage = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 100;

  return (
    <div className="border-border bg-card text-card-foreground absolute top-13 right-2 z-10 h-fit w-[15rem] rounded-xl border p-4 shadow-xl">
      <div
        title={soundOn ? 'Sound enabled' : 'Sound disabled'}
        className="text-muted-foreground absolute top-3 left-3 p-1"
      >
        {soundOn ? '🔊' : '🔇'}
      </div>
      <div className="flex h-full w-full justify-center items-center space-y-2 flex-col">
        <CircularProgressBar percentage={percentage}>
          <div className="text-4xl flex flex-col items-center space-y-2">
            <div
              title={`Running time: ${runningMinutes}m ${runningSeconds}s`}
              className="text-foreground flex items-center space-x-1 flex-grow"
            >
              <input
                type="text"
                value={runningMinutes.toString().padStart(2, '0')}
                maxLength={3}
                pattern="[0-9]*"
                className="text-foreground disabled:text-muted-foreground w-[2.5rem] border-none bg-transparent focus:outline-none"
                onChange={() => {}}
                disabled
              />
              <span className="pb-[0.3rem]">:</span>
              <input
                type="text"
                value={runningSeconds.toString().padStart(2, '0')}
                maxLength={3}
                pattern="[0-9]*"
                className="text-foreground disabled:text-muted-foreground w-[2.5rem] border-none bg-transparent focus:outline-none"
                onChange={() => {}}
                disabled
              />
            </div>
            {!inProgress && (
              <div
                title={`Paused at ${minutes}m ${seconds}s`}
                className="text-foreground text-2xl"
              >
                <span>{minutes.toString().padStart(2, '0')}</span>
                <span>:</span>
                <span>{seconds.toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </CircularProgressBar>
      </div>
    </div>
  );
}

function TimerProgressMod({
  isMod = false,
  startedAt = null,
  pausedAt = 0,
  totalSeconds = 300,
  onTimerClose,
  onTimerStateUpdate,
  soundOn = true,
}: TimerProps) {
  const [draftTotal, setDraftTotal] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startedAtValue = startedAt ?? 0;
  const isRunning = startedAt != null;
  const now = useNow(isRunning);
  const elapsed = isRunning
    ? Math.floor((now - startedAtValue) / 1000)
    : (pausedAt ?? 0);
  const clampedElapsed = Math.min(
    Math.max(elapsed, 0),
    Math.max(totalSeconds, 0)
  );
  const remaining = Math.max(0, totalSeconds - clampedElapsed);
  const activeDraftTotal =
    draftTotal !== null && draftTotal !== totalSeconds ? draftTotal : null;
  const resolvedDraftTotal = activeDraftTotal ?? totalSeconds;
  const displayTotal = isRunning ? totalSeconds : resolvedDraftTotal;

  useEffect(() => {
    if (!isRunning) {
      finishedRef.current = false;
      return;
    }
    if (remaining > 0) {
      finishedRef.current = false;
      return;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;
    playNotification();
    onTimerStateUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds,
      soundOn,
    });
  }, [isRunning, remaining, totalSeconds, soundOn, onTimerStateUpdate]);

  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    };
  }, []);

  const cancelPendingUpdate = useCallback(() => {
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
  }, []);

  const commitTotalUpdate = useCallback(
    (nextTotal: number) => {
      const safeTotal = Math.max(0, nextTotal);
      cancelPendingUpdate();
      onTimerStateUpdate({
        startedAt: null,
        pausedAt: 0,
        totalSeconds: safeTotal,
        soundOn,
      });
    },
    [cancelPendingUpdate, soundOn, onTimerStateUpdate]
  );

  const scheduleTotalUpdate = useCallback(
    (nextTotal: number) => {
      const safeTotal = Math.max(0, nextTotal);
      cancelPendingUpdate();
      pendingUpdateRef.current = setTimeout(() => {
        pendingUpdateRef.current = null;
        onTimerStateUpdate({
          startedAt: null,
          pausedAt: 0,
          totalSeconds: safeTotal,
          soundOn,
        });
      }, 400);
    },
    [cancelPendingUpdate, soundOn, onTimerStateUpdate]
  );

  const startTimer = useCallback(() => {
    cancelPendingUpdate();
    const baseElapsed = pausedAt ?? 0;
    const startAt = Date.now() - baseElapsed * 1000;
    onTimerStateUpdate({
      startedAt: startAt,
      pausedAt: null,
      totalSeconds: resolvedDraftTotal,
      soundOn,
    });
  }, [
    pausedAt,
    resolvedDraftTotal,
    soundOn,
    onTimerStateUpdate,
    cancelPendingUpdate,
  ]);

  const pauseTimer = useCallback(() => {
    cancelPendingUpdate();
    onTimerStateUpdate({
      startedAt: null,
      pausedAt: clampedElapsed,
      totalSeconds,
      soundOn,
    });
  }, [
    clampedElapsed,
    totalSeconds,
    soundOn,
    onTimerStateUpdate,
    cancelPendingUpdate,
  ]);

  const handleReset = useCallback(() => {
    cancelPendingUpdate();
    onTimerStateUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds,
      soundOn,
    });
  }, [totalSeconds, soundOn, onTimerStateUpdate, cancelPendingUpdate]);

  const onAddSeconds = useCallback(() => {
    const nextTotal = resolvedDraftTotal + 60;
    setDraftTotal(nextTotal);
    commitTotalUpdate(nextTotal);
  }, [resolvedDraftTotal, commitTotalUpdate]);

  const onReduceSeconds = useCallback(() => {
    const nextTotal =
      resolvedDraftTotal - 60 > 30
        ? resolvedDraftTotal - 60
        : resolvedDraftTotal;
    setDraftTotal(nextTotal);
    commitTotalUpdate(nextTotal);
  }, [resolvedDraftTotal, commitTotalUpdate]);

  const onMinutesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const minutes = Number(event.target.value.slice(-2));
      const nextTotal = minutes * 60 + (resolvedDraftTotal % 60);
      setDraftTotal(nextTotal);
      scheduleTotalUpdate(nextTotal);
    },
    [resolvedDraftTotal, scheduleTotalUpdate]
  );

  const onSecondsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const seconds = Number(event.target.value.slice(-2));
      const nextTotal = Math.floor(resolvedDraftTotal / 60) * 60 + seconds;
      setDraftTotal(nextTotal);
      scheduleTotalUpdate(nextTotal);
    },
    [resolvedDraftTotal, scheduleTotalUpdate]
  );

  const onInputsBlur = useCallback(() => {
    if (activeDraftTotal === null) return;
    commitTotalUpdate(activeDraftTotal);
  }, [activeDraftTotal, commitTotalUpdate]);

  const toggleSound = useCallback(() => {
    cancelPendingUpdate();
    const nextSound = !soundOn;
    onTimerStateUpdate({
      startedAt: startedAt ?? null,
      pausedAt: startedAt ? null : (pausedAt ?? 0),
      totalSeconds,
      soundOn: nextSound,
    });
  }, [
    soundOn,
    startedAt,
    pausedAt,
    totalSeconds,
    onTimerStateUpdate,
    cancelPendingUpdate,
  ]);

  const [minutes, seconds] = getMinutesAndSeconds(displayTotal);
  const [runningMinutes, runningSeconds] = getMinutesAndSeconds(remaining);
  const percentage = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 100;
  const [currentMinutesRunning, currentSecondsRunning] =
    getMinutesAndSeconds(clampedElapsed);

  return (
    <div className="border-border bg-card text-card-foreground absolute top-13 right-2 z-10 h-fit w-[15rem] rounded-xl border p-4 shadow-xl">
      <Button
        title={soundOn ? 'Disable sound' : 'Enable sound'}
        className="absolute top-3 left-3"
        onClick={() => isMod && toggleSound()}
        type="button"
        size="icon-xs"
        variant="ghost"
      >
        {soundOn ? '🔊' : '🔇'}
      </Button>
      {isMod && (
        <Button
          type="button"
          className="absolute top-3 right-3"
          title="Close timer"
          onClick={onTimerClose}
          size="icon-xs"
          variant="ghost"
        >
          ✕
        </Button>
      )}
      <div className="flex h-full w-full justify-center items-center space-y-2 flex-col">
        <CircularProgressBar percentage={percentage}>
          <div className="text-4xl flex flex-col items-center space-y-2">
            <div
              title={
                isMod
                  ? `Set time: ${minutes}m ${seconds}s`
                  : `Running time: ${runningMinutes}m ${runningSeconds}s`
              }
              className="text-foreground flex items-center space-x-1 flex-grow"
            >
              <input
                type="text"
                value={
                  isRunning || !isMod
                    ? runningMinutes.toString().padStart(2, '0')
                    : minutes.toString().padStart(2, '0')
                }
                maxLength={3}
                pattern="[0-9]*"
                className="text-foreground disabled:text-muted-foreground w-[2.5rem] border-none bg-transparent focus:outline-none"
                onChange={onMinutesChange}
                onBlur={onInputsBlur}
                disabled={isRunning}
              />
              <span className="pb-[0.3rem]">:</span>
              <input
                type="text"
                value={
                  isRunning || !isMod
                    ? runningSeconds.toString().padStart(2, '0')
                    : seconds.toString().padStart(2, '0')
                }
                maxLength={3}
                pattern="[0-9]*"
                className="text-foreground disabled:text-muted-foreground w-[2.5rem] border-none bg-transparent focus:outline-none"
                onChange={onSecondsChange}
                onBlur={onInputsBlur}
                disabled={isRunning}
              />
            </div>
            {isMod && !isRunning && (
              <div
                title={`Elapsed: ${currentMinutesRunning}m ${currentSecondsRunning}s`}
                className="text-foreground text-2xl"
              >
                <span>{currentMinutesRunning.toString().padStart(2, '0')}</span>
                <span>:</span>
                <span>{currentSecondsRunning.toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </CircularProgressBar>

        {isMod && (
          <>
            <Separator className="my-3" />
            <div className="flex space-x-2 w-full">
              <TimerControlButton
                title="Reset timer"
                callback={handleReset}
                className="text-muted-foreground"
              >
                {'\u23F9'}
              </TimerControlButton>
              <div className="flex-grow w-full">
                {!isRunning && (
                  <div className="flex justify-center items-center gap-x-2 w-full h-8">
                    <TimerControlButton
                      callback={onReduceSeconds}
                      title="Minus 1 minute"
                    >
                      -
                    </TimerControlButton>
                    <TimerControlButton
                      callback={onAddSeconds}
                      title="Add 1 minute"
                    >
                      +
                    </TimerControlButton>
                  </div>
                )}
              </div>
              {!isRunning ? (
                <TimerControlButton
                  title="Start timer"
                  callback={startTimer}
                  disabled={displayTotal === 0}
                  className="text-muted-foreground"
                >
                  {'\u25B6'}
                </TimerControlButton>
              ) : (
                <TimerControlButton
                  title="Pause timer"
                  callback={pauseTimer}
                  className="text-muted-foreground"
                >
                  {'\u23F8'}
                </TimerControlButton>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimerControlButton({
  title,
  callback,
  children,
  disabled = false,
  className = '',
}: {
  title: string;
  callback: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      title={title}
      className={`text-muted-foreground hover:text-foreground ${className}`}
      onClick={callback}
      type="button"
      disabled={disabled}
      size="icon-sm"
      variant="outline"
    >
      {children}
    </Button>
  );
}
