import { fetchMutation } from 'convex/nextjs';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { api } from '@/convex/_generated/api';
import { getConvexErrorCode } from '@/lib/convex/errors';
import { cookieNames } from '@/lib/security/cookies';
import { hashToken } from '@/lib/security/tokens';

type StoryBody = {
  storyName: string;
  callerPlayerId: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as StoryBody | null;
  if (!body?.callerPlayerId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(cookieNames.playerToken(gameId))?.value;
  if (!playerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const playerTokenHash = hashToken(playerToken);

  try {
    await fetchMutation(api.games.updateStory, {
      gameId,
      callerPlayerId: body.callerPlayerId,
      playerTokenHash,
      storyName: body.storyName ?? '',
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
      { error: 'Failed to update story' },
      { status: 500 }
    );
  }
}
