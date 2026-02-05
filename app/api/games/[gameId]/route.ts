import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const joinToken = url.searchParams.get('token');
  const playerId = url.searchParams.get('playerId');

  const joinTokenHash = joinToken ? hashToken(joinToken) : undefined;
  const playerToken = playerId
    ? cookieStore.get(cookieNames.playerToken(gameId))?.value
    : undefined;
  const playerTokenHash = playerToken ? hashToken(playerToken) : undefined;

  try {
    const data = await fetchQuery(api.games.getGameState, {
      gameId,
      joinTokenHash,
      playerId: playerId ?? undefined,
      playerTokenHash,
    });
    return NextResponse.json(data);
  } catch (error) {
    const code = getConvexErrorCode(error);
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load game' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const callerPlayerId = url.searchParams.get('callerPlayerId');

  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const adminTokenHash = adminToken ? hashToken(adminToken) : undefined;

  const playerToken = callerPlayerId
    ? cookieStore.get(cookieNames.playerToken(gameId))?.value
    : undefined;
  const playerTokenHash = playerToken ? hashToken(playerToken) : undefined;

  try {
    await fetchMutation(api.games.deleteGame, {
      gameId,
      adminTokenHash,
      callerPlayerId: callerPlayerId ?? undefined,
      playerTokenHash,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const code = getConvexErrorCode(error);
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}
