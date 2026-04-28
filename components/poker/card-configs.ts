import type { CardConfig } from '@/types/cards';
import { GameType } from '@/types/game';

const palette = {
  zero: '#5eead4',
  question: '#a78bfa',
  coffee: '#fdba74',
  xxs: '#f9a8d4',
  blue1: '#93c5fd',
  blue2: '#7dd3fc',
  green1: '#86efac',
  yellow1: '#fde68a',
  red1: '#fca5a5',
  red2: '#f87171',
  purple1: '#c4b5fd',
};

const legacyNeutralCardColor = '#e7edf3';
const legacyNeutralCardRgb = 'rgb(231,237,243)';
const legacyCardVarPrefix = 'var(--card-';

const isLegacyNeutralCard = (color: string | undefined) => {
  if (!color) return false;
  const normalized = color.toLowerCase().replace(/\s+/g, '');
  return (
    normalized === legacyNeutralCardColor || normalized === legacyNeutralCardRgb
  );
};

const isLegacyVariableCard = (color: string | undefined) => {
  if (!color) return false;
  const normalized = color.toLowerCase().replace(/\s+/g, '');
  return normalized.startsWith(legacyCardVarPrefix);
};

const fibonacciCards: CardConfig[] = [
  { value: 0, displayValue: '0', color: palette.zero },
  { value: 1, displayValue: '1', color: palette.blue1 },
  { value: 2, displayValue: '2', color: palette.blue1 },
  { value: 3, displayValue: '3', color: palette.blue2 },
  { value: 5, displayValue: '5', color: palette.blue2 },
  { value: 8, displayValue: '8', color: palette.green1 },
  { value: 13, displayValue: '13', color: palette.green1 },
  { value: 21, displayValue: '21', color: palette.yellow1 },
  { value: 34, displayValue: '34', color: palette.yellow1 },
  { value: 55, displayValue: '55', color: palette.red1 },
  { value: 89, displayValue: '89', color: palette.red1 },
  { value: -2, displayValue: '?', color: palette.question },
  { value: -1, displayValue: 'Coffee', color: palette.coffee },
];

const shortFibonacciCards: CardConfig[] = [
  { value: 0, displayValue: '0', color: palette.zero },
  { value: 0.5, displayValue: '½', color: palette.blue1 },
  { value: 1, displayValue: '1', color: palette.blue1 },
  { value: 2, displayValue: '2', color: palette.blue1 },
  { value: 3, displayValue: '3', color: palette.blue2 },
  { value: 5, displayValue: '5', color: palette.blue2 },
  { value: 8, displayValue: '8', color: palette.green1 },
  { value: 13, displayValue: '13', color: palette.green1 },
  { value: 21, displayValue: '20', color: palette.yellow1 },
  { value: 34, displayValue: '40', color: palette.yellow1 },
  { value: 55, displayValue: '100', color: palette.red1 },
  { value: -2, displayValue: '?', color: palette.question },
  { value: -1, displayValue: 'Coffee', color: palette.coffee },
];

const tShirtCards: CardConfig[] = [
  { value: 10, displayValue: 'XXS', color: palette.xxs },
  { value: 20, displayValue: 'XS', color: palette.blue1 },
  { value: 30, displayValue: 'S', color: palette.blue1 },
  { value: 40, displayValue: 'M', color: palette.blue2 },
  { value: 50, displayValue: 'L', color: palette.blue2 },
  { value: 60, displayValue: 'XL', color: palette.green1 },
  { value: 70, displayValue: 'XXL', color: palette.green1 },
  { value: -2, displayValue: '?', color: palette.question },
  { value: -1, displayValue: 'Coffee', color: palette.coffee },
];

const tShirtAndNumbersCards: CardConfig[] = [
  { value: 10, displayValue: 'S', color: palette.blue1 },
  { value: 20, displayValue: 'M', color: palette.blue1 },
  { value: 30, displayValue: 'L', color: palette.blue2 },
  { value: 40, displayValue: 'XL', color: palette.blue2 },
  { value: 50, displayValue: '1', color: palette.green1 },
  { value: 60, displayValue: '2', color: palette.green1 },
  { value: 70, displayValue: '3', color: palette.yellow1 },
  { value: 80, displayValue: '4', color: palette.yellow1 },
  { value: 90, displayValue: '5', color: palette.red1 },
];

const customCardsTemplate: CardConfig[] = [
  { value: 0, displayValue: '0', color: palette.zero },
  { value: 1, displayValue: '1', color: palette.blue1 },
  { value: 2, displayValue: '2', color: palette.blue1 },
  { value: 3, displayValue: '3', color: palette.blue2 },
  { value: 4, displayValue: '4', color: palette.blue2 },
  { value: 5, displayValue: '5', color: palette.green1 },
  { value: 6, displayValue: '6', color: palette.green1 },
  { value: 7, displayValue: '7', color: palette.yellow1 },
  { value: 8, displayValue: '8', color: palette.yellow1 },
  { value: 9, displayValue: '9', color: palette.red1 },
  { value: 10, displayValue: '10', color: palette.red1 },
  { value: 11, displayValue: '11', color: palette.red2 },
  { value: 12, displayValue: '12', color: palette.red2 },
  { value: 13, displayValue: '13', color: palette.purple1 },
  { value: 14, displayValue: '14', color: palette.purple1 },
];

export const getCards = (gameType: GameType | undefined): CardConfig[] => {
  switch (gameType) {
    case GameType.Fibonacci:
      return fibonacciCards;
    case GameType.ShortFibonacci:
      return shortFibonacciCards;
    case GameType.TShirt:
      return tShirtCards;
    case GameType.TShirtAndNumber:
      return tShirtAndNumbersCards;
    case GameType.Custom:
      return customCardsTemplate;
    default:
      return fibonacciCards;
  }
};

export const normalizeLegacyCards = (
  gameType: GameType,
  cards: CardConfig[]
) => {
  const defaults = getCards(gameType);
  return cards.map((card) => {
    if (!isLegacyNeutralCard(card.color) && !isLegacyVariableCard(card.color))
      return card;
    const fallback = defaults.find((entry) => entry.value === card.value);
    return fallback ? { ...card, color: fallback.color } : card;
  });
};

export const getCustomCards = (values: string[]) => {
  const customCards: CardConfig[] = customCardsTemplate.map((c) => ({ ...c }));
  values.forEach((value, index) => {
    if (customCards[index]) customCards[index].displayValue = value;
  });

  return customCards.filter(
    (card) => card.displayValue !== undefined && card.displayValue.trim() !== ''
  );
};
