import { fetchQuery } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;

  if (!playerToken) {
    return NextResponse.json({ state: 'missing' as const });
  }

  const playerTokenHash = hashToken(playerToken);
  const viewerState = await fetchQuery(api.games.getViewerGameState, {
    gameId,
    playerTokenHash,
  });

  if (viewerState.type === 'ready') {
    return NextResponse.json({
      state: 'active' as const,
      playerId: viewerState.currentPlayerId,
    });
  }

  if (viewerState.type === 'not_found') {
    return NextResponse.json({ state: 'not_found' as const });
  }

  return NextResponse.json({
    state: 'revoked' as const,
    reason: viewerState.reason,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const cookieStore = await cookies();
  cookieStore.delete(cookieNames.playerToken(gameId));
  return new NextResponse(null, { status: 204 });
}
