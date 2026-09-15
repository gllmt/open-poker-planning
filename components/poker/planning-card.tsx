import { CircleQuestionMark, Coffee, Spade } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { CardConfig } from '@/types/cards';

export type PlanningCardFace = 'front' | 'back' | 'empty';

const sceneSizeClasses = {
  picker: 'h-[124px] w-[78px] md:h-[184px] md:w-[116px]',
  player: 'h-[72px] w-12',
} as const;

const surfaceRadiusClasses = {
  picker: 'rounded-[0.7rem] md:rounded-2xl',
  player: 'rounded-[0.7rem]',
} as const;

const cardSurfaceClasses =
  'planning-card-face absolute inset-0 overflow-hidden bg-primary text-primary-foreground shadow-[0_14px_30px_rgba(65,28,15,0.3),inset_0_0_24px_rgba(255,218,188,0.09)]';

const cardPatternClasses =
  'absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,205,170,0.18),transparent_36%),repeating-linear-gradient(45deg,transparent_0,transparent_7px,rgba(255,235,219,0.1)_7px,rgba(255,235,219,0.1)_8px),repeating-linear-gradient(-45deg,transparent_0,transparent_9px,rgba(255,244,235,0.04)_9px,rgba(255,244,235,0.04)_10px)]';

export function PlanningCard({
  card,
  face,
  size = 'picker',
  selected = false,
  flipDelayMs = 0,
  className,
}: {
  card?: CardConfig;
  face: PlanningCardFace;
  size?: keyof typeof sceneSizeClasses;
  selected?: boolean;
  flipDelayMs?: number;
  className?: string;
}) {
  if (face === 'empty') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-[0.7rem] border border-dashed border-border/70 bg-background/25 text-muted-foreground/45 shadow-inner',
          sceneSizeClasses[size],
          className
        )}
      >
        <span className={size === 'picker' ? 'text-xl' : 'text-xs'}>•</span>
      </span>
    );
  }

  const resolvedCard = card ?? {
    value: -2,
    displayValue: '?',
    color: '#cbd5e1',
  };

  return (
    <span
      aria-hidden="true"
      data-face={face}
      className={cn(
        'planning-card-scene relative block shrink-0',
        sceneSizeClasses[size],
        className
      )}
    >
      <span
        className="planning-card-inner absolute inset-0 block"
        style={
          { '--planning-card-flip-delay': `${flipDelayMs}ms` } as CSSProperties
        }
      >
        <span className={cn(cardSurfaceClasses, surfaceRadiusClasses[size])}>
          <span className={cardPatternClasses} />
          <CardMedallion
            card={resolvedCard}
            concealed={!selected}
            size={size}
          />
          <span className="absolute left-2 top-1.5 text-[7px] text-card-ornament/60 md:left-3 md:top-2 md:text-[9px]">
            ✦
          </span>
          <span className="absolute bottom-1.5 right-2 text-[7px] text-card-ornament/60 md:bottom-2 md:right-3 md:text-[9px]">
            ✦
          </span>
          <CardSelectionBorder selected={selected} size={size} />
        </span>

        <span
          className={cn(
            cardSurfaceClasses,
            surfaceRadiusClasses[size],
            'planning-card-front'
          )}
        >
          <span className={cardPatternClasses} />
          <CardCorner card={resolvedCard} position="top" size={size} />
          <CardMedallion card={resolvedCard} size={size} />
          <CardCorner card={resolvedCard} position="bottom" size={size} />
          <CardSelectionBorder selected={selected} size={size} />
        </span>
      </span>
    </span>
  );
}

function CardSelectionBorder({
  selected,
  size,
}: {
  selected: boolean;
  size: keyof typeof sceneSizeClasses;
}) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute inset-0 z-20 border-[2px] border-card-selection/75 opacity-0 transition-opacity ease-out motion-reduce:transition-none',
        surfaceRadiusClasses[size],
        selected
          ? 'delay-[480ms] duration-[880ms] opacity-[0.55]'
          : 'delay-0 duration-150'
      )}
    />
  );
}

function CardMedallion({
  card,
  concealed = false,
  size,
}: {
  card: CardConfig;
  concealed?: boolean;
  size: keyof typeof sceneSizeClasses;
}) {
  return (
    <span
      className={cn(
        'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card-medallion/70 shadow-[inset_0_0_0_1px_rgba(255,222,196,0.16),0_0_22px_rgba(122,52,22,0.14)]',
        size === 'picker' ? 'size-12 md:size-[4.5rem]' : 'size-7'
      )}
    >
      {concealed ? (
        <Spade
          className={size === 'picker' ? 'size-5 md:size-8' : 'size-3.5'}
          strokeWidth={1.6}
        />
      ) : (
        <CardValue card={card} size={size} />
      )}
    </span>
  );
}

function CardValue({
  card,
  size,
}: {
  card: CardConfig;
  size: keyof typeof sceneSizeClasses;
}) {
  if (card.value === -1) {
    return (
      <Coffee
        className={size === 'picker' ? 'size-7 md:size-11' : 'size-4'}
        strokeWidth={1.7}
      />
    );
  }

  if (card.value === -2) {
    return (
      <CircleQuestionMark
        className={size === 'picker' ? 'size-7 md:size-11' : 'size-4'}
        strokeWidth={1.7}
      />
    );
  }

  const isLongValue = card.displayValue.length > 2;

  return (
    <span
      className={cn(
        'font-semibold tracking-tight text-card-value drop-shadow-[0_0_12px_rgba(255,226,190,0.16)]',
        size === 'picker' && !isLongValue && 'text-3xl md:text-5xl',
        size === 'picker' && isLongValue && 'text-base md:text-2xl',
        size === 'player' && !isLongValue && 'text-base',
        size === 'player' && isLongValue && 'text-[9px]'
      )}
    >
      {card.displayValue}
    </span>
  );
}

function CardCorner({
  card,
  position,
  size,
}: {
  card: CardConfig;
  position: 'top' | 'bottom';
  size: keyof typeof sceneSizeClasses;
}) {
  const symbol =
    card.value === -1 ? '☕' : card.value === -2 ? '?' : card.displayValue;

  return (
    <span
      className={cn(
        'absolute z-10 font-semibold leading-none text-card-ornament/60',
        position === 'top' && 'left-[11%] top-[6%]',
        position === 'bottom' && 'bottom-[6%] right-[11%]',
        size === 'picker' ? 'text-[8px] md:text-caption' : 'text-[6px]'
      )}
    >
      {symbol}
    </span>
  );
}
