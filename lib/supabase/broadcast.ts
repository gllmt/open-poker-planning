import 'server-only';

import type { RealtimeChannel } from '@supabase/supabase-js';

import type { BroadcastPayload } from '@/types/broadcast';

import { createSupabaseAdminClient } from './admin';

const isDev = process.env.NODE_ENV === 'development';

type ChannelEntry = {
  channel: RealtimeChannel;
  ready: Promise<void>;
  idleTimer?: ReturnType<typeof setTimeout>;
};

const channelCache = new Map<string, ChannelEntry>();
const DEFAULT_CHANNEL_IDLE_TTL_MS = 15 * 60_000;
const CHANNEL_IDLE_TTL_MS = (() => {
  const raw = process.env.REALTIME_CHANNEL_TTL_MS;
  if (!raw) return DEFAULT_CHANNEL_IDLE_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_CHANNEL_IDLE_TTL_MS;
})();
let supabaseAdminClient: ReturnType<typeof createSupabaseAdminClient> | null =
  null;

function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createSupabaseAdminClient();
  }
  return supabaseAdminClient;
}

function scheduleChannelCleanup(gameId: string, entry: ChannelEntry) {
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    const cached = channelCache.get(gameId);
    if (cached !== entry) return;
    channelCache.delete(gameId);
    getSupabaseAdminClient()
      .removeChannel(entry.channel)
      .catch(() => {});
  }, CHANNEL_IDLE_TTL_MS);
  entry.idleTimer?.unref?.();
}

async function getBroadcastChannel(gameId: string) {
  const cached = channelCache.get(gameId);
  if (cached) {
    scheduleChannelCleanup(gameId, cached);
    await cached.ready;
    return cached.channel;
  }

  const supabase = getSupabaseAdminClient();
  const channel = supabase.channel(`game:${gameId}`, {
    config: { broadcast: { ack: false, self: true } },
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Realtime subscribe timeout')),
      2000
    );
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
        return;
      }
      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        clearTimeout(timeout);
        reject(err ?? new Error(`Realtime subscribe ${status.toLowerCase()}`));
      }
    });
  });

  const entry: ChannelEntry = { channel, ready };
  channelCache.set(gameId, entry);
  scheduleChannelCleanup(gameId, entry);

  try {
    await ready;
  } catch (error) {
    channelCache.delete(gameId);
    supabase.removeChannel(channel).catch(() => {});
    throw error;
  }

  return channel;
}

export async function broadcastGameChanged(
  gameId: string,
  payload: BroadcastPayload
) {
  if (isDev) {
    const payloadType = (payload as { type?: unknown } | null)?.type;
    console.info('[realtime:broadcast]', {
      gameId,
      type: payloadType ?? 'unknown',
    });
  }
  const channel = await getBroadcastChannel(gameId);
  const result = await channel.send({
    type: 'broadcast',
    event: 'game_changed',
    payload,
  });
  if (result !== 'ok') {
    throw new Error(`Realtime broadcast failed: ${result}`);
  }
}
