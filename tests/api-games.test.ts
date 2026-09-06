import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';

const { mutation, getCookie } = vi.hoisted(() => ({
  mutation: vi.fn(),
  getCookie: vi.fn(),
}));
vi.mock('convex/nextjs', () => ({ fetchMutation: mutation }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: getCookie, delete: vi.fn() }),
}));
vi.mock('@/lib/security/convex-service', () => ({
  getConvexServiceSecret: () => 'synthetic-service-secret',
}));
vi.mock('@/lib/security/tokens', () => ({
  generateToken: () => 'new-token',
  hashToken: (value: string) => `hash:${value}`,
}));
vi.mock('@/lib/security/cookies', () => ({
  cookieNames: { playerToken: () => 'player', adminToken: () => 'admin' },
  cookieOptions: { httpOnly: true, path: '/' },
}));
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: () => 'test',
  isRateLimited: () => false,
}));

import { POST as invite } from '@/app/api/games/[gameId]/invite/route';
import { POST as join } from '@/app/api/games/[gameId]/join/route';
import { POST as leave } from '@/app/api/games/[gameId]/leave/route';
import { POST as create } from '@/app/api/games/route';

const context = {
  params: Promise.resolve({ gameId: '00000000-0000-4000-8000-000000000001' }),
};
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/games', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.resetAllMocks());

it.each([null, [], 1, 'text', {}, { callerPlayerId: false }])(
  'rejects malformed invite/leave bodies: %j',
  async (body) => {
    expect((await invite(request(body), context)).status).toBe(400);
    expect((await leave(request(body), context)).status).toBe(400);
    expect(mutation).not.toHaveBeenCalled();
  }
);

it('rejects non-boolean management settings', async () => {
  const response = await create(
    request({
      name: 'Test',
      createdBy: 'Alice',
      gameType: 'Fibonacci',
      cards: [1],
      isAllowMembersToManageSession: 'false',
    })
  );
  expect(response.status).toBe(400);
  expect(mutation).not.toHaveBeenCalled();
});

it('keeps the credential of a reused session', async () => {
  getCookie.mockReturnValue({ value: 'existing-token' });
  mutation.mockResolvedValue({ playerId: 'existing-player', reused: true });
  const response = await join(
    request({ playerName: 'Bob', token: 'invite' }),
    context
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ playerId: 'existing-player' });
  expect(response.cookies.get('player')?.value).toBe('existing-token');
  expect(mutation).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      existingPlayerTokenHash: 'hash:existing-token',
      joinTokenHash: 'hash:invite',
    })
  );
});

it('sets a new credential when the old membership cannot be reused', async () => {
  getCookie.mockReturnValue({ value: 'old-token' });
  mutation.mockResolvedValue({ playerId: 'new-player', reused: false });
  const response = await join(
    request({ playerName: 'Bob', token: 'invite' }),
    context
  );
  expect(response.status).toBe(201);
  expect(response.cookies.get('player')?.value).toBe('new-token');
});
