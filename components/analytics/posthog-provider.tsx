import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Suspense } from 'react';

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
      clientOptions={{
        advanced_disable_flags: true,
        defaults: '2026-01-30',
        disable_conversations: true,
        disable_external_dependency_loading: true,
        disable_product_tours: true,
        disable_session_recording: true,
        disable_surveys: true,
        ...(posthogHost ? { api_host: posthogHost } : {}),
      }}
    >
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
