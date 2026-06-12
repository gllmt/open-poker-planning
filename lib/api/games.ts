import type { NewGame } from '@/types/game';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const errorValue =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>).error
        : undefined;
    const message =
      (typeof errorValue === 'string' ? errorValue : null) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  if (!data) throw new Error('Invalid server response');
  return data as T;
}

export async function createGame(payload: NewGame): Promise<{
  gameId: string;
  playerId: string;
}> {
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      createdBy: payload.createdBy,
      gameType: payload.gameType,
      cards: payload.cards,
      isAllowMembersToManageSession: payload.isAllowMembersToManageSession,
    }),
  });
  return jsonOrThrow(res);
}

export async function joinGame(
  gameId: string,
  token: string,
  playerName: string
): Promise<{
  playerId: string;
}> {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, playerName }),
  });
  return jsonOrThrow(res);
}

export async function createInvite(
  gameId: string,
  callerPlayerId: string
): Promise<{ token: string }> {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/invite`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callerPlayerId }),
  });
  return jsonOrThrow(res);
}

export async function clearGameSession(gameId: string) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/session`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
}

export async function leaveGame(gameId: string, callerPlayerId: string) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/leave`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callerPlayerId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const errorValue =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>).error
        : undefined;
    const message =
      (typeof errorValue === 'string' ? errorValue : null) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
}
