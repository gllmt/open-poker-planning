import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type RemoveBody = { callerPlayerId?: string };
type GameAuthRow = {
  admin_token_hash: string;
  is_allow_members_to_manage_session: boolean;
};

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ gameId: string; playerId: string }> }
) {
  const { gameId, playerId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as RemoveBody;

  const cookieStore = await cookies();
  const supabase = createSupabaseAdminClient();
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, admin_token_hash, is_allow_members_to_manage_session')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const authGame = game as GameAuthRow;
  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const isAdmin =
    adminToken && tokenMatchesHash(adminToken, authGame.admin_token_hash);

  if (!isAdmin) {
    if (!authGame.is_allow_members_to_manage_session || !body.callerPlayerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
    if (!playerToken)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: caller, error } = await supabase
      .from('players')
      .select('player_token_hash')
      .eq('game_id', gameId)
      .eq('id', body.callerPlayerId)
      .maybeSingle();

    if (
      error ||
      !caller?.player_token_hash ||
      !tokenMatchesHash(playerToken, caller.player_token_hash)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { error: deleteError } = await supabase
    .from('players')
    .delete()
    .eq('game_id', gameId)
    .eq('id', playerId);

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to remove player' },
      { status: 500 }
    );
  }

  after(() =>
    broadcastGameChanged(gameId, { type: 'player_removed' }).catch(() => {})
  );
  return new NextResponse(null, { status: 204 });
}
