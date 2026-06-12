import { fetchMutation } from 'convex/nextjs';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames, cookieOptions } from '@/lib/security/cookies';
import { getClientIp, isRateLimited } from '@/lib/security/rate-limit';
import { generateToken, hashToken } from '@/lib/security/tokens';

type JoinBody = {
  playerName: string;
  token: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const ip = getClientIp(request.headers);
  if (isRateLimited(`join-game:${gameId}:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as JoinBody | null;
  if (
    typeof body?.playerName !== 'string' ||
    body.playerName === '' ||
    typeof body?.token !== 'string' ||
    body.token === ''
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const playerId = crypto.randomUUID();
  const playerToken = generateToken();
  const playerTokenHash = hashToken(playerToken);
  const joinTokenHash = hashToken(body.token);

  try {
    await fetchMutation(api.games.joinGame, {
      gameId,
      playerId,
      playerName: body.playerName,
      playerTokenHash,
      joinTokenHash,
    });
  } catch (error) {
    const code = getConvexErrorCode(error);
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (code === 'INVALID_INVITE') {
      return NextResponse.json(
        { error: 'Invalid invite token' },
        { status: 403 }
      );
    }
    if (code === 'INVALID_INPUT') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
  }

  const response = NextResponse.json({ playerId }, { status: 201 });

  response.cookies.set(
    cookieNames.playerToken(gameId),
    playerToken,
    cookieOptions
  );
  return response;
}
