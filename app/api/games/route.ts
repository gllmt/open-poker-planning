import { after, NextResponse } from 'next/server';

import { cookieNames, cookieOptions } from '@/lib/security/cookies';
import { generateToken, hashToken } from '@/lib/security/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type CreateGameBody = {
  name: string;
  createdBy: string;
  gameType: string;
  cards: unknown;
  isAllowMembersToManageSession?: boolean;
};

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as CreateGameBody | null;
  if (
    !body?.name ||
    !body?.createdBy ||
    !body?.gameType ||
    !Array.isArray(body.cards)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const gameId = crypto.randomUUID();
  const createdById = crypto.randomUUID();

  const joinToken = generateToken();
  const adminToken = generateToken();
  const playerToken = generateToken();

  const joinTokenHash = hashToken(joinToken);
  const adminTokenHash = hashToken(adminToken);
  const playerTokenHash = hashToken(playerToken);

  const supabase = createSupabaseAdminClient();

  const { error: gameError } = await supabase.from('games').insert({
    id: gameId,
    name: body.name,
    game_type: body.gameType,
    cards: body.cards,
    created_by: body.createdBy,
    created_by_id: createdById,
    is_allow_members_to_manage_session: Boolean(
      body.isAllowMembersToManageSession
    ),
    story_name: null,
    auto_reveal: false,
    game_status: 'Started',
    timer_props: null,
    join_token_hash: joinTokenHash,
    admin_token_hash: adminTokenHash,
  });

  if (gameError) {
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }

  const { error: playerError } = await supabase.from('players').insert({
    id: createdById,
    game_id: gameId,
    name: body.createdBy,
    status: 'Not Started',
    value: 0,
    emoji: null,
    player_token_hash: playerTokenHash,
  });

  if (playerError) {
    // Best-effort cleanup
    await supabase.from('games').delete().eq('id', gameId);
    return NextResponse.json(
      { error: 'Failed to create player' },
      { status: 500 }
    );
  }

  after(() =>
    broadcastGameChanged(gameId, { type: 'created' }).catch(() => {})
  );

  const response = NextResponse.json(
    {
      gameId,
      joinToken,
      playerId: createdById,
    },
    { status: 201 }
  );

  response.cookies.set(
    cookieNames.adminToken(gameId),
    adminToken,
    cookieOptions
  );
  response.cookies.set(
    cookieNames.playerToken(gameId),
    playerToken,
    cookieOptions
  );
  return response;
}
