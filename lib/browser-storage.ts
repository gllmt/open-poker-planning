import {
  isTheme,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme/constants';
import type { PlayerGame } from '@/types/player';

const PLAYER_GAMES_KEY = 'playerGames';
const RECENT_PLAYER_NAME_KEY = 'recentPlayerName';
const HASH_SUFFIX = 'TokenHash';
const STRIPPED_PLAYER_GAME_KEYS = [
  'joinToken',
  `join${HASH_SUFFIX}`,
  `player${HASH_SUFFIX}`,
  `admin${HASH_SUFFIX}`,
] as const;

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function safeGetCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${escapedName}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function safeSetCookie(name: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!('cookieStore' in window)) return;
    void window.cookieStore.set({
      name,
      value,
      path: '/',
      expires: Date.now() + THEME_COOKIE_MAX_AGE_SECONDS * 1000,
      sameSite: 'lax',
    });
  } catch {}
}

export function getRecentPlayerName(): string | null {
  return safeGetItem(RECENT_PLAYER_NAME_KEY);
}

export function setRecentPlayerName(name: string) {
  safeSetItem(RECENT_PLAYER_NAME_KEY, name);
}

export function getStoredTheme(): Theme | null {
  const storageValue = safeGetItem(THEME_STORAGE_KEY);
  if (isTheme(storageValue)) return storageValue;

  const cookieValue = safeGetCookie(THEME_COOKIE_NAME);
  return isTheme(cookieValue) ? cookieValue : null;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

export function setTheme(theme: Theme) {
  safeSetItem(THEME_STORAGE_KEY, theme);
  safeSetCookie(THEME_COOKIE_NAME, theme);
}

export function getPlayerGamesFromCache(): PlayerGame[] {
  const raw = safeGetItem(PLAYER_GAMES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    let stripped = false;
    const cleaned = parsed.map((entry) => {
      if (typeof entry !== 'object' || entry === null) return entry;

      const record = entry as Record<string, unknown>;
      if (!STRIPPED_PLAYER_GAME_KEYS.some((key) => key in record)) {
        return entry;
      }

      stripped = true;
      const next = { ...record };
      for (const key of STRIPPED_PLAYER_GAME_KEYS) {
        delete next[key];
      }
      return next;
    }) as PlayerGame[];

    if (stripped) updatePlayerGamesInCache(cleaned);
    return cleaned;
  } catch {
    return [];
  }
}

function updatePlayerGamesInCache(playerGames: PlayerGame[]) {
  safeSetItem(PLAYER_GAMES_KEY, JSON.stringify(playerGames));
}

export function upsertPlayerGame(game: PlayerGame) {
  const games = getPlayerGamesFromCache();
  const next = [game, ...games.filter((g) => g.id !== game.id)].slice(0, 20);
  updatePlayerGamesInCache(next);
}

export function clearPlayerGameSession(gameId: string) {
  updatePlayerGamesInCache(
    getPlayerGamesFromCache().map((game) =>
      game.id === gameId
        ? {
            ...game,
            playerId: '',
          }
        : game
    )
  );
}
