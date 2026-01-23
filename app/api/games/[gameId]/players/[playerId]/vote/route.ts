import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type { VoteBroadcastPayload } from '@/types/broadcast';
import type { TimerProps } from '@/types/game';
import { Status } from '@/types/status';

type VoteBody = {
  value: number;
  emoji?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string; playerId: string }> }
) {
  const { gameId, playerId } = await context.params;
  const body = (await request.json().catch(() => null)) as VoteBody | null;
  if (!body || typeof body.value !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
  if (!playerToken)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const playerPromise = supabase
    .from('players')
    .select('player_token_hash')
    .eq('game_id', gameId)
    .eq('id', playerId)
    .maybeSingle();
  const gamePromise = supabase
    .from('games')
    .select('id, game_status, auto_reveal, timer_props')
    .eq('id', gameId)
    .maybeSingle();

  const [
    { data: player, error: playerError },
    { data: game, error: gameError },
  ] = await Promise.all([playerPromise, gamePromise]);

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }
  if (
    playerError ||
    !player?.player_token_hash ||
    !tokenMatchesHash(playerToken, player.player_token_hash)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (game.game_status === 'Finished') {
    return NextResponse.json({ error: 'Game is finished' }, { status: 409 });
  }

  const { error: voteError } = await supabase
    .from('players')
    .update({
      value: body.value,
      emoji: body.emoji ?? null,
      status: 'Finished',
    })
    .eq('game_id', gameId)
    .eq('id', playerId);

  if (voteError) {
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
  }

  let nextStatus: Status = Status.InProgress;
  if (game.auto_reveal) {
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('status')
      .eq('game_id', gameId);
    if (!playersError && Array.isArray(players) && players.length > 0) {
      const allFinished = players.every((p) => p.status === 'Finished');
      if (allFinished) nextStatus = Status.Finished;
    }
  }

  const nextTimerProps =
    game.auto_reveal && nextStatus === Status.Finished
      ? (resetTimerProps(game.timer_props) as TimerProps | null | undefined)
      : null;
  const updatePayload: Record<string, unknown> = { game_status: nextStatus };
  if (nextTimerProps) updatePayload.timer_props = nextTimerProps;

  const { error: statusError } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('id', gameId);

  if (statusError) {
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }

  const broadcastPayload = {
    type: 'vote',
    player: {
      id: playerId,
      status: Status.Finished,
      value: body.value,
      emoji: body.emoji ?? undefined,
    },
    game: {
      gameStatus: nextStatus,
      ...(nextTimerProps ? { timerProps: nextTimerProps } : {}),
    },
  } satisfies VoteBroadcastPayload;

  after(() => broadcastGameChanged(gameId, broadcastPayload).catch(() => {}));
  return NextResponse.json({ ok: true });
}
