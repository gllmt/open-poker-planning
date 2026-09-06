import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { getConvexServiceSecret } from '@/lib/security/convex-service';
import { cookieNames, cookieOptions } from '@/lib/security/cookies';
import { getClientIp, isRateLimited } from '@/lib/security/rate-limit';
import { isValidUuid } from '@/lib/security/request-validation';
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
  const serviceSecret = getConvexServiceSecret();
  if (!serviceSecret) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const ip = getClientIp(request.headers);
  const validGameId = isValidUuid(gameId);
  if (
    isRateLimited({
      ip,
      scope: validGameId ? `join-game:${gameId}` : 'join-game:invalid-id',
      limit: 20,
      windowMs: 60_000,
    })
  ) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (!validGameId) {
    return NextResponse.json({ error: 'Invalid game id' }, { status: 400 });
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
  const cookieStore = await cookies();
  const existingPlayerToken = cookieStore.get(
    cookieNames.playerToken(gameId)
  )?.value;
  let joined: { playerId: string; reused: boolean };

  try {
    joined = await fetchMutation(api.games.joinGame, {
      serviceSecret,
      gameId,
      playerId,
      playerName: body.playerName,
      playerTokenHash,
      joinTokenHash,
      existingPlayerTokenHash: existingPlayerToken
        ? hashToken(existingPlayerToken)
        : undefined,
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
    if (code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      );
    }
    if (code === 'TOO_MANY_PLAYERS') {
      return NextResponse.json(
        { error: 'Too many players for this game' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
  }

  const response = NextResponse.json(
    { playerId: joined.playerId },
    { status: joined.reused ? 200 : 201 }
  );

  response.cookies.set(
    cookieNames.playerToken(gameId),
    joined.reused && existingPlayerToken ? existingPlayerToken : playerToken,
    cookieOptions
  );
  return response;
}
