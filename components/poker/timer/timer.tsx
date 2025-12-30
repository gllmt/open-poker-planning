'use client';

import { Hourglass } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/button';
import type { TimerProps as GameTimerProps } from '@/types/game';

import { TimerProgress } from './timer-progress-popup';

type VisibilityStore = {
  getSnapshot: () => boolean;
  subscribe: (listener: () => void) => () => void;
  setOverride: (value: boolean | null) => void;
  setServerValue: (value: boolean) => void;
};

function createVisibilityStore(initialValue: boolean): VisibilityStore {
  let override: boolean | null = null;
  let serverValue = initialValue;
  const listeners = new Set<() => void>();

  const getSnapshot = () => override ?? serverValue;
  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const setOverride = (value: boolean | null) => {
    const prevSnapshot = getSnapshot();
    override = value;
    if (override !== null && override === serverValue) {
      override = null;
    }
    if (getSnapshot() !== prevSnapshot) notify();
  };

  const setServerValue = (value: boolean) => {
    const prevSnapshot = getSnapshot();
    serverValue = value;
    if (override !== null && override === serverValue) {
      override = null;
    }
    if (getSnapshot() !== prevSnapshot) notify();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { getSnapshot, subscribe, setOverride, setServerValue };
}

export function Timer({
  timerProps,
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
  onTimerUpdate: (timer: GameTimerProps) => void;
}) {
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

  const onTimerStateUpdate = useCallback(
    (update: GameTimerProps) => onTimerUpdate(update),
    [onTimerUpdate]
  );

  const legacyMigrationRef = useRef(false);
  const visibilityStore = useMemo(
    () => createVisibilityStore(timerVisible),
    [timerVisible]
  );
  const localTimerVisible = useSyncExternalStore(
    visibilityStore.subscribe,
    visibilityStore.getSnapshot,
    visibilityStore.getSnapshot
  );

  useEffect(() => {
    if (startedAt !== undefined || pausedAt !== undefined) return;
    if (typeof currentSeconds !== 'number') return;
    if (legacyMigrationRef.current) return;
    legacyMigrationRef.current = true;

    if (timerPaused === false) {
      const legacyStartedAt = Date.now() - currentSeconds * 1000;
      onTimerStateUpdate({
        startedAt: legacyStartedAt,
        pausedAt: null,
        totalSeconds,
        soundOn,
        timerVisible,
      });
      return;
    }

    onTimerStateUpdate({
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
    totalSeconds,
    soundOn,
    timerVisible,
    onTimerStateUpdate,
  ]);

  const normalizedStartedAt = startedAt ?? null;
  const normalizedPausedAt =
    pausedAt ?? (typeof currentSeconds === 'number' ? currentSeconds : null);

  const onTimerOpen = useCallback(() => {
    visibilityStore.setOverride(true);
    onTimerStateUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds: 300,
      soundOn: true,
      timerVisible: true,
    });
  }, [onTimerStateUpdate, visibilityStore]);

  const onTimerClose = useCallback(() => {
    visibilityStore.setOverride(false);
    onTimerStateUpdate({
      startedAt: null,
      pausedAt: 0,
      totalSeconds: 300,
      soundOn: true,
      timerVisible: false,
    });
  }, [onTimerStateUpdate, visibilityStore]);

  return (
    <>
      {isMod && (
        <Button
          onClick={onTimerOpen}
          title="Timer"
          aria-label="Timer"
          type="button"
          size="icon"
          variant="ghost"
        >
          <span
            className={`${localTimerVisible ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Hourglass className="size-5" aria-hidden="true" />
          </span>
        </Button>
      )}

      {localTimerVisible && (
        <TimerProgress
          startedAt={normalizedStartedAt}
          pausedAt={normalizedPausedAt}
          totalSeconds={totalSeconds}
          onTimerClose={onTimerClose}
          isMod={isMod}
          onTimerStateUpdate={(update) =>
            onTimerStateUpdate({ ...update, timerVisible: localTimerVisible })
          }
          soundOn={soundOn}
        />
      )}
    </>
  );
}
