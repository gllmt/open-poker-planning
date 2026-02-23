'use client';

import {
  Check,
  CircleCheckBig,
  CircleDot,
  Eye,
  Hourglass,
  LogOut,
  Play,
  RefreshCcw,
  Share,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
import { isModerator } from '@/lib/is-moderator';
import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { useGameAverage } from '../hooks/use-game-average';
import { ResultsSection } from '../results/results-section';
import { Timer } from '../timer/timer';
import { AutoRevealToggle } from './auto-reveal-toggle';

const ConfettiOverlay = dynamic(
  () => import('../results/confetti-overlay').then((m) => m.ConfettiOverlay),
  { ssr: false }
);

export function GameController({
  game,
  players,
  currentPlayerId,
  confettiSeed,
  onReveal,
  onReset,
  onTimerUpdate,
  onAutoReveal,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  confettiSeed?: string | null;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => Promise<void>;
  onAutoReveal: (value: boolean) => Promise<void>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const baseAutoReveal = game.autoReveal ?? false;
  const [autoRevealValue, setAutoRevealValue] = useState(baseAutoReveal);
  const [autoRevealPending, setAutoRevealPending] = useState(false);
  const [autoRevealPendingSync, setAutoRevealPendingSync] = useState(false);
  const [roundStartedUi, setRoundStartedUi] = useState(false);

  const isMod = isModerator(
    game.createdById,
    currentPlayerId,
    game.isAllowMembersToManageSession
  );

  const joinToken = useMemo(
    () => getPlayerGamesFromCache().find((g) => g.id === game.id)?.joinToken,
    [game.id]
  );

  const averageValue = useGameAverage(game, players);
  const canShowAverage = averageValue !== null;
  const averageLabel =
    game.gameStatus === Status.Finished && averageValue
      ? averageValue.toFixed(2)
      : '-';

  const votedCount = useMemo(
    () => players.filter((player) => player.status === Status.Finished).length,
    [players]
  );
  const totalPlayers = players.length;
  const votesProgressLabel = t('game.votesProgress', {
    voted: votedCount,
    total: totalPlayers,
  });

  const copyInviteLink = async () => {
    if (!joinToken) {
      window.alert(t('game.inviteNoToken'));
      return;
    }

    const inviteLink = `${window.location.origin}${withLocale(
      `/join/${game.id}`,
      locale
    )}?token=${joinToken}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 5000);
        return;
      }
    } catch {}

    try {
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (ok) {
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 5000);
        return;
      }
    } catch {}

    window.prompt(t('game.invitePrompt'), inviteLink);
  };

  const handleAutoReveal = useCallback(
    async (value: boolean) => {
      if (autoRevealPending) return;
      setAutoRevealValue(value);
      setAutoRevealPending(true);
      try {
        await onAutoReveal(value);
        setAutoRevealPendingSync(true);
      } catch {
        setAutoRevealValue(baseAutoReveal);
        setAutoRevealPendingSync(false);
      } finally {
        setAutoRevealPending(false);
      }
    },
    [autoRevealPending, baseAutoReveal, onAutoReveal]
  );

  const handleTimerComplete = useCallback(() => {
    if (autoRevealValue) return;
    onReveal();
  }, [autoRevealValue, onReveal]);

  useEffect(() => {
    if (autoRevealPending) return;
    if (autoRevealPendingSync) {
      if (baseAutoReveal === autoRevealValue) {
        setAutoRevealPendingSync(false);
      }
      return;
    }
    if (baseAutoReveal !== autoRevealValue) {
      setAutoRevealValue(baseAutoReveal);
    }
  }, [
    autoRevealPending,
    autoRevealPendingSync,
    autoRevealValue,
    baseAutoReveal,
  ]);

  useEffect(() => {
    if (game.gameStatus === Status.NotStarted) {
      setRoundStartedUi(false);
      return;
    }
    if (game.gameStatus === Status.InProgress) {
      setRoundStartedUi(true);
      return;
    }
    if (game.gameStatus === Status.Finished) {
      return;
    }
    if (game.gameStatus === Status.Started && votedCount > 0) {
      setRoundStartedUi(true);
    }
  }, [game.gameStatus, votedCount]);

  const leaveGame = () => router.push(withLocale('/', locale));

  const timerProps = { isMod, ...(game.timerProps ?? {}) };
  const isFinished = game.gameStatus === Status.Finished;
  const roundReadyToReveal =
    game.gameStatus === Status.InProgress || roundStartedUi;
  const primaryActionLabel = isFinished
    ? t('game.restartRound')
    : roundReadyToReveal
      ? t('game.revealCards')
      : t('game.startRound');
  const handlePrimaryAction = () => {
    if (isFinished) {
      setRoundStartedUi(false);
      onReset();
      return;
    }
    if (roundReadyToReveal) {
      onReveal();
      return;
    }
    setRoundStartedUi(true);
    onReset();
  };

  return (
    <section className="flex h-fit flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <h1
            className="truncate text-lg font-semibold md:text-xl"
            title={game.name}
          >
            {game.name}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
              game.gameStatus
            )}`}
          >
            {getGameStatusIcon(game.gameStatus)}
            {getStatusLabel(game.gameStatus, t)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={copyInviteLink}
            variant="secondary"
            className="rounded-xl"
          >
            <Share className="size-4" aria-hidden="true" />
            {t('game.invite')}
          </Button>
          <Button
            type="button"
            onClick={leaveGame}
            variant="outline"
            className="rounded-xl text-destructive hover:text-destructive"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {t('game.exit')}
          </Button>
        </div>
      </header>

      <div className="overflow-y-auto bg-muted/20 px-5 py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Timer
            timerProps={timerProps}
            onTimerUpdate={onTimerUpdate}
            onTimerComplete={handleTimerComplete}
          />

          {isMod ? (
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handlePrimaryAction}
                className={`h-14 w-full rounded-4xl text-base font-semibold shadow-sm ${
                  roundReadyToReveal
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : ''
                }`}
              >
                {isFinished ? (
                  <RefreshCcw className="size-5" aria-hidden="true" />
                ) : roundReadyToReveal ? (
                  <Eye className="size-5" aria-hidden="true" />
                ) : (
                  <Play className="size-5" aria-hidden="true" />
                )}
                <span>{primaryActionLabel}</span>
                {roundReadyToReveal && !isFinished && (
                  <span className="rounded-md bg-emerald-800/80 px-2 py-0.5 text-xs font-medium">
                    {votesProgressLabel}
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-end px-1">
                <AutoRevealToggle
                  autoReveal={autoRevealValue}
                  disabled={autoRevealPending}
                  onAutoReveal={handleAutoReveal}
                />
              </div>
            </div>
          ) : roundReadyToReveal && !isFinished ? (
            <div className="text-muted-foreground rounded-4xl border border-border/70 bg-background/60 px-4 py-4 text-center text-sm">
              {t('game.waitingVotes', {
                voted: votedCount,
                total: totalPlayers,
              })}
            </div>
          ) : null}

          <ResultsSection
            game={game}
            players={players}
            averageLabel={averageLabel}
            showAverage={canShowAverage}
          />
        </div>
      </div>

      {showCopiedMessage && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed right-4 top-20 z-50"
        >
          <output className="bg-card text-card-foreground ring-foreground/10 inline-flex items-center gap-2 rounded-4xl px-4 py-3 text-xs shadow-lg ring-1">
            <Check className="text-primary size-4" aria-hidden="true" />
            <span className="font-medium">{t('game.inviteCopied')}</span>
          </output>
        </div>
      )}
      {confettiSeed ? (
        <ConfettiOverlay key={confettiSeed} seed={confettiSeed} />
      ) : null}
    </section>
  );
}

function getGameStatusIcon(gameStatus: string) {
  switch (gameStatus) {
    case 'In Progress':
      return <Hourglass className="inline-block size-4" aria-hidden="true" />;
    case 'Finished':
      return (
        <CircleCheckBig className="inline-block size-4" aria-hidden="true" />
      );
    default:
      return <CircleDot className="inline-block size-4" aria-hidden="true" />;
  }
}

function getStatusBadgeClass(status: Status) {
  switch (status) {
    case Status.InProgress:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case Status.Finished:
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getStatusLabel(status: Status, t: (key: string) => string) {
  const statusKeyMap: Record<Status, string> = {
    [Status.NotStarted]: 'game.status.notStarted',
    [Status.Started]: 'game.status.started',
    [Status.InProgress]: 'game.status.inProgress',
    [Status.Finished]: 'game.status.finished',
  };

  return t(statusKeyMap[status] ?? status);
}
