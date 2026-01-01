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
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteGame,
  reset,
  reveal,
  setAutoReveal,
  updateTimer,
} from '@/lib/api/games';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { isModerator } from '@/lib/is-moderator';
import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { useConfetti } from '../hooks/use-confetti';
import { useGameAverage } from '../hooks/use-game-average';
import { ConfettiOverlay } from '../results/confetti-overlay';
import { ResultsSection } from '../results/results-section';
import { Timer } from '../timer/timer';
import { AutoRevealToggle } from './auto-reveal-toggle';
import { AverageBadge } from './average-badge';
import { StoryEditor } from './story-editor';

export function GameController({
  game,
  players,
  currentPlayerId,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
}) {
  const router = useRouter();
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  const isMod = isModerator(
    game.createdById,
    currentPlayerId,
    game.isAllowMembersToManageSession
  );

  const joinToken = useMemo(
    () => getPlayerGamesFromCache().find((g) => g.id === game.id)?.joinToken,
    [game.id]
  );

  const showConfetti = useConfetti(game, players);
  const confettiSeed = useMemo(
    () => `${game.id}-${game.updatedAt ?? ''}-${game.gameStatus}`,
    [game.id, game.updatedAt, game.gameStatus]
  );
  const averageValue = useGameAverage(game, players);
  const canShowAverage = averageValue !== null;
  const averageLabel =
    game.gameStatus === Status.Finished && averageValue
      ? averageValue.toFixed(2)
      : '-';

  const copyInviteLink = async () => {
    if (!joinToken) {
      window.alert(
        'No invite token available on this device. Use the one from the original invite link.'
      );
      return;
    }

    const inviteLink = `${window.location.origin}/join/${game.id}?token=${joinToken}`;

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

    window.prompt('Copy this invite link:', inviteLink);
  };

  const onAutoReveal = (value: boolean) =>
    setAutoReveal(game.id, value, currentPlayerId);
  const onUpdatedTimerProps = useCallback(
    (timer: TimerProps) => updateTimer(game.id, timer, currentPlayerId),
    [game.id, currentPlayerId]
  );

  const leaveGame = () => router.push('/');

  const handleRemoveGame = async () => {
    const confirm = window.confirm(
      'Are you sure? This will delete this session and remove all players.'
    );
    if (!confirm) return;
    await deleteGame(game.id, currentPlayerId);
    router.push('/');
  };

  const timerProps = { isMod, ...(game.timerProps ?? {}) };

  return (
    <div className="flex flex-col items-center w-full md:w-auto">
      <Card className="w-full max-w-xl my-5 gap-0 py-0">
        <CardHeader className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <CardTitle className="text-lg font-semibold truncate grow">
            {game.name}
          </CardTitle>
          <span className="text-sm font-medium">
            {game.gameStatus} {getGameStatusIcon(game.gameStatus)}
          </span>
          <AverageBadge label={averageLabel} isVisible={canShowAverage} />
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          <div className="pb-3">
            <Timer
              timerProps={timerProps}
              onTimerUpdate={onUpdatedTimerProps}
            />
          </div>
          {isMod && (
            <div
              className="flex justify-end pb-3"
              title="Auto Reveal when all members finished voting"
            >
              <AutoRevealToggle
                autoReveal={game.autoReveal || false}
                onAutoReveal={onAutoReveal}
              />
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-6 pb-2">
            {isMod && (
              <>
                <ControllerButton
                  onClick={() => reveal(game.id, currentPlayerId)}
                  label="Reveal"
                  variant="secondary"
                >
                  <Eye className="size-5" aria-hidden="true" />
                </ControllerButton>
                <ControllerButton
                  onClick={() => reset(game.id, currentPlayerId)}
                  label="Restart"
                  variant="outline"
                >
                  <RefreshCcw className="size-5" aria-hidden="true" />
                </ControllerButton>
                <ControllerButton
                  onClick={handleRemoveGame}
                  label="Delete"
                  variant="destructive"
                >
                  <Trash className="size-5" aria-hidden="true" />
                </ControllerButton>
              </>
            )}

            <ControllerButton
              onClick={leaveGame}
              label="Exit"
              variant="outline"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </ControllerButton>
            <ControllerButton
              onClick={copyInviteLink}
              label="Invite"
              variant="secondary"
            >
              <Share className="size-5" aria-hidden="true" />
            </ControllerButton>

            <StoryEditor
              gameId={game.id}
              playerId={currentPlayerId}
              storyName={game.storyName ?? ''}
            />
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
              Invite link copied to clipboard!
            </span>
          </div>
        </div>
      )}
      <ConfettiOverlay isActive={showConfetti} seed={confettiSeed} />
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
