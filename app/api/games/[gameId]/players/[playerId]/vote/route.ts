import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

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
  if (!playerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const playerTokenHash = hashToken(playerToken);

  try {
    await fetchMutation(api.games.vote, {
      gameId,
      playerId,
      playerTokenHash,
      value: body.value,
      emoji: body.emoji,
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
    if (code === 'GAME_FINISHED') {
      return NextResponse.json({ error: 'Game is finished' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
  }
}
