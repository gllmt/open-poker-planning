import { PostHogProvider } from '@posthog/next';

import { POSTHOG_URL_PRIVACY_OPTIONS } from '@/lib/analytics-url';

import { SafePostHogPageView } from './safe-posthog-page-view';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function AppPostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep analytics optional in local/dev environments until env vars are set.
  if (!posthogKey) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      // Cookieless analytics: memory-only identity, no autocapture, no recordings.
      // Only manual pageviews and explicit product events are sent.
      clientOptions={{
        ...POSTHOG_URL_PRIVACY_OPTIONS,
        advanced_disable_flags: true,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        defaults: '2026-01-30',
        disable_conversations: true,
        disable_external_dependency_loading: true,
        disable_product_tours: true,
        disable_session_recording: true,
        disable_surveys: true,
        person_profiles: 'never',
        persistence: 'memory',
        ...(posthogHost ? { api_host: posthogHost } : {}),
      }}
    >
      <SafePostHogPageView />
      {children}
    </PostHogProvider>
  );
}
