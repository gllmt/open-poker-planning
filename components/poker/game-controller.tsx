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

  return (
    <div className="flex flex-col items-center w-full">
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
