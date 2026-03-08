import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { generateToken, hashToken } from '@/lib/security/tokens';

type InviteBody = {
  callerPlayerId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as InviteBody;
  if (!body.callerPlayerId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
  if (!playerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminToken = cookieStore.get(cookieNames.adminToken(gameId))?.value;
  const inviteToken = generateToken();

  try {
    await fetchMutation(api.games.createInvite, {
      gameId,
      tokenHash: hashToken(inviteToken),
      createdByPlayerId: body.callerPlayerId,
      playerTokenHash: hashToken(playerToken),
      adminTokenHash: adminToken ? hashToken(adminToken) : undefined,
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
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }

  return NextResponse.json({ token: inviteToken }, { status: 201 });
}
