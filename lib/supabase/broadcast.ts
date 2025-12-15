import 'server-only';

import { createSupabaseAdminClient } from './admin';

type BroadcastPayload = Record<string, unknown>;

export async function broadcastGameChanged(
  gameId: string,
  payload: BroadcastPayload = {}
) {
  const supabase = createSupabaseAdminClient();

  const channel = supabase.channel(`game:${gameId}`, {
    config: { broadcast: { ack: false, self: true } },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Realtime subscribe timeout')),
      2000
    );
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
      if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeout);
        reject(new Error('Realtime subscribe error'));
      }
    });
  });

  await channel.send({
    type: 'broadcast',
    event: 'game_changed',
    payload,
  });

  await channel.unsubscribe();
  supabase.removeChannel(channel);
}
