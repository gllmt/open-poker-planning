import type { CardConfig } from '@/types/cards';
import { GameType } from '@/types/game';

const cardZero = 'var(--card-zero)';
const cardQuestion = 'var(--card-question)';
const cardCoffee = 'var(--card-coffee)';
const cardXxs = 'var(--card-xxs)';
const cardBlue1 = 'var(--card-blue-1)';
const cardBlue2 = 'var(--card-blue-2)';
const cardGreen1 = 'var(--card-green-1)';
const cardYellow1 = 'var(--card-yellow-1)';
const cardRed1 = 'var(--card-red-1)';
const cardRed2 = 'var(--card-red-2)';
const cardPurple1 = 'var(--card-purple-1)';
const legacyNeutralCardColor = '#e7edf3';

export const fibonacciCards: CardConfig[] = [
  { value: 0, displayValue: '0', color: cardZero },
  { value: 1, displayValue: '1', color: cardBlue1 },
  { value: 2, displayValue: '2', color: cardBlue1 },
  { value: 3, displayValue: '3', color: cardBlue2 },
  { value: 5, displayValue: '5', color: cardBlue2 },
  { value: 8, displayValue: '8', color: cardGreen1 },
  { value: 13, displayValue: '13', color: cardGreen1 },
  { value: 21, displayValue: '21', color: cardYellow1 },
  { value: 34, displayValue: '34', color: cardYellow1 },
  { value: 55, displayValue: '55', color: cardRed1 },
  { value: 89, displayValue: '89', color: cardRed1 },
  { value: -2, displayValue: '?', color: cardQuestion },
  { value: -1, displayValue: 'Coffee', color: cardCoffee },
];

export const shortFibonacciCards: CardConfig[] = [
  { value: 0, displayValue: '0', color: cardZero },
  { value: 0.5, displayValue: '½', color: cardBlue1 },
  { value: 1, displayValue: '1', color: cardBlue1 },
  { value: 2, displayValue: '2', color: cardBlue1 },
  { value: 3, displayValue: '3', color: cardBlue2 },
  { value: 5, displayValue: '5', color: cardBlue2 },
  { value: 8, displayValue: '8', color: cardGreen1 },
  { value: 13, displayValue: '13', color: cardGreen1 },
  { value: 21, displayValue: '20', color: cardYellow1 },
  { value: 34, displayValue: '40', color: cardYellow1 },
  { value: 55, displayValue: '100', color: cardRed1 },
  { value: -2, displayValue: '?', color: cardQuestion },
  { value: -1, displayValue: 'Coffee', color: cardCoffee },
];

export const tShirtCards: CardConfig[] = [
  { value: 10, displayValue: 'XXS', color: cardXxs },
  { value: 20, displayValue: 'XS', color: cardBlue1 },
  { value: 30, displayValue: 'S', color: cardBlue1 },
  { value: 40, displayValue: 'M', color: cardBlue2 },
  { value: 50, displayValue: 'L', color: cardBlue2 },
  { value: 60, displayValue: 'XL', color: cardGreen1 },
  { value: 70, displayValue: 'XXL', color: cardGreen1 },
  { value: -2, displayValue: '?', color: cardQuestion },
  { value: -1, displayValue: 'Coffee', color: cardCoffee },
];

export const tShirtAndNumbersCards: CardConfig[] = [
  { value: 10, displayValue: 'S', color: cardBlue1 },
  { value: 20, displayValue: 'M', color: cardBlue1 },
  { value: 30, displayValue: 'L', color: cardBlue2 },
  { value: 40, displayValue: 'XL', color: cardBlue2 },
  { value: 50, displayValue: '1', color: cardGreen1 },
  { value: 60, displayValue: '2', color: cardGreen1 },
  { value: 70, displayValue: '3', color: cardYellow1 },
  { value: 80, displayValue: '4', color: cardYellow1 },
  { value: 90, displayValue: '5', color: cardRed1 },
];

export const customCardsTemplate: CardConfig[] = [
  { value: 0, displayValue: '0', color: cardZero },
  { value: 1, displayValue: '1', color: cardBlue1 },
  { value: 2, displayValue: '2', color: cardBlue1 },
  { value: 3, displayValue: '3', color: cardBlue2 },
  { value: 4, displayValue: '4', color: cardBlue2 },
  { value: 5, displayValue: '5', color: cardGreen1 },
  { value: 6, displayValue: '6', color: cardGreen1 },
  { value: 7, displayValue: '7', color: cardYellow1 },
  { value: 8, displayValue: '8', color: cardYellow1 },
  { value: 9, displayValue: '9', color: cardRed1 },
  { value: 10, displayValue: '10', color: cardRed1 },
  { value: 11, displayValue: '11', color: cardRed2 },
  { value: 12, displayValue: '12', color: cardRed2 },
  { value: 13, displayValue: '13', color: cardPurple1 },
  { value: 14, displayValue: '14', color: cardPurple1 },
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
    if (card.color?.toLowerCase() !== legacyNeutralCardColor) return card;
    const fallback = defaults.find((entry) => entry.value === card.value);
    return fallback ? { ...card, color: fallback.color } : card;
  });
};

export const getRandomEmoji = () => {
  const emojis = [
    '☕',
    '🥤',
    '🍹',
    '🍸',
    '🍧',
    '🍨',
    '🍩',
    '🍎',
    '🧁',
    '🍪',
    '🍿',
    '🌮',
    '🍦',
    '🍉',
    '🍐',
    '🍰',
    '🍫',
  ];
  return emojis[Math.floor(Math.random() * emojis.length)];
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
