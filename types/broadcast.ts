import type { TimerProps } from './game';
import type { Status } from './status';

export type TimerBroadcastPayload = {
  type: 'timer_updated';
  game?: {
    timerProps?: TimerProps | null;
  };
};

export type AutoRevealBroadcastPayload = {
  type: 'auto_reveal_updated';
  game?: {
    autoReveal?: boolean;
  };
};

export type GameStatusBroadcastPayload = {
  type: 'revealed' | 'reset';
  game?: {
    gameStatus?: Status;
    timerProps?: TimerProps | null;
  };
  players?: {
    reset?: boolean;
  };
};

export type PlayerJoinedBroadcastPayload = {
  type: 'player_joined';
  player: {
    id: string;
    name: string;
    status: Status;
    value?: number;
    emoji?: string;
  };
};

export type PlayerRemovedBroadcastPayload = {
  type: 'player_removed';
  player: {
    id: string;
  };
};

export type StoryUpdatedBroadcastPayload = {
  type: 'story_updated';
  game: {
    storyName: string | null;
  };
};

export type VoteBroadcastPayload = {
  type: 'vote';
  player: {
    id: string;
    status: Status;
    value?: number;
    emoji?: string;
  };
  game?: {
    gameStatus?: Status;
    timerProps?: TimerProps | null;
  };
};

export type CreatedBroadcastPayload = {
  type: 'created';
};

export type DeletedBroadcastPayload = {
  type: 'deleted';
};

export type BroadcastPayload =
  | TimerBroadcastPayload
  | AutoRevealBroadcastPayload
  | GameStatusBroadcastPayload
  | PlayerJoinedBroadcastPayload
  | PlayerRemovedBroadcastPayload
  | StoryUpdatedBroadcastPayload
  | VoteBroadcastPayload
  | CreatedBroadcastPayload
  | DeletedBroadcastPayload;
