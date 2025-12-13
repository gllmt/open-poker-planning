import { CardConfig } from './cards';
import { Status } from './status';

export interface TimerProps {
  currentSeconds?: number;
  totalSeconds?: number;
  soundOn?: boolean;
  timerVisible?: boolean;
  timerPaused?: boolean;
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

