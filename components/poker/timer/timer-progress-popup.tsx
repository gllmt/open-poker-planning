'use client';

import {
  Minus,
  Pause,
  Play,
  Plus,
  Square,
  Volume2,
  VolumeOff,
  X,
} from 'lucide-react';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      active ? nowStore.subscribe(onStoreChange) : () => {},
    [active]
  );
  const getSnapshot = useCallback(
    () => (active ? nowStore.getSnapshot() : nowStore.getServerSnapshot()),
    [active]
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
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
    <div className="border-border bg-card text-card-foreground w-full rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            title={soundOn ? 'Sound enabled' : 'Sound disabled'}
            className="text-muted-foreground"
          >
            {soundOn ? (
              <Volume2 className="size-4" aria-hidden="true" />
            ) : (
              <VolumeOff className="size-4" aria-hidden="true" />
            )}
          </div>
          <div
            title={`Running time: ${runningMinutes}m ${runningSeconds}s`}
            className="text-foreground flex items-center gap-1 font-mono text-lg tabular-nums"
          >
            <Input
              type="text"
              value={runningMinutes.toString().padStart(2, '0')}
              maxLength={3}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={() => {}}
              disabled
            />
            <span className="pb-[0.2rem]">:</span>
            <Input
              type="text"
              value={runningSeconds.toString().padStart(2, '0')}
              maxLength={3}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={() => {}}
              disabled
            />
          </div>
        </div>
        {!inProgress && (
          <span className="text-muted-foreground text-xs">
            Total {minutes.toString().padStart(2, '0')}:
            {seconds.toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 ease-linear"
          style={{ width: `${percentage}%` }}
        />
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
    <div className="border-border bg-card text-card-foreground w-full rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            title={soundOn ? 'Disable sound' : 'Enable sound'}
            onClick={() => isMod && toggleSound()}
            type="button"
            size="icon-xs"
            variant="ghost"
          >
            {soundOn ? (
              <Volume2 className="size-4" aria-hidden="true" />
            ) : (
              <VolumeOff className="size-4" aria-hidden="true" />
            )}
          </Button>
          <div
            title={
              isMod
                ? `Set time: ${minutes}m ${seconds}s`
                : `Running time: ${runningMinutes}m ${runningSeconds}s`
            }
            className="text-foreground flex items-center gap-1 font-mono text-lg tabular-nums"
          >
            <Input
              type="text"
              value={
                isRunning || !isMod
                  ? runningMinutes.toString().padStart(2, '0')
                  : minutes.toString().padStart(2, '0')
              }
              maxLength={3}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={onMinutesChange}
              onBlur={onInputsBlur}
              disabled={isRunning}
            />
            <span className="pb-[0.2rem]">:</span>
            <Input
              type="text"
              value={
                isRunning || !isMod
                  ? runningSeconds.toString().padStart(2, '0')
                  : seconds.toString().padStart(2, '0')
              }
              maxLength={3}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={onSecondsChange}
              onBlur={onInputsBlur}
              disabled={isRunning}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <TimerControlButton
              title="Start timer"
              callback={startTimer}
              disabled={displayTotal === 0}
              className="text-muted-foreground"
            >
              <Play className="size-4" aria-hidden="true" />
            </TimerControlButton>
          ) : (
            <TimerControlButton
              title="Pause timer"
              callback={pauseTimer}
              className="text-muted-foreground"
            >
              <Pause className="size-4" aria-hidden="true" />
            </TimerControlButton>
          )}
          {isMod && (
            <Button
              type="button"
              title="Close timer"
              onClick={onTimerClose}
              size="icon-xs"
              variant="ghost"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isMod && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TimerControlButton
              title="Reset timer"
              callback={handleReset}
              className="text-muted-foreground"
            >
              <Square className="size-4" aria-hidden="true" />
            </TimerControlButton>
            {!isRunning && (
              <>
                <TimerControlButton
                  callback={onReduceSeconds}
                  title="Minus 1 minute"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </TimerControlButton>
                <TimerControlButton
                  callback={onAddSeconds}
                  title="Add 1 minute"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </TimerControlButton>
              </>
            )}
          </div>
          {!isRunning && (
            <span className="text-muted-foreground text-xs">
              Elapsed {currentMinutesRunning.toString().padStart(2, '0')}:
              {currentSecondsRunning.toString().padStart(2, '0')}
            </span>
          )}
        </div>
      )}
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
