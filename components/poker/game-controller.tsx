'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { deleteGame, reset, reveal, setAutoReveal, updateStory, updateTimer } from '@/lib/api/games';
import { getPlayerGamesFromCache } from '@/lib/browser-storage';
import { isModerator } from '@/lib/is-moderator';
import { Game, GameType, TimerProps } from '@/types/game';
import { Player } from '@/types/player';
import { Status } from '@/types/status';

import { Timer } from './timer/timer';

export function GameController({ game, players, currentPlayerId }: { game: Game; players: Player[]; currentPlayerId: string }) {
  const router = useRouter();
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  const isMod = isModerator(game.createdById, currentPlayerId, game.isAllowMembersToManageSession);

  const joinToken = useMemo(() => getPlayerGamesFromCache().find((g) => g.id === game.id)?.joinToken, [game.id]);

  const copyInviteLink = async () => {
    if (!joinToken) {
      window.alert('No invite token available on this device. Use the one from the original invite link.');
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

  const onAutoReveal = (value: boolean) => setAutoReveal(game.id, value, currentPlayerId);
  const onUpdatedTimerProps = useCallback(
    (timer: TimerProps) => updateTimer(game.id, timer, currentPlayerId),
    [game.id, currentPlayerId],
  );

  const leaveGame = () => router.push(`/`);

  const handleRemoveGame = async () => {
    const confirm = window.confirm('Are you sure? This will delete this session and remove all players.');
    if (!confirm) return;
    await deleteGame(game.id, currentPlayerId);
    router.push('/');
  };

  const timerProps: {
    isMod?: boolean;
    timerVisible?: boolean;
    timerPaused?: boolean;
    currentSeconds?: number;
    totalSeconds?: number;
    soundOn?: boolean;
  } = { isMod, timerVisible: game.timerProps?.timerVisible };

  if (!isMod) {
    timerProps.isMod = false;
    timerProps.timerVisible = game.timerProps?.timerVisible;
    timerProps.timerPaused = game.timerProps?.timerPaused;
    timerProps.currentSeconds = game.timerProps?.currentSeconds;
    timerProps.totalSeconds = game.timerProps?.totalSeconds;
    timerProps.soundOn = game.timerProps?.soundOn;
  }

  return (
    <div className='flex flex-col items-center w-full px-2'>
      <div className='w-full max-w-md bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg my-5'>
        <div className='flex items-center justify-between px-3 py-2 border-b border-gray-400 dark:border-gray-600'>
          <div className='text-lg font-semibold truncate flex-grow'>{game.name}</div>
          <Timer timerProps={timerProps} onTimerUpdate={onUpdatedTimerProps} />
          <div className='mx-2 h-6 border-l border-gray-400 dark:border-gray-600' />
          <span className='text-sm font-medium'>
            {game.gameStatus} {getGameStatusIcon(game.gameStatus)}
          </span>
          <AverageComponent game={game} players={players} />
        </div>

        {isMod && (
          <div className='flex justify-end p-2' title='Auto Reveal when all members finished voting'>
            <AutoReveal autoReveal={game.autoReveal || false} onAutoReveal={onAutoReveal} />
          </div>
        )}

        <div className='flex flex-wrap justify-center gap-6 px-2 pt-8 pb-2'>
          {isMod && (
            <>
              <ControllerButton onClick={() => reveal(game.id, currentPlayerId)} label='Reveal' className='hover:bg-green-200'>
                👁️
              </ControllerButton>
              <ControllerButton onClick={() => reset(game.id, currentPlayerId)} label='Restart' className='hover:bg-red-200'>
                🔄
              </ControllerButton>
              <ControllerButton onClick={handleRemoveGame} label='Delete' className='hover:bg-red-200'>
                🗑️
              </ControllerButton>
            </>
          )}

          <ControllerButton onClick={leaveGame} label='Exit' className='hover:bg-gray-200'>
            🚪
          </ControllerButton>
          <ControllerButton onClick={copyInviteLink} label='Invite' className='hover:bg-blue-200'>
            🔗
          </ControllerButton>

          <div className='w-full text-xs mt-2'>
            <label className='font-semibold'>Story Name:</label>
            <input
              placeholder='Enter story name or number'
              className='w-full italic p-2 mt-2 border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400'
              type='text'
              value={game.storyName || ''}
              onChange={(e) => updateStory(game.id, e.target.value || '', currentPlayerId)}
            />
          </div>
        </div>
      </div>

      {showCopiedMessage && (
        <div className='fixed top-6 right-6 z-50'>
          <div className='bg-green-100 border border-green-200 text-gray-800 opacity-85 px-4 py-3 text-xs rounded shadow' role='alert'>
            <span className='block font-bold'>Invite link copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ControllerButton({
  onClick,
  label,
  className,
  children,
}: {
  onClick: () => void;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center'>
      <button
        type='button'
        aria-label={label}
        onClick={onClick}
        className={`p-2 cursor-pointer rounded-full bg-white dark:bg-gray-900 ${className} transition`}
        title={label}
      >
        <span className='text-2xl'>{children}</span>
      </button>
      <span className='text-xs mt-1'>{label}</span>
    </div>
  );
}

function AutoReveal({ autoReveal, onAutoReveal }: { autoReveal: boolean; onAutoReveal: (autoReveal: boolean) => void }) {
  return (
    <div className='flex flex-col items-center'>
      <label className='flex items-center cursor-pointer'>
        <span className='mr-2 text-xs'>Auto Reveal</span>
        <button
          type='button'
          role='switch'
          aria-checked={autoReveal}
          onClick={() => onAutoReveal(!autoReveal)}
          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
            autoReveal ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          style={{ minWidth: '2rem' }}
        >
          <span
            className={`inline-block h-3 w-3 cursor-pointer transform rounded-full bg-white shadow transition-transform ${
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
      return '⏱️';
    case 'Finished':
      return '🎉';
    default:
      return '🚀';
  }
}

function AverageComponent({ game, players }: { game: Game; players: Player[] }) {
  const gameType = game.gameType;
  const canShowAverage = gameType !== GameType.TShirt && gameType !== GameType.TShirtAndNumber;
  if (!canShowAverage) return null;

  const EMPTY = '-';
  const gameAverage = getAverage(game, players);
  const average = game.gameStatus === Status.Finished && gameAverage ? gameAverage.toFixed(2) : EMPTY;

  return (
    <>
      <div className='mx-2 h-6 border-l border-gray-400 dark:border-gray-600' />
      <span className='text-sm font-medium'>Avg:</span>
      <span className='px-2 py-1 ml-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 font-bold shadow-sm border border-gray-200 inline-flex items-center'>
        {average}
      </span>
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
        ? Number(cards.find((card) => card.value === player.value)?.displayValue)
        : player.value;

    if (player.status === Status.Finished && value !== undefined && !isNaN(Number(value)) && Number(value) >= 0) {
      values += Number(value);
      count++;
    }
  });

  if (!count) return 0;
  return Math.round((values / count) * 100) / 100;
}
