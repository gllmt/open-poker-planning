import { fetchMutation } from 'convex/nextjs';
import { NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames, cookieOptions } from '@/lib/security/cookies';
import { generateToken, hashToken } from '@/lib/security/tokens';

// Mirror the authoritative bounds enforced in convex/games.ts so we can return
// a clean 400 before hitting the backend.
const MAX = {
  name: 120,
  createdBy: 80,
  gameType: 40,
  cards: 60,
} as const;

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
    typeof body?.name !== 'string' ||
    typeof body?.createdBy !== 'string' ||
    typeof body?.gameType !== 'string' ||
    !Array.isArray(body.cards)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (
    body.name.trim() === '' ||
    body.createdBy.trim() === '' ||
    body.name.length > MAX.name ||
    body.createdBy.length > MAX.createdBy ||
    body.gameType.length > MAX.gameType ||
    body.cards.length === 0 ||
    body.cards.length > MAX.cards
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

  try {
    await fetchMutation(api.games.createGame, {
      gameId,
      name: body.name,
      createdBy: body.createdBy,
      createdById,
      gameType: body.gameType,
      cards: body.cards,
      isAllowMembersToManageSession: Boolean(
        body.isAllowMembersToManageSession
      ),
      joinTokenHash,
      adminTokenHash,
      playerTokenHash,
    });
  } catch (error) {
    if (getConvexErrorCode(error) === 'INVALID_INPUT') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }

  const response = NextResponse.json(
    {
      gameId,
      joinToken,
      joinTokenHash,
      playerId: createdById,
      playerTokenHash,
      adminTokenHash,
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
