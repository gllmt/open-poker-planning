import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type { GameStatusBroadcastPayload } from '@/types/broadcast';
import type { TimerProps } from '@/types/game';
import { Status } from '@/types/status';

type ResetBody = { callerPlayerId?: string };

type GameAuthRow = {
  admin_token_hash: string;
  is_allow_members_to_manage_session: boolean;
  timer_props: unknown | null;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ResetBody;

  const cookieStore = await cookies();
  const supabase = createSupabaseAdminClient();
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select(
      'id, admin_token_hash, is_allow_members_to_manage_session, timer_props'
    )
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const authGame = game as GameAuthRow;
  const nextTimerProps = resetTimerProps(authGame.timer_props) as
    | TimerProps
    | null
    | undefined;

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

  const updatePayload: Record<string, unknown> = { game_status: 'Started' };
  if (nextTimerProps) updatePayload.timer_props = nextTimerProps;

  const { error: gameUpdateError } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('id', gameId);

  if (gameUpdateError) {
    return NextResponse.json(
      { error: 'Failed to reset game' },
      { status: 500 }
    );
  }

  const { error: playersUpdateError } = await supabase
    .from('players')
    .update({ status: 'Not Started', value: 0 })
    .eq('game_id', gameId);

  if (playersUpdateError) {
    return NextResponse.json(
      { error: 'Failed to reset players' },
      { status: 500 }
    );
  }

  const broadcastPayload = {
    type: 'reset',
    game: {
      gameStatus: Status.Started,
      ...(nextTimerProps ? { timerProps: nextTimerProps } : {}),
    },
    players: { reset: true },
  } satisfies GameStatusBroadcastPayload;

  after(() => broadcastGameChanged(gameId, broadcastPayload).catch(() => {}));
  return NextResponse.json({ ok: true });
}
