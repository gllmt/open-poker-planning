import { after, type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames, cookieOptions } from '@/lib/security/cookies';
import { generateToken, hashToken } from '@/lib/security/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';
import { Status } from '@/types/status';

type JoinBody = {
  playerName: string;
  token: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as JoinBody | null;
  if (!body?.playerName || !body?.token) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, join_token_hash')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (
    !tokenMatchesHash(
      body.token,
      (game as { join_token_hash: string }).join_token_hash
    )
  ) {
    return NextResponse.json(
      { error: 'Invalid invite token' },
      { status: 403 }
    );
  }

  const playerId = crypto.randomUUID();
  const playerToken = generateToken();
  const playerTokenHash = hashToken(playerToken);

  const { error: playerError } = await supabase.from('players').insert({
    id: playerId,
    game_id: gameId,
    name: body.playerName,
    status: 'Not Started',
    value: 0,
    emoji: null,
    player_token_hash: playerTokenHash,
  });

  if (playerError) {
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
  }

  after(() =>
    broadcastGameChanged(gameId, {
      type: 'player_joined',
      player: {
        id: playerId,
        name: body.playerName,
        status: Status.NotStarted,
        value: 0,
      },
    }).catch(() => {})
  );

  const response = NextResponse.json(
    {
      playerId,
    },
    { status: 201 }
  );

  response.cookies.set(
    cookieNames.playerToken(gameId),
    playerToken,
    cookieOptions
  );
  return response;
}
