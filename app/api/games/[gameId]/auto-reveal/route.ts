import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

type AutoRevealBody = {
  autoReveal: boolean;
  callerPlayerId?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request
    .json()
    .catch(() => null)) as AutoRevealBody | null;
  if (!body || typeof body.autoReveal !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const adminTokenHash = adminToken ? hashToken(adminToken) : undefined;

  const playerToken = body.callerPlayerId
    ? cookieStore.get(cookieNames.playerToken(gameId))?.value
    : undefined;
  const playerTokenHash = playerToken ? hashToken(playerToken) : undefined;

  try {
    await fetchMutation(api.games.setAutoReveal, {
      gameId,
      autoReveal: body.autoReveal,
      adminTokenHash,
      callerPlayerId: body.callerPlayerId,
      playerTokenHash,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = getConvexErrorCode(error);
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to update autoReveal' },
      { status: 500 }
    );
  }
}
