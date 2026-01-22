import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type TimerBody = {
  timerProps: unknown;
  callerPlayerId?: string;
};

type GameAuthRow = {
  admin_token_hash: string;
  is_allow_members_to_manage_session: boolean;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as TimerBody | null;
  if (!body)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

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

    const { data: player, error } = await supabase
      .from('players')
      .select('player_token_hash')
      .eq('game_id', gameId)
      .eq('id', body.callerPlayerId)
      .maybeSingle();

    if (
      error ||
      !player?.player_token_hash ||
      !tokenMatchesHash(playerToken, player.player_token_hash)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({ timer_props: body.timerProps ?? null })
    .eq('id', gameId);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update timer' },
      { status: 500 }
    );
  }

  after(() =>
    broadcastGameChanged(gameId, {
      type: 'timer_updated',
      game: { timerProps: body.timerProps ?? null },
    }).catch(() => {})
  );
  return NextResponse.json({ ok: true });
}
