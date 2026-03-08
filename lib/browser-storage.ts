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

export function getSystemTheme(): Theme {
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
    const parsed = JSON.parse(raw) as PlayerGame[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updatePlayerGamesInCache(playerGames: PlayerGame[]) {
  safeSetItem(PLAYER_GAMES_KEY, JSON.stringify(playerGames));
}

export function getCurrentPlayerId(gameId: string): string | undefined {
  const games = getPlayerGamesFromCache();
  const playerId = games.find((g) => g.id === gameId)?.playerId;
  return playerId || undefined;
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
            joinToken: undefined,
            joinTokenHash: undefined,
            playerTokenHash: undefined,
            adminTokenHash: undefined,
          }
        : game
    )
  );
}

export function removePlayerGame(gameId: string) {
  updatePlayerGamesInCache(
    getPlayerGamesFromCache().filter((g) => g.id !== gameId)
  );
}
