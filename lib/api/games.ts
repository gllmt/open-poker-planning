import type { Game, NewGame } from '@/types/game';
import type { Player } from '@/types/player';

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

export async function createGame(
  payload: NewGame
): Promise<{ gameId: string; joinToken: string; playerId: string }> {
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
): Promise<{ playerId: string }> {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, playerName }),
  });
  return jsonOrThrow(res);
}

export async function fetchGameState(params: {
  gameId: string;
  token?: string;
  playerId?: string;
}): Promise<{ game: Game; players: Player[] }> {
  const url = new URL(
    `/api/games/${encodeURIComponent(params.gameId)}`,
    window.location.origin
  );
  if (params.token) url.searchParams.set('token', params.token);
  if (params.playerId) url.searchParams.set('playerId', params.playerId);

  const res = await fetch(url.toString(), { method: 'GET' });
  return jsonOrThrow(res);
}

export async function vote(
  gameId: string,
  playerId: string,
  value: number,
  emoji?: string
) {
  const res = await fetch(
    `/api/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(playerId)}/vote`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value, emoji }),
    }
  );
  return jsonOrThrow<{ ok: true }>(res);
}

export async function reveal(gameId: string, callerPlayerId?: string) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callerPlayerId }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function reset(gameId: string, callerPlayerId?: string) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callerPlayerId }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function deleteGame(gameId: string, callerPlayerId?: string) {
  const url = new URL(
    `/api/games/${encodeURIComponent(gameId)}`,
    window.location.origin
  );
  if (callerPlayerId) url.searchParams.set('callerPlayerId', callerPlayerId);
  const res = await fetch(url.toString(), { method: 'DELETE' });
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

export async function removePlayer(
  gameId: string,
  playerId: string,
  callerPlayerId?: string
) {
  const res = await fetch(
    `/api/games/${encodeURIComponent(gameId)}/players/${encodeURIComponent(playerId)}`,
    {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callerPlayerId }),
    }
  );
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

export async function updateStory(
  gameId: string,
  storyName: string,
  callerPlayerId: string
) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/story`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ storyName, callerPlayerId }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function setAutoReveal(
  gameId: string,
  autoReveal: boolean,
  callerPlayerId?: string
) {
  const res = await fetch(
    `/api/games/${encodeURIComponent(gameId)}/auto-reveal`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autoReveal, callerPlayerId }),
    }
  );
  return jsonOrThrow<{ ok: true }>(res);
}

export async function updateTimer(
  gameId: string,
  timerProps: unknown,
  callerPlayerId?: string
) {
  const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/timer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ timerProps, callerPlayerId }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}
