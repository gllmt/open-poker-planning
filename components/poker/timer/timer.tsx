'use client';

import { Hourglass } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import type { TimerProps as GameTimerProps } from '@/types/game';

const TimerProgress = dynamic(
  () => import('./timer-progress-popup').then((m) => m.TimerProgress),
  { ssr: false }
);

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
  onTimerComplete,
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
  onTimerUpdate: (timer: GameTimerProps) => Promise<void>;
  onTimerComplete?: () => void;
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

  const commitTimerUpdate = useCallback(
    (update: GameTimerProps) => onTimerUpdate(update),
    [onTimerUpdate]
  );
  const fireAndForgetTimerUpdate = useCallback(
    (update: GameTimerProps) => {
      void onTimerUpdate(update).catch(() => {});
    },
    [onTimerUpdate]
  );

  const legacyMigrationRef = useRef(false);
  const [visibilityStore] = useState(() => createVisibilityStore(timerVisible));
  const localTimerVisible = useSyncExternalStore(
    visibilityStore.subscribe,
    visibilityStore.getSnapshot,
    visibilityStore.getSnapshot
  );

  useEffect(() => {
    visibilityStore.setServerValue(timerVisible);
  }, [timerVisible, visibilityStore]);

  useEffect(() => {
    if (startedAt !== undefined || pausedAt !== undefined) return;
    if (typeof currentSeconds !== 'number') return;
    if (legacyMigrationRef.current) return;
    legacyMigrationRef.current = true;

    if (timerPaused === false) {
      const legacyStartedAt = Date.now() - currentSeconds * 1000;
      fireAndForgetTimerUpdate({
        startedAt: legacyStartedAt,
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
    totalSeconds,
    soundOn,
    timerVisible,
    fireAndForgetTimerUpdate,
  ]);

  const normalizedStartedAt = startedAt ?? null;
  const normalizedPausedAt =
    pausedAt ?? (typeof currentSeconds === 'number' ? currentSeconds : null);

  const onTimerOpen = useCallback(async () => {
    visibilityStore.setOverride(true);
    try {
      await commitTimerUpdate({
        startedAt: null,
        pausedAt: 0,
        totalSeconds: 300,
        soundOn: true,
        timerVisible: true,
      });
    } catch {
      visibilityStore.setOverride(null);
    }
  }, [commitTimerUpdate, visibilityStore]);

  const onTimerClose = useCallback(async () => {
    visibilityStore.setOverride(false);
    try {
      await commitTimerUpdate({
        startedAt: null,
        pausedAt: 0,
        totalSeconds: 300,
        soundOn: true,
        timerVisible: false,
      });
    } catch {
      visibilityStore.setOverride(null);
    }
  }, [commitTimerUpdate, visibilityStore]);

  if (!localTimerVisible) {
    if (!isMod) return null;
    return (
      <div className="glass-inner dark:dark-glass-inner text-card-foreground flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Hourglass className="size-4" aria-hidden="true" />
          <span>{t('timer.disabled')}</span>
        </div>
        <Button
          onClick={onTimerOpen}
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
      onTimerClose={onTimerClose}
      isMod={isMod}
      onTimerStateUpdate={(update) =>
        fireAndForgetTimerUpdate({
          ...update,
          timerVisible: localTimerVisible,
        })
      }
      soundOn={soundOn}
      onTimerComplete={onTimerComplete}
    />
  );
}
