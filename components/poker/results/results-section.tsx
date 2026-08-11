'use client';

import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import type { CardConfig } from '@/types/cards';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { PlanningCard, type PlanningCardFace } from '../planning-card';
import { getResultSummary } from './result-summary';

const unavailableCard: CardConfig = {
  value: -2,
  displayValue: '?',
  color: '#a78bfa',
};

function formatAverage(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(value);
}

export function ResultsSection({
  game,
  players,
}: {
  game: Game;
  players: Player[];
}) {
  const { locale, t } = useI18n();
  const [areCardsRevealed, setAreCardsRevealed] = useState(false);
  const summary = useMemo(
    () => getResultSummary(game, players),
    [game, players]
  );

  useEffect(() => {
    if (game.gameStatus !== Status.Finished) {
      setAreCardsRevealed(false);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setAreCardsRevealed(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [game.gameStatus]);

  if (game.gameStatus !== Status.Finished) return null;

  const averageDisplayValue =
    summary.average === null ? '?' : formatAverage(summary.average, locale);
  const averageCard: CardConfig = {
    value: summary.average ?? unavailableCard.value,
    displayValue: averageDisplayValue,
    color: '#fca5a5',
  };
  const mostPlayedCard = summary.mostPlayedCard ?? unavailableCard;
  const cardFace: PlanningCardFace = areCardsRevealed ? 'front' : 'back';
  const averageDescription =
    summary.average === null
      ? t('results.averageUnavailable')
      : t('results.averageDescription');
  const mostPlayedDescription =
    summary.mostPlayedCount === 0
      ? t('results.noRevealedVote')
      : summary.isMostPlayedTie
        ? t('results.mostPlayedTie')
        : t('results.mostPlayedDescription');

  return (
    <section className="mt-4 border-t border-border/40 pt-3 animate-fade-in">
      <h3 className="text-sm font-semibold">{t('results.title')}</h3>

      <div className="mt-3 grid gap-3">
        <ResultInsight
          title={t('results.averageCard')}
          description={averageDescription}
          accessibleValue={averageDisplayValue}
          card={averageCard}
          face={cardFace}
          flipDelayMs={65}
        />
        <ResultInsight
          title={t('results.mostPlayedCard')}
          description={mostPlayedDescription}
          accessibleValue={mostPlayedCard.displayValue}
          card={mostPlayedCard}
          face={cardFace}
          flipDelayMs={165}
        />
      </div>
    </section>
  );
}

function ResultInsight({
  title,
  description,
  accessibleValue,
  card,
  face,
  flipDelayMs,
}: {
  title: string;
  description: string;
  accessibleValue: string;
  card: CardConfig;
  face: PlanningCardFace;
  flipDelayMs: number;
}) {
  return (
    <div className="flex min-h-24 items-center justify-between gap-4 rounded-xl glass-inner dark:dark-glass-inner px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <span
        role="img"
        aria-label={`${title} : ${accessibleValue}`}
        className="shrink-0"
      >
        <PlanningCard
          card={card}
          face={face}
          size="player"
          flipDelayMs={flipDelayMs}
        />
      </span>
    </div>
  );
}
