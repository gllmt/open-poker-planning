import { describe, expect, it } from 'vitest';

import {
  isAutoRevealBroadcastPayload,
  isGameStatusBroadcastPayload,
  isPlayerJoinedBroadcastPayload,
  isStoryUpdatedBroadcastPayload,
  isTimerBroadcastPayload,
  isVoteBroadcastPayload,
} from '@/lib/broadcast/guards';
import { Status } from '@/types/status';

describe('broadcast payload guards', () => {
  it('accepts valid vote payloads', () => {
    const payload = {
      type: 'vote',
      player: { id: 'player-1', status: Status.Finished, value: 5 },
      game: { gameStatus: Status.InProgress, timerProps: { startedAt: null } },
    };
    expect(isVoteBroadcastPayload(payload)).toBe(true);
  });

  it('rejects vote payloads with invalid timerProps', () => {
    const payload = {
      type: 'vote',
      player: { id: 'player-1', status: Status.Finished },
      game: { gameStatus: Status.InProgress, timerProps: 42 },
    };
    expect(isVoteBroadcastPayload(payload)).toBe(false);
  });

  it('accepts timer payloads with null timerProps', () => {
    const payload = { type: 'timer_updated', game: { timerProps: null } };
    expect(isTimerBroadcastPayload(payload)).toBe(true);
  });

  it('accepts reset payloads with game status updates', () => {
    const payload = {
      type: 'reset',
      game: { gameStatus: Status.Started },
      players: { reset: true },
    };
    expect(isGameStatusBroadcastPayload(payload)).toBe(true);
  });

  it('rejects player_joined payloads with invalid status', () => {
    const payload = {
      type: 'player_joined',
      player: { id: 'player-1', name: 'Dana', status: 'Unknown' },
    };
    expect(isPlayerJoinedBroadcastPayload(payload)).toBe(false);
  });

  it('accepts story_updated payloads with null storyName', () => {
    const payload = { type: 'story_updated', game: { storyName: null } };
    expect(isStoryUpdatedBroadcastPayload(payload)).toBe(true);
  });

  it('rejects auto_reveal payloads with non-boolean', () => {
    const payload = {
      type: 'auto_reveal_updated',
      game: { autoReveal: 'yes' },
    };
    expect(isAutoRevealBroadcastPayload(payload)).toBe(false);
  });
});
