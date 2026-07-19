'use client';

import { usePostHog } from '@posthog/next';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { getAnalyticsPageviewUrl } from '@/lib/analytics-url';

export function SafePostHogPageView() {
  const pathname = usePathname();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname) return;
    const currentUrl = getAnalyticsPageviewUrl(window.location.href);
    if (!currentUrl) return;
    posthog.capture('$pageview', { $current_url: currentUrl });
  }, [pathname, posthog]);

  return null;
}
