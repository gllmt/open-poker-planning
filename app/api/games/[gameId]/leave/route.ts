import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

type LeaveBody = {
  callerPlayerId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as LeaveBody | null;
  if (typeof body?.callerPlayerId !== 'string' || body.callerPlayerId === '') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
  if (!playerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await fetchMutation(api.games.leaveGame, {
      gameId,
      playerId: body.callerPlayerId,
      playerTokenHash: hashToken(playerToken),
    });
  } catch (error) {
    const code = getConvexErrorCode(error);
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to leave game' },
      { status: 500 }
    );
  }

  cookieStore.delete(cookieNames.playerToken(gameId));
  return new NextResponse(null, { status: 204 });
}
