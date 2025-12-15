import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type StoryBody = {
  storyName: string;
  callerPlayerId: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as StoryBody | null;
  if (!body?.callerPlayerId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
  if (!playerToken)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('player_token_hash')
    .eq('game_id', gameId)
    .eq('id', body.callerPlayerId)
    .maybeSingle();

  if (
    playerError ||
    !player?.player_token_hash ||
    !tokenMatchesHash(playerToken, player.player_token_hash)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({ story_name: body.storyName || null })
    .eq('id', gameId);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update story' },
      { status: 500 }
    );
  }

  await broadcastGameChanged(gameId, { type: 'story_updated' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
