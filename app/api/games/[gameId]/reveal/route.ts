import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type RevealBody = { callerPlayerId?: string };

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as RevealBody;

  const cookieStore = await cookies();
  const supabase = createSupabaseAdminClient();
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const isAdmin = adminToken && tokenMatchesHash(adminToken, game.admin_token_hash);

  if (!isAdmin) {
    if (!game.is_allow_members_to_manage_session || !body.callerPlayerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
    if (!playerToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: player, error } = await supabase
      .from('players')
      .select('player_token_hash')
      .eq('game_id', gameId)
      .eq('id', body.callerPlayerId)
      .maybeSingle();

    if (error || !player?.player_token_hash || !tokenMatchesHash(playerToken, player.player_token_hash)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({ game_status: 'Finished' })
    .eq('id', gameId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to reveal' }, { status: 500 });
  }

  await broadcastGameChanged(gameId, { type: 'revealed' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
