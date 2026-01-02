import type { PlayerGame } from '@/types/player';

const PLAYER_GAMES_KEY = 'playerGames';
const RECENT_PLAYER_NAME_KEY = 'recentPlayerName';
const THEME_KEY = 'theme';

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

export function getRecentPlayerName(): string | null {
  return safeGetItem(RECENT_PLAYER_NAME_KEY);
}

export function setRecentPlayerName(name: string) {
  safeSetItem(RECENT_PLAYER_NAME_KEY, name);
}

export function getStoredTheme(): 'light' | 'dark' | null {
  const value = safeGetItem(THEME_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getTheme(): 'light' | 'dark' {
  return getStoredTheme() ?? getSystemTheme();
}

export function setTheme(theme: 'light' | 'dark') {
  safeSetItem(THEME_KEY, theme);
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
  return games.find((g) => g.id === gameId)?.playerId;
}

export function upsertPlayerGame(game: PlayerGame) {
  const games = getPlayerGamesFromCache();
  const next = [game, ...games.filter((g) => g.id !== game.id)].slice(0, 20);
  updatePlayerGamesInCache(next);
}

export function removePlayerGame(gameId: string) {
  updatePlayerGamesInCache(
    getPlayerGamesFromCache().filter((g) => g.id !== gameId)
  );
}
