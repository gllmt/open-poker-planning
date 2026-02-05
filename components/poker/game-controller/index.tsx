'use client';

import {
  CircleCheckBig,
  CircleDot,
  Eye,
  Hourglass,
  LogOut,
  RefreshCcw,
  Share,
  Trash,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  onDeleteGame,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  confettiSeed?: string | null;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => Promise<void>;
  onAutoReveal: (value: boolean) => Promise<void>;
  onDeleteGame: () => Promise<void>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const baseAutoReveal = game.autoReveal ?? false;
  const [autoRevealValue, setAutoRevealValue] = useState(baseAutoReveal);
  const [autoRevealPending, setAutoRevealPending] = useState(false);
  const [autoRevealPendingSync, setAutoRevealPendingSync] = useState(false);

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
  const leaveGame = () => router.push(withLocale('/', locale));

  const handleRemoveGame = async () => {
    const confirm = window.confirm(t('game.confirmDelete'));
    if (!confirm) return;
    await onDeleteGame();
    router.push(withLocale('/', locale));
  };

  const timerProps = { isMod, ...(game.timerProps ?? {}) };

  return (
    <div className="flex flex-col items-center w-full md:w-[450px]">
      <Card className="w-full max-w-xl my-5 gap-0 py-0">
        <CardHeader className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <CardTitle className="text-lg font-semibold truncate grow">
            {game.name}
          </CardTitle>
          <span className="text-sm font-medium">
            {getStatusLabel(game.gameStatus, t)}{' '}
            {getGameStatusIcon(game.gameStatus)}
          </span>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          <div className="pb-3">
            <Timer
              timerProps={timerProps}
              onTimerUpdate={onTimerUpdate}
              onTimerComplete={handleTimerComplete}
            />
          </div>
          {isMod && (
            <div
              className="flex justify-end pb-3"
              title={t('game.autoRevealHint')}
            >
              <AutoRevealToggle
                autoReveal={autoRevealValue}
                disabled={autoRevealPending}
                onAutoReveal={handleAutoReveal}
              />
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-6 pb-2">
            {isMod && (
              <>
                <ControllerButton
                  onClick={onReveal}
                  label={t('game.reveal')}
                  variant="secondary"
                >
                  <Eye className="size-5" aria-hidden="true" />
                </ControllerButton>
                <ControllerButton
                  onClick={onReset}
                  label={t('game.restart')}
                  variant="outline"
                >
                  <RefreshCcw className="size-5" aria-hidden="true" />
                </ControllerButton>
                <ControllerButton
                  onClick={handleRemoveGame}
                  label={t('game.delete')}
                  variant="destructive"
                >
                  <Trash className="size-5" aria-hidden="true" />
                </ControllerButton>
              </>
            )}

            <ControllerButton
              onClick={leaveGame}
              label={t('game.exit')}
              variant="outline"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </ControllerButton>
            <ControllerButton
              onClick={copyInviteLink}
              label={t('game.invite')}
              variant="secondary"
            >
              <Share className="size-5" aria-hidden="true" />
            </ControllerButton>

            {/* TODO: Add story editor for new feature with story history soon! */}
            {/* <StoryEditor
              gameId={game.id}
              playerId={currentPlayerId}
              storyName={game.storyName ?? ''}
            /> */}
          </div>
          <ResultsSection
            game={game}
            players={players}
            averageLabel={averageLabel}
            showAverage={canShowAverage}
          />
        </CardContent>
      </Card>

      {showCopiedMessage && (
        <div className="fixed top-6 right-6 z-50">
          <div
            className="bg-card border-border text-card-foreground shadow-lg px-4 py-3 text-xs rounded-xl ring-1 ring-foreground/10"
            role="alert"
          >
            <span className="block font-semibold">
              {t('game.inviteCopied')}
            </span>
          </div>
        </div>
      )}
      {confettiSeed ? (
        <ConfettiOverlay key={confettiSeed} seed={confettiSeed} />
      ) : null}
    </div>
  );
}

function ControllerButton({
  onClick,
  label,
  variant = 'outline',
  children,
}: {
  onClick: () => void;
  label: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <Button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="rounded-full"
        title={label}
        size="icon"
        variant={variant}
      >
        <span className="text-2xl">{children}</span>
      </Button>
      <span className="text-muted-foreground text-xs mt-1">{label}</span>
    </div>
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

function getStatusLabel(status: Status, t: (key: string) => string) {
  const statusKeyMap: Record<Status, string> = {
    [Status.NotStarted]: 'game.status.notStarted',
    [Status.Started]: 'game.status.started',
    [Status.InProgress]: 'game.status.inProgress',
    [Status.Finished]: 'game.status.finished',
  };

  return t(statusKeyMap[status] ?? status);
}
