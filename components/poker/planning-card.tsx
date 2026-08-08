import { Check, CircleQuestionMark, Coffee, Spade } from 'lucide-react';

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
  'planning-card-face absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#9a3f16_0%,#572008_52%,#261006_100%)] text-[#fff2df] shadow-[0_14px_30px_rgba(63,24,8,0.34),inset_0_0_24px_rgba(251,146,60,0.08)]';

const cardPatternClasses =
  'absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(251,146,60,0.22),transparent_36%),repeating-linear-gradient(45deg,transparent_0,transparent_7px,rgba(253,186,116,0.11)_7px,rgba(253,186,116,0.11)_8px),repeating-linear-gradient(-45deg,transparent_0,transparent_9px,rgba(255,237,213,0.04)_9px,rgba(255,237,213,0.04)_10px)]';

export function PlanningCard({
  card,
  face,
  size = 'picker',
  backLabel,
  flipDelayMs = 0,
  className,
}: {
  card?: CardConfig;
  face: PlanningCardFace;
  size?: keyof typeof sceneSizeClasses;
  backLabel?: string;
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
          flipDelayMs ? { transitionDelay: `${flipDelayMs}ms` } : undefined
        }
      >
        <span
          className={cn(
            cardSurfaceClasses,
            surfaceRadiusClasses[size],
            'planning-card-back'
          )}
        >
          <span className={cardPatternClasses} />
          <CardMedallion
            card={resolvedCard}
            concealed={!backLabel}
            size={size}
          />
          <span className="absolute left-2 top-1.5 text-[7px] text-orange-100/65 md:left-3 md:top-2 md:text-[9px]">
            ✦
          </span>
          <span className="absolute bottom-1.5 right-2 rotate-180 text-[7px] text-orange-100/65 md:bottom-2 md:right-3 md:text-[9px]">
            ✦
          </span>
          {backLabel ? (
            <span className="absolute inset-x-1.5 bottom-3 flex items-center justify-center gap-1 text-center text-[7px] font-semibold uppercase tracking-[0.12em] text-orange-50/90 md:bottom-5 md:text-[9px]">
              <Check
                className="size-2.5 text-primary md:size-3"
                strokeWidth={2.4}
              />
              {backLabel}
            </span>
          ) : null}
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
        </span>
      </span>
    </span>
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
        'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2b1007]/75 shadow-[inset_0_0_0_1px_rgba(254,215,170,0.18),0_0_22px_rgba(249,115,22,0.18)]',
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
        'font-semibold tracking-tight text-[#f5ecd8] drop-shadow-[0_0_12px_rgba(240,215,140,0.18)]',
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
        'absolute z-10 font-semibold leading-none text-orange-100/65',
        position === 'top' && 'left-[11%] top-[9%]',
        position === 'bottom' && 'bottom-[9%] right-[11%] rotate-180',
        size === 'picker' ? 'text-[8px] md:text-[10px]' : 'text-[6px]'
      )}
    >
      {symbol}
    </span>
  );
}
