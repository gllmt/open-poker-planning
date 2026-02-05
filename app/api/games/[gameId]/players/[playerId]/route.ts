import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

type RemoveBody = { callerPlayerId?: string };

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ gameId: string; playerId: string }> }
) {
  const { gameId, playerId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as RemoveBody;

  const cookieStore = await cookies();
  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const adminTokenHash = adminToken ? hashToken(adminToken) : undefined;

  const playerToken = body.callerPlayerId
    ? cookieStore.get(cookieNames.playerToken(gameId))?.value
    : undefined;
  const playerTokenHash = playerToken ? hashToken(playerToken) : undefined;

  try {
    await fetchMutation(api.games.removePlayer, {
      gameId,
      playerId,
      adminTokenHash,
      callerPlayerId: body.callerPlayerId,
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
      { error: 'Failed to remove player' },
      { status: 500 }
    );
  }
}
