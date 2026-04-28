'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { clearGameSession } from '@/lib/api/games';
import { clearPlayerGameSession } from '@/lib/browser-storage';
import type { Locale } from '@/lib/i18n/config';
import { withLocale } from '@/lib/i18n/paths';

type SessionExitReason = 'left' | 'missing-session' | 'removed' | null;

export function useSessionExitRedirect({
  gameId,
  locale,
  reason,
}: {
  gameId: string;
  locale: Locale;
  reason: SessionExitReason;
}) {
  const router = useRouter();
  const hasHandledSessionExitRef = useRef(false);

  useEffect(() => {
    if (!reason || hasHandledSessionExitRef.current) {
      return;
    }

    hasHandledSessionExitRef.current = true;
    clearPlayerGameSession(gameId);

    const redirectTo =
      reason === 'left'
        ? withLocale('/', locale)
        : withLocale(`/join/${gameId}?reason=${reason}`, locale);

    void clearGameSession(gameId)
      .catch(() => {})
      .finally(() => {
        router.replace(redirectTo);
      });
  }, [gameId, locale, reason, router]);
}
