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

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clampTimerElapsed,
  getTimerSnapshot,
} from '@/lib/timer/timer-snapshot';

type TimerProps = {
  isMod?: boolean;
  startedAt?: number | null;
  pausedAt?: number | null;
  totalSeconds?: number;
  soundOn?: boolean;
  onTimerClose: () => void;
  onTimerStateUpdate: (update: {
    startedAt: number | null;
    elapsedSeconds?: number;
    pausedAt: number | null;
    totalSeconds: number;
    soundOn: boolean;
  }) => Promise<void>;
};

const getMinutesAndSeconds = (time: number) =>
  [Math.floor(time / 60), time % 60] as const;

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

const showTimerDebugPresets = process.env.NEXT_PUBLIC_TIMER_DEBUG === 'true';

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
  const { t } = useI18n();
  const inProgress = startedAt !== null;
  const now = useNow(inProgress);
  const { remaining, percentage } = getTimerSnapshot(
    { startedAt, pausedAt, totalSeconds },
    now
  );

  const [minutes, seconds] = getMinutesAndSeconds(totalSeconds);
  const [runningMinutes, runningSeconds] = getMinutesAndSeconds(remaining);
  const totalMinutesLabel = minutes.toString().padStart(2, '0');
  const totalSecondsLabel = seconds.toString().padStart(2, '0');

  return (
    <div className="border-border bg-card text-card-foreground w-full rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            title={soundOn ? t('timer.soundEnabled') : t('timer.soundDisabled')}
            className="text-muted-foreground"
          >
            {soundOn ? (
              <Volume2 className="size-4" aria-hidden="true" />
            ) : (
              <VolumeOff className="size-4" aria-hidden="true" />
            )}
          </div>
          <div
            title={t('timer.runningTime', {
              minutes: runningMinutes,
              seconds: runningSeconds,
            })}
            className="text-foreground flex items-center gap-1 font-mono text-lg tabular-nums"
          >
            <Input
              type="text"
              value={runningMinutes.toString().padStart(2, '0')}
              aria-label={t('timer.minutes')}
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={() => {}}
              disabled
            />
            <span className="pb-[0.2rem]">:</span>
            <Input
              type="text"
              value={runningSeconds.toString().padStart(2, '0')}
              aria-label={t('timer.seconds')}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={() => {}}
              disabled
            />
          </div>
        </div>
        {!inProgress && (
          <span className="text-muted-foreground text-xs">
            {t('timer.total', {
              minutes: totalMinutesLabel,
              seconds: totalSecondsLabel,
            })}
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
  const { t } = useI18n();
  const [draft, setDraft] = useState<{
    minutes: string;
    seconds: string;
  } | null>(null);
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const revision = useRef(0);

  const isRunning = startedAt !== null;
  const now = useNow(isRunning);
  const {
    elapsed: clampedElapsed,
    remaining,
    percentage,
  } = getTimerSnapshot({ startedAt, pausedAt, totalSeconds }, now);
  const resolvedDraftTotal = draft
    ? Number(draft.minutes) * 60 + Number(draft.seconds)
    : totalSeconds;
  const displayTotal = isRunning ? totalSeconds : resolvedDraftTotal;

  const cancelPendingUpdate = useCallback(() => {
    clearTimeout(pendingUpdateRef.current);
    pendingUpdateRef.current = undefined;
  }, []);

  useEffect(
    () => () => {
      ++revision.current;
      cancelPendingUpdate();
    },
    [cancelPendingUpdate]
  );

  useEffect(() => {
    if (!isRunning) return;
    ++revision.current;
    cancelPendingUpdate();
    setDraft(null);
  }, [isRunning, cancelPendingUpdate]);

  const commitUpdate = (
    update: Parameters<TimerProps['onTimerStateUpdate']>[0]
  ) => {
    cancelPendingUpdate();
    const request = ++revision.current;
    // The parent reports errors; either settlement releases this draft.
    // An older response must never clear a newer edit.
    void onTimerStateUpdate(update)
      .catch(() => {})
      .finally(() => {
        if (request === revision.current) setDraft(null);
      });
  };

  const commitTotalUpdate = (nextTotal: number) => {
    commitUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds: nextTotal,
      soundOn,
    });
  };

  const setTotal = (nextTotal: number) => {
    const safeTotal = Math.max(0, Math.min(24 * 60 * 60, nextTotal));
    const [minutes, seconds] = getMinutesAndSeconds(safeTotal);
    setDraft({ minutes: String(minutes), seconds: String(seconds) });
    commitTotalUpdate(safeTotal);
  };

  const startTimer = () => {
    const baseElapsed = draft
      ? 0
      : clampTimerElapsed(pausedAt ?? 0, resolvedDraftTotal);
    commitUpdate({
      startedAt: Date.now() - baseElapsed * 1000,
      elapsedSeconds: baseElapsed,
      pausedAt: null,
      totalSeconds: resolvedDraftTotal,
      soundOn,
    });
  };

  const pauseTimer = () =>
    commitUpdate({
      startedAt: null,
      pausedAt: clampedElapsed,
      totalSeconds,
      soundOn,
    });

  const handleReset = () => commitTotalUpdate(totalSeconds);

  const onTimeChange = (
    field: 'minutes' | 'seconds',
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const text = event.target.value;
    if (!/^\d*$/.test(text)) return;
    const [minutes, seconds] = getMinutesAndSeconds(resolvedDraftTotal);
    const next = {
      minutes: draft?.minutes ?? String(minutes).padStart(2, '0'),
      seconds: draft?.seconds ?? String(seconds).padStart(2, '0'),
      [field]: text,
    };
    if (Number(next.seconds) > 59) next.seconds = '59';
    let nextTotal = Number(next.minutes) * 60 + Number(next.seconds);
    if (!Number.isFinite(nextTotal)) return;
    if (nextTotal > 24 * 60 * 60) {
      nextTotal = 24 * 60 * 60;
      next.minutes = '1440';
      next.seconds = '00';
    }
    ++revision.current;
    setDraft(next);
    cancelPendingUpdate();
    pendingUpdateRef.current = setTimeout(
      () => commitTotalUpdate(nextTotal),
      400
    );
  };

  const onInputsBlur = () => {
    if (pendingUpdateRef.current !== undefined)
      commitTotalUpdate(resolvedDraftTotal);
  };

  const toggleSound = () =>
    commitUpdate({
      startedAt,
      pausedAt: isRunning ? null : draft ? 0 : (pausedAt ?? 0),
      totalSeconds: isRunning ? totalSeconds : resolvedDraftTotal,
      soundOn: !soundOn,
    });

  const [minutes, seconds] = getMinutesAndSeconds(displayTotal);
  const [runningMinutes, runningSeconds] = getMinutesAndSeconds(remaining);
  const [currentMinutesRunning, currentSecondsRunning] =
    getMinutesAndSeconds(clampedElapsed);

  return (
    <div className="border-border bg-card text-card-foreground w-full rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            aria-label={
              soundOn ? t('timer.disableSound') : t('timer.enableSound')
            }
            title={soundOn ? t('timer.disableSound') : t('timer.enableSound')}
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
                ? t('timer.setTime', { minutes, seconds })
                : t('timer.runningTime', {
                    minutes: runningMinutes,
                    seconds: runningSeconds,
                  })
            }
            className="text-foreground flex items-center gap-1 font-mono text-lg tabular-nums"
          >
            <Input
              type="text"
              value={
                isRunning || !isMod
                  ? runningMinutes.toString().padStart(2, '0')
                  : (draft?.minutes ?? minutes.toString().padStart(2, '0'))
              }
              aria-label={t('timer.minutes')}
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(event) => onTimeChange('minutes', event)}
              onBlur={onInputsBlur}
              disabled={isRunning}
            />
            <span className="pb-[0.2rem]">:</span>
            <Input
              type="text"
              value={
                isRunning || !isMod
                  ? runningSeconds.toString().padStart(2, '0')
                  : (draft?.seconds ?? seconds.toString().padStart(2, '0'))
              }
              aria-label={t('timer.seconds')}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              className="text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(event) => onTimeChange('seconds', event)}
              onBlur={onInputsBlur}
              disabled={isRunning}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <TimerControlButton
              title={t('timer.startTitle')}
              callback={startTimer}
              disabled={displayTotal === 0}
              className="text-muted-foreground"
            >
              <Play className="size-4" aria-hidden="true" />
            </TimerControlButton>
          ) : (
            <TimerControlButton
              title={t('timer.pauseTitle')}
              callback={pauseTimer}
              className="text-muted-foreground"
            >
              <Pause className="size-4" aria-hidden="true" />
            </TimerControlButton>
          )}
          {isMod && (
            <Button
              aria-label={t('timer.closeTitle')}
              type="button"
              title={t('timer.closeTitle')}
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
              title={t('timer.resetTitle')}
              callback={handleReset}
              className="text-muted-foreground"
            >
              <Square className="size-4" aria-hidden="true" />
            </TimerControlButton>
            {!isRunning && (
              <>
                <TimerControlButton
                  callback={() =>
                    setTotal(Math.max(0, resolvedDraftTotal - 60))
                  }
                  title={t('timer.minusMinute')}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </TimerControlButton>
                {showTimerDebugPresets && (
                  <TimerControlButton
                    callback={() => setTotal(10)}
                    title={t('timer.setTime', { minutes: 0, seconds: 10 })}
                  >
                    <span className="text-[10px] font-semibold leading-none">
                      10s
                    </span>
                  </TimerControlButton>
                )}
                <TimerControlButton
                  callback={() => setTotal(resolvedDraftTotal + 60)}
                  title={t('timer.addMinute')}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </TimerControlButton>
              </>
            )}
          </div>
          {!isRunning && (
            <span className="text-muted-foreground text-xs">
              {t('timer.elapsed', {
                minutes: currentMinutesRunning.toString().padStart(2, '0'),
                seconds: currentSecondsRunning.toString().padStart(2, '0'),
              })}
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
      aria-label={title}
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
