import 'server-only';

import { hashToken, safeEqual } from './tokens';

export function tokenMatchesHash(token: string, expectedHash: string): boolean {
  const actualHash = hashToken(token);
  return safeEqual(actualHash, expectedHash);
}
