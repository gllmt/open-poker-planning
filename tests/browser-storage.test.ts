import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPlayerGameSession,
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { RETENTION_MS } from '@/lib/retention';

const PLAYER_GAMES_KEY = 'playerGames';
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function createLocalStorage() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

function installLocalStorage(localStorage: Storage) {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });
}

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
    return;
  }
  Reflect.deleteProperty(globalThis, 'window');
});

describe('browser player-game cache', () => {
  it('expires dated entries without assuming an age for legacy entries', () => {
    const localStorage = createLocalStorage();
    installLocalStorage(localStorage);
    localStorage.setItem(
      PLAYER_GAMES_KEY,
      JSON.stringify([
        { id: 'old', lastVisitedAt: Date.now() - RETENTION_MS },
        { id: 'recent', lastVisitedAt: Date.now() },
        { id: 'legacy' },
      ])
    );
    expect(getPlayerGamesFromCache().map((entry) => entry.id)).toEqual([
      'recent',
      'legacy',
    ]);
    expect(localStorage.getItem(PLAYER_GAMES_KEY)).not.toContain('"old"');
    upsertPlayerGame({
      id: 'legacy',
      name: 'Sprint',
      createdBy: 'Alice',
      createdById: 'alice',
      playerId: 'alice',
    });
    expect(getPlayerGamesFromCache()[0].lastVisitedAt).toBeGreaterThan(0);
  });
  it('strips legacy credential fields and rewrites the cache', () => {
    const localStorage = createLocalStorage();
    installLocalStorage(localStorage);
    localStorage.setItem(
      PLAYER_GAMES_KEY,
      JSON.stringify([
        {
          id: 'game-1',
          name: 'Planning',
          createdById: 'player-alice',
          createdBy: 'Alice',
          playerId: 'player-alice',
          joinToken: 'plain-token',
          joinTokenHash: 'join-hash',
          playerTokenHash: 'player-hash',
          adminTokenHash: 'admin-hash',
          isAllowMembersToManageSession: true,
        },
      ])
    );

    expect(getPlayerGamesFromCache()).toEqual([
      {
        id: 'game-1',
        name: 'Planning',
        createdById: 'player-alice',
        createdBy: 'Alice',
        playerId: 'player-alice',
        isAllowMembersToManageSession: true,
      },
    ]);
    expect(localStorage.getItem(PLAYER_GAMES_KEY)).not.toContain('TokenHash');
    expect(localStorage.getItem(PLAYER_GAMES_KEY)).not.toContain('joinToken');
  });

  it('returns clean cache entries without rewriting them', () => {
    const localStorage = createLocalStorage();
    installLocalStorage(localStorage);
    const cleanValue = JSON.stringify([
      {
        id: 'game-1',
        name: 'Planning',
        createdById: 'player-alice',
        createdBy: 'Alice',
        playerId: 'player-alice',
      },
    ]);
    localStorage.setItem(PLAYER_GAMES_KEY, cleanValue);

    expect(getPlayerGamesFromCache()).toEqual([
      {
        id: 'game-1',
        name: 'Planning',
        createdById: 'player-alice',
        createdBy: 'Alice',
        playerId: 'player-alice',
      },
    ]);
    expect(localStorage.getItem(PLAYER_GAMES_KEY)).toBe(cleanValue);
  });

  it('returns an empty list for malformed cache JSON', () => {
    const localStorage = createLocalStorage();
    installLocalStorage(localStorage);
    localStorage.setItem(PLAYER_GAMES_KEY, '{broken');

    expect(getPlayerGamesFromCache()).toEqual([]);
  });

  it('clears only the current player id on session exit', () => {
    const localStorage = createLocalStorage();
    installLocalStorage(localStorage);
    localStorage.setItem(
      PLAYER_GAMES_KEY,
      JSON.stringify([
        {
          id: 'game-1',
          name: 'Planning',
          createdById: 'player-alice',
          createdBy: 'Alice',
          playerId: 'player-alice',
        },
      ])
    );

    clearPlayerGameSession('game-1');

    expect(getPlayerGamesFromCache()).toEqual([
      {
        id: 'game-1',
        name: 'Planning',
        createdById: 'player-alice',
        createdBy: 'Alice',
        playerId: '',
      },
    ]);
  });
});
