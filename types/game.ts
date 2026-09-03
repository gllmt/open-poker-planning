import type { CardConfig } from './cards';
import type { Status } from './status';

export interface TimerProps {
  startedAt?: number | null;
  pausedAt?: number | null;
  totalSeconds?: number;
  soundOn?: boolean;
  timerVisible?: boolean;
  currentSeconds?: number;
  timerPaused?: boolean;
  elapsedSeconds?: number;
}

export interface Game {
  id: string;
  name: string;
  gameStatus: Status;
  gameType: GameType;
  isAllowMembersToManageSession?: boolean;
  storyName?: string;
  autoReveal?: boolean;
  cards: CardConfig[];
  createdBy: string;
  createdById: string;
  createdAt?: string;
  updatedAt?: string;
  timerProps?: TimerProps;
  timerCompletedAt?: number;
}

export interface NewGame {
  name: string;
  gameType: GameType;
  cards: CardConfig[];
  isAllowMembersToManageSession?: boolean;
  createdBy: string;
}

export enum GameType {
  Fibonacci = 'Fibonacci',
  ShortFibonacci = 'ShortFibonacci',
  TShirt = 'TShirt',
  TShirtAndNumber = 'TShirtAndNumber',
  Custom = 'Custom',
}
