import type {
  AutoRevealBroadcastPayload,
  GameStatusBroadcastPayload,
  PlayerJoinedBroadcastPayload,
  PlayerRemovedBroadcastPayload,
  StoryUpdatedBroadcastPayload,
  TimerBroadcastPayload,
  VoteBroadcastPayload,
} from '@/types/broadcast';
import { Status } from '@/types/status';

const isStatusValue = (value: unknown): value is Status =>
  value === Status.NotStarted ||
  value === Status.Started ||
  value === Status.InProgress ||
  value === Status.Finished;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTimerPropsValue = (value: unknown) =>
  value === undefined || value === null || typeof value === 'object';

export const isVoteBroadcastPayload = (
  payload: unknown
): payload is VoteBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'vote') return false;

  const player = (payload as { player?: unknown }).player;
  if (!isRecord(player)) return false;
  const playerId = (player as { id?: unknown }).id;
  const status = (player as { status?: unknown }).status;
  if (typeof playerId !== 'string' || !isStatusValue(status)) return false;

  const value = (player as { value?: unknown }).value;
  if (value !== undefined && typeof value !== 'number') return false;
  const emoji = (player as { emoji?: unknown }).emoji;
  if (emoji !== undefined && typeof emoji !== 'string') return false;

  const game = (payload as { game?: unknown }).game;
  if (game !== undefined) {
    if (!isRecord(game)) return false;
    const gameStatus = (game as { gameStatus?: unknown }).gameStatus;
    if (gameStatus !== undefined && !isStatusValue(gameStatus)) return false;
    const timerProps = (game as { timerProps?: unknown }).timerProps;
    if (!isTimerPropsValue(timerProps)) return false;
  }

  return true;
};

export const isTimerBroadcastPayload = (
  payload: unknown
): payload is TimerBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'timer_updated') return false;
  const game = (payload as { game?: unknown }).game;
  if (game === undefined) return true;
  if (!isRecord(game)) return false;
  const timerProps = (game as { timerProps?: unknown }).timerProps;
  return isTimerPropsValue(timerProps);
};

export const isAutoRevealBroadcastPayload = (
  payload: unknown
): payload is AutoRevealBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'auto_reveal_updated') return false;
  const game = (payload as { game?: unknown }).game;
  if (game === undefined) return true;
  if (!isRecord(game)) return false;
  const autoReveal = (game as { autoReveal?: unknown }).autoReveal;
  return typeof autoReveal === 'boolean';
};

export const isGameStatusBroadcastPayload = (
  payload: unknown
): payload is GameStatusBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'revealed' && payload.type !== 'reset') return false;
  const game = (payload as { game?: unknown }).game;
  if (game === undefined) return true;
  if (!isRecord(game)) return false;
  const gameStatus = (game as { gameStatus?: unknown }).gameStatus;
  if (gameStatus !== undefined && !isStatusValue(gameStatus)) return false;
  const timerProps = (game as { timerProps?: unknown }).timerProps;
  if (!isTimerPropsValue(timerProps)) return false;
  return true;
};

export const isPlayerJoinedBroadcastPayload = (
  payload: unknown
): payload is PlayerJoinedBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'player_joined') return false;
  const player = (payload as { player?: unknown }).player;
  if (!isRecord(player)) return false;
  const playerId = (player as { id?: unknown }).id;
  const name = (player as { name?: unknown }).name;
  const status = (player as { status?: unknown }).status;
  if (typeof playerId !== 'string' || typeof name !== 'string') return false;
  if (!isStatusValue(status)) return false;
  const value = (player as { value?: unknown }).value;
  if (value !== undefined && typeof value !== 'number') return false;
  const emoji = (player as { emoji?: unknown }).emoji;
  if (emoji !== undefined && typeof emoji !== 'string') return false;
  return true;
};

export const isPlayerRemovedBroadcastPayload = (
  payload: unknown
): payload is PlayerRemovedBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'player_removed') return false;
  const player = (payload as { player?: unknown }).player;
  if (!isRecord(player)) return false;
  const playerId = (player as { id?: unknown }).id;
  return typeof playerId === 'string';
};

export const isStoryUpdatedBroadcastPayload = (
  payload: unknown
): payload is StoryUpdatedBroadcastPayload => {
  if (!isRecord(payload)) return false;
  if (payload.type !== 'story_updated') return false;
  const game = (payload as { game?: unknown }).game;
  if (!isRecord(game)) return false;
  const storyName = (game as { storyName?: unknown }).storyName;
  return storyName === null || typeof storyName === 'string';
};
