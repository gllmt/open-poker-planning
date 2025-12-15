import 'server-only';

export const cookieNames = {
  adminToken: (gameId: string) => `pp_admin_${gameId}`,
  playerToken: (gameId: string) => `pp_player_${gameId}`,
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
