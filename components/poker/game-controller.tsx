'use client';

import {
  CircleCheckBig,
  CircleDot,
  CircleQuestionMark,
  Coffee,
  Eye,
  Hourglass,
  LogOut,
  RefreshCcw,
  Share,
  Trash,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  deleteGame,
  reset,
  reveal,
  setAutoReveal,
  updateStory,
  updateTimer,
} from '@/lib/api/games';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { isModerator } from '@/lib/is-moderator';
import { type Game, GameType, type TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards, normalizeLegacyCards } from './card-configs';
import { Timer } from './timer/timer';

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

  const serverStoryName = game.storyName ?? '';
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyEditInitialRef = useRef<string>(serverStoryName);

  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState(serverStoryName);
  const [storySaving, setStorySaving] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyPendingSync, setStoryPendingSync] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storyIsDirty =
    isEditingStory && storyDraft.trim() !== storyEditInitialRef.current.trim();

  useEffect(() => {
    if (isEditingStory) return;

    // If we just saved locally, keep the optimistic value until the refreshed game state catches up.
    if (storyPendingSync) {
      if (serverStoryName === storyDraft) setStoryPendingSync(false);
      return;
    }

    if (serverStoryName !== storyDraft) setStoryDraft(serverStoryName);
  }, [serverStoryName, storyDraft, isEditingStory, storyPendingSync]);

  useEffect(() => {
    if (!isEditingStory) return;
    storyInputRef.current?.focus();
    storyInputRef.current?.select();
  }, [isEditingStory]);

  const startStoryEdit = () => {
    storyEditInitialRef.current = storyDraft;
    setStoryError(null);
    setIsEditingStory(true);
  };

  const cancelStoryEdit = () => {
    setStoryDraft(storyEditInitialRef.current);
    setStoryError(null);
    setIsEditingStory(false);
  };

  const saveStoryEdit = async () => {
    if (storySaving) return;

    const nextValue = storyDraft.trim();
    if (nextValue === storyEditInitialRef.current.trim()) {
      setStoryError(null);
      setIsEditingStory(false);
      return;
    }

    setStorySaving(true);
    setStoryError(null);
    try {
      await updateStory(game.id, nextValue, currentPlayerId);
      setStoryDraft(nextValue);
      storyEditInitialRef.current = nextValue;
      setStoryPendingSync(true);
      setIsEditingStory(false);
    } catch (e) {
      setStoryError(e instanceof Error ? e.message : 'Failed to update story');
    } finally {
      setStorySaving(false);
    }
  };

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
  const revealedVotes = useMemo(
    () =>
      players
        .filter(
          (player) =>
            player.status === Status.Finished && player.value !== undefined
        )
        .map((player) => player.value as number),
    [players]
  );
  const isPerfectTie = useMemo(() => {
    if (game.gameStatus !== Status.Finished || revealedVotes.length < 2)
      return false;
    return revealedVotes.every((value) => value === revealedVotes[0]);
  }, [game.gameStatus, revealedVotes]);

  useEffect(() => {
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }

    if (!isPerfectTie) {
      setShowConfetti(false);
      return;
    }

    setShowConfetti(true);
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);

    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
    };
  }, [isPerfectTie]);

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
          <AverageComponent game={game} players={players} />
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
              <AutoReveal
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

            <div className="w-full text-xs mt-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold" htmlFor="storyName">
                  Story Name:
                </label>

                {!isEditingStory ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={startStoryEdit}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelStoryEdit}
                      disabled={storySaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveStoryEdit}
                      disabled={storySaving || !storyIsDirty}
                    >
                      {storySaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
              <Input
                id="storyName"
                ref={storyInputRef}
                placeholder="Enter story name or number"
                className="italic mt-2"
                type="text"
                value={storyDraft}
                readOnly={!isEditingStory}
                aria-readonly={!isEditingStory}
                onChange={(e) => setStoryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (!isEditingStory) return;
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveStoryEdit();
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelStoryEdit();
                  }
                }}
              />
              {storyError && (
                <p className="text-destructive text-xs mt-2">{storyError}</p>
              )}
            </div>
          </div>
          <ResultsSection game={game} players={players} />
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
      <ConfettiOverlay isActive={showConfetti} />
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

function AutoReveal({
  autoReveal,
  onAutoReveal,
}: {
  autoReveal: boolean;
  onAutoReveal: (autoReveal: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <label className="flex items-center cursor-pointer">
        <span className="text-muted-foreground mr-2 text-xs">Auto Reveal</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoReveal}
          onClick={() => onAutoReveal(!autoReveal)}
          className={`bg-muted focus-visible:ring-ring/50 relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            autoReveal ? 'bg-primary' : 'bg-muted'
          }`}
          style={{ minWidth: '2rem' }}
        >
          <span
            className={`bg-background inline-block h-3 w-3 cursor-pointer transform rounded-full shadow transition-transform ${
              autoReveal ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
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

function ResultsSection({ game, players }: { game: Game; players: Player[] }) {
  const isRevealed = game.gameStatus === Status.Finished;
  const cardLookup = useMemo(() => {
    const baseCards = game.cards?.length ? game.cards : getCards(game.gameType);
    const cards = normalizeLegacyCards(game.gameType, baseCards);
    return new Map(cards.map((card) => [card.value, card]));
  }, [game.gameType, game.cards]);

  if (!isRevealed) return null;

  const canShowAverage =
    game.gameType !== GameType.TShirt &&
    game.gameType !== GameType.TShirtAndNumber;
  const averageValue = canShowAverage ? getAverage(game, players) : 0;
  const averageLabel =
    canShowAverage && averageValue ? averageValue.toFixed(2) : '-';

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Results</h3>
        {canShowAverage && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Avg</span>
            <Badge variant="secondary" className="font-semibold">
              {averageLabel}
            </Badge>
          </div>
        )}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Player
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Vote
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {players.map((player) => {
              const hasVoted =
                player.status === Status.Finished && player.value !== undefined;
              const card = hasVoted
                ? cardLookup.get(player.value as number)
                : null;
              const displayValue =
                card?.displayValue ?? player.value?.toString() ?? '';
              const cardColor = card?.color ?? '';
              const voteContent = hasVoted ? (
                player.value === -1 ? (
                  <Coffee className="size-4" aria-hidden="true" />
                ) : player.value === -2 ? (
                  <CircleQuestionMark className="size-4" aria-hidden="true" />
                ) : (
                  displayValue || '-'
                )
              ) : (
                '-'
              );

              return (
                <tr key={player.id} className="bg-background">
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium">{player.name}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                        cardColor && hasVoted
                          ? 'text-slate-900 dark:text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      style={
                        cardColor && hasVoted
                          ? { backgroundColor: cardColor }
                          : undefined
                      }
                      title={displayValue || 'No vote'}
                    >
                      {voteContent}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AverageComponent({
  game,
  players,
}: {
  game: Game;
  players: Player[];
}) {
  const gameType = game.gameType;
  const canShowAverage =
    gameType !== GameType.TShirt && gameType !== GameType.TShirtAndNumber;
  if (!canShowAverage) return null;

  const EMPTY = '-';
  const gameAverage = getAverage(game, players);
  const average =
    game.gameStatus === Status.Finished && gameAverage
      ? gameAverage.toFixed(2)
      : EMPTY;

  return (
    <>
      <Separator orientation="vertical" className="h-6 mx-2" />
      <span className="text-sm font-medium">Avg:</span>
      <Badge variant="secondary" className="font-semibold ml-1">
        {average}
      </Badge>
    </>
  );
}

function getAverage(game: Game, players: Player[]): number {
  let values = 0;
  let count = 0;
  const cards = game.cards || [];

  players.forEach((player) => {
    const value =
      game.gameType === GameType.Custom
        ? Number(
            cards.find((card) => card.value === player.value)?.displayValue
          )
        : player.value;

    if (
      player.status === Status.Finished &&
      value !== undefined &&
      !Number.isNaN(Number(value)) &&
      Number(value) >= 0
    ) {
      values += Number(value);
      count++;
    }
  });

  if (!count) return 0;
  return Math.round((values / count) * 100) / 100;
}

const confettiColors = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#f97316',
  '#ec4899',
  '#22c55e',
  '#a855f7',
  '#14b8a6',
];

function ConfettiOverlay({ isActive }: { isActive: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => {
        const size = 6 + (index % 4) * 2;
        return {
          left: `${(index * 7) % 100}%`,
          delay: `${(index % 9) * 0.12}s`,
          duration: `${3 + (index % 5) * 0.35}s`,
          size,
          height: Math.round(size * 0.6),
          color: confettiColors[index % confettiColors.length] as string,
        };
      }),
    []
  );

  if (!isActive) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {pieces.map((piece, index) => (
        <span
          key={`${piece.left}-${index}`}
          className="confetti-piece"
          style={{
            left: piece.left,
            width: `${piece.size}px`,
            height: `${piece.height}px`,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
      <style jsx>{`
        .confetti-piece {
          position: absolute;
          top: -10%;
          border-radius: 2px;
          opacity: 0.9;
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
          will-change: transform;
        }
        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, -10vh, 0) rotate(0deg);
          }
          100% {
            transform: translate3d(0, 110vh, 0) rotate(720deg);
          }
        }
      `}</style>
    </div>
  );
}
