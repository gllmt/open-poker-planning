'use client';

import confetti from 'canvas-confetti';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FIREWORKS_DURATION_MS = 15_000;
const FIREWORKS_INTERVAL_MS = 250;
const FIREWORKS_DEFAULTS = {
  spread: 360,
  startVelocity: 30,
  ticks: 60,
} as const;

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ConfettiOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fire = confetti.create(canvas, {
      disableForReducedMotion: true,
      resize: true,
    });

    const animationEnd = Date.now() + FIREWORKS_DURATION_MS;
    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }

      const particleCount = Math.max(
        1,
        Math.round(50 * (timeLeft / FIREWORKS_DURATION_MS))
      );

      void fire({
        ...FIREWORKS_DEFAULTS,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
        particleCount,
      });

      void fire({
        ...FIREWORKS_DEFAULTS,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
        particleCount,
      });
    }, FIREWORKS_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      fire.reset();
    };
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
    />,
    portalRoot
  );
}
