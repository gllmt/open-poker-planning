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
import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import { createInvite } from '@/lib/api/games';
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
  isAdmin,
  confettiSeed,
  onReveal,
  onReset,
  onTimerUpdate,
  onAutoReveal,
  onDeleteGame,
  onLeaveGame,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  isAdmin: boolean;
  confettiSeed?: string | null;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => Promise<void>;
  onAutoReveal: (value: boolean) => Promise<void>;
  onDeleteGame: () => Promise<void>;
  onLeaveGame: () => Promise<void>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const baseAutoReveal = game.autoReveal ?? false;
  const [autoRevealValue, setAutoRevealValue] = useState(baseAutoReveal);
  const [autoRevealPending, setAutoRevealPending] = useState(false);
  const [autoRevealPendingSync, setAutoRevealPendingSync] = useState(false);

  const isMod = isModerator(
    game.createdById,
    currentPlayerId,
    game.isAllowMembersToManageSession
  );

  const averageValue = useGameAverage(game, players);
  const canShowAverage = averageValue !== null;
  const averageLabel =
    game.gameStatus === Status.Finished && averageValue !== null
      ? averageValue.toFixed(2)
      : '-';

  // Reuse the invite link across clicks instead of minting a new invite each
  // time, so repeated copies don't burn the per-game invite quota.
  const inviteLinkRef = useRef<string | null>(null);
  const playerIdsRef = useRef<Set<string>>(new Set());

  // A disappearing player can make existing invite links stale, so drop the
  // cached link whenever the player list loses an entry.
  useEffect(() => {
    const nextIds = new Set(players.map((player) => player.id));
    for (const id of playerIdsRef.current) {
      if (!nextIds.has(id)) {
        inviteLinkRef.current = null;
        break;
      }
    }
    playerIdsRef.current = nextIds;
  }, [players]);

  const copyInviteLink = async () => {
    let inviteLink = inviteLinkRef.current ?? '';

    if (!inviteLink) {
      try {
        const { token } = await createInvite(game.id, currentPlayerId);
        inviteLink = `${window.location.origin}${withLocale(
          `/join/${game.id}`,
          locale
        )}?token=${token}`;
        inviteLinkRef.current = inviteLink;
      } catch {
        sileo.info({
          title: t('game.inviteNoToken'),
          position: 'top-center',
        });
        return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        sileo.action({
          title: t('game.inviteCopied'),
          duration: 8000,
          button: {
            title: t('game.openInvite'),
            onClick: () => window.open(inviteLink, '_blank', 'noreferrer'),
          },
          position: 'top-center',
        });
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
        sileo.action({
          title: t('game.inviteCopied'),
          duration: 8000,
          button: {
            title: t('game.openInvite'),
            onClick: () => window.open(inviteLink, '_blank', 'noreferrer'),
          },
          position: 'top-center',
        });
        return;
      }
    } catch {}

    sileo.action({
      title: t('game.invitePrompt'),
      duration: 10000,
      button: {
        title: t('game.openInvite'),
        onClick: () => window.open(inviteLink, '_blank', 'noreferrer'),
      },
      position: 'top-center',
    });
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
  const leaveGame = () => {
    void onLeaveGame().catch(() => {
      sileo.info({
        title: t('game.leaveFailed'),
        position: 'top-center',
      });
    });
  };

  const handleRemoveGame = async () => {
    const confirm = window.confirm(t('game.confirmDelete'));
    if (!confirm) return;
    await onDeleteGame();
    router.push(withLocale('/', locale));
  };

  const timerProps = { isMod, ...(game.timerProps ?? {}) };

  return (
    <div className="flex w-full flex-col items-center lg:w-[450px]">
      <div className="w-full max-w-xl my-5 glass-card dark:dark-glass-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-5 py-3.5">
          <h2 className="text-lg font-semibold truncate grow">{game.name}</h2>
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            {getStatusLabel(game.gameStatus, t)}{' '}
            {getGameStatusIcon(game.gameStatus)}
          </span>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 pt-4">
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

          <div className="flex flex-wrap justify-center gap-5 pb-2">
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
              </>
            )}
            {isAdmin && (
              <ControllerButton
                onClick={handleRemoveGame}
                label={t('game.delete')}
                variant="destructive"
              >
                <Trash className="size-5" aria-hidden="true" />
              </ControllerButton>
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
          </div>
          <ResultsSection
            game={game}
            players={players}
            averageLabel={averageLabel}
            showAverage={canShowAverage}
          />
        </div>
      </div>
      {confettiSeed ? <ConfettiOverlay key={confettiSeed} /> : null}
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
    <div className="flex flex-col items-center gap-1.5">
      <Button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="rounded-xl hover:shadow-md active:scale-[0.95] transition-all duration-150"
        title={label}
        size="icon"
        variant={variant}
      >
        <span className="text-2xl">{children}</span>
      </Button>
      <span className="text-muted-foreground text-xs">{label}</span>
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
