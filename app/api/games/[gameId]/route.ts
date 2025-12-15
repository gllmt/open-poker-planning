import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { tokenMatchesHash } from '@/lib/security/authorize';
import { cookieNames } from '@/lib/security/cookies';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { broadcastGameChanged } from '@/lib/supabase/broadcast';

type GameRow = {
  id: string;
  name: string;
  game_type: string;
  cards: unknown;
  created_by: string;
  created_by_id: string;
  is_allow_members_to_manage_session: boolean;
  story_name: string | null;
  auto_reveal: boolean;
  game_status: string;
  timer_props: unknown | null;
  created_at: string;
  updated_at: string;
  join_token_hash: string;
  admin_token_hash: string;
};

type PlayerRow = {
  id: string;
  game_id: string;
  name: string;
  status: string;
  value: number | null;
  emoji: string | null;
  created_at: string;
  updated_at: string;
  player_token_hash: string;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function sanitizeGame(game: GameRow) {
  return {
    id: game.id,
    name: game.name,
    gameType: game.game_type,
    cards: game.cards,
    createdBy: game.created_by,
    createdById: game.created_by_id,
    isAllowMembersToManageSession: game.is_allow_members_to_manage_session,
    storyName: game.story_name ?? undefined,
    autoReveal: game.auto_reveal,
    gameStatus: game.game_status,
    timerProps: game.timer_props ?? undefined,
    createdAt: game.created_at,
    updatedAt: game.updated_at,
  };
}

function sanitizePlayer(player: PlayerRow) {
  return {
    id: player.id,
    name: player.name,
    status: player.status,
    value: player.value ?? undefined,
    emoji: player.emoji ?? undefined,
  };
}

async function authorizeRead(
  request: Request,
  game: GameRow,
  cookieStore: CookieStore
): Promise<boolean> {
  const url = new URL(request.url);
  const joinToken = url.searchParams.get('token');
  if (joinToken && tokenMatchesHash(joinToken, game.join_token_hash))
    return true;

  const playerId = url.searchParams.get('playerId');
  if (!playerId) return false;

  const playerToken = cookieStore.get(cookieNames.playerToken(game.id))?.value;
  if (!playerToken) return false;

  const supabase = createSupabaseAdminClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('player_token_hash')
    .eq('game_id', game.id)
    .eq('id', playerId)
    .maybeSingle();

  if (error || !player?.player_token_hash) return false;
  return tokenMatchesHash(playerToken, player.player_token_hash);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const authorized = await authorizeRead(request, game as GameRow, cookieStore);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    return NextResponse.json(
      { error: 'Failed to load players' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    game: sanitizeGame(game as GameRow),
    players: (players as PlayerRow[]).map(sanitizePlayer),
  });
}

async function authorizeManage(
  request: Request,
  game: GameRow,
  cookieStore: CookieStore,
  opts: { requireAdminIfNotAllowMembers?: boolean } = {
    requireAdminIfNotAllowMembers: true,
  }
): Promise<boolean> {
  const adminToken = cookieStore.get(cookieNames.adminToken(game.id))?.value;
  if (adminToken && tokenMatchesHash(adminToken, game.admin_token_hash))
    return true;

  if (
    !game.is_allow_members_to_manage_session &&
    opts.requireAdminIfNotAllowMembers
  ) {
    return false;
  }

  const url = new URL(request.url);
  const callerPlayerId = url.searchParams.get('callerPlayerId');
  if (!callerPlayerId) return false;

  const playerToken = cookieStore.get(cookieNames.playerToken(game.id))?.value;
  if (!playerToken) return false;

  const supabase = createSupabaseAdminClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('player_token_hash')
    .eq('game_id', game.id)
    .eq('id', callerPlayerId)
    .maybeSingle();

  if (error || !player?.player_token_hash) return false;
  return tokenMatchesHash(playerToken, player.player_token_hash);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const authorized = await authorizeManage(
    request,
    game as GameRow,
    cookieStore
  );
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId);
  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }

  await broadcastGameChanged(gameId, { type: 'deleted' }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
