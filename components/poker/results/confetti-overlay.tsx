import type { CSSProperties } from 'react';
import { useMemo } from 'react';

const confettiColors = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#f97316',
  '#ec4899',
  '#22c55e',
  '#a855f7',
  '#14b8a6',
];

const CONFETTI_COUNT = 240;

const timingOptions = [
  'linear',
  'ease-out',
  'ease-in-out',
  'cubic-bezier(0.2, 0.8, 0.3, 1)',
];

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
};

const createRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

const createConfettiPieces = (seed: string) => {
  const rand = createRng(hashSeed(seed));
  const randomBetween = (min: number, max: number) =>
    rand() * (max - min) + min;

  return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const size = randomBetween(5, 12);
    const left = randomBetween(0, 100);
    const delay = randomBetween(0, 0.5);
    const duration = randomBetween(3.2, 4.6);
    const driftStart = randomBetween(-20, 20);
    const driftEnd = randomBetween(-90, 90);
    const rotate = randomBetween(-900, 900);
    const timing =
      timingOptions[Math.floor(randomBetween(0, timingOptions.length))] ||
      'linear';

    return {
      id: `${seed}-${index}`,
      left: `${left.toFixed(2)}%`,
      delay: `${delay.toFixed(2)}s`,
      duration: `${duration.toFixed(2)}s`,
      size,
      height: Math.round(size * 0.6),
      color: confettiColors[index % confettiColors.length] as string,
      driftStart: `${driftStart.toFixed(1)}px`,
      driftEnd: `${driftEnd.toFixed(1)}px`,
      rotate: `${rotate.toFixed(0)}deg`,
      timing,
    };
  });
};

export function ConfettiOverlay({ seed }: { seed: string }) {
  const confettiPieces = useMemo(() => createConfettiPieces(seed), [seed]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={
            {
              left: piece.left,
              width: `${piece.size}px`,
              height: `${piece.height}px`,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              animationTimingFunction: piece.timing,
              '--confetti-x-start': piece.driftStart,
              '--confetti-x-end': piece.driftEnd,
              '--confetti-rotate': piece.rotate,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
