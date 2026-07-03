import { describe, expect, it } from 'vitest';
import type { GameCommand } from '../../sim/commands';
import { eventLogHash, runReplay, stateHash } from '../../sim/replay';
import { createInitialState } from '../../sim/state';

describe('Pass 2 replay hashing', () => {
  it('AT-014 produces stable final state and event hashes', () => {
    const playerId = createInitialState({ startInGameplay: true }).teams.home.controlledPlayerId;
    const commands: GameCommand[] = [
      { type: 'move', playerId, direction: { x: 1, y: 0 }, tick: 1 },
      { type: 'move', playerId, direction: { x: 1, y: 1 }, tick: 2 },
      { type: 'pass', playerId, target: 'home-w', tick: 12 },
      { type: 'switchPlayer', teamId: 'home', targetPlayerId: 'home-w', tick: 13 },
    ];
    const log = { initialConfig: { seed: 17, startInGameplay: true }, commands, ticks: 120 };

    const first = runReplay(log);
    const second = runReplay(log);

    expect(stateHash(second)).toBe(stateHash(first));
    expect(eventLogHash(second.events)).toBe(eventLogHash(first.events));
  });

  it('keeps AI-enabled replay deterministic', () => {
    const log = {
      initialConfig: { seed: 29, startInGameplay: true, enableAi: true },
      commands: [
        { type: 'move' as const, playerId: 'home-c', direction: { x: 1, y: 0 }, tick: 1 },
        { type: 'switchPlayer' as const, teamId: 'home', tick: 45 },
        { type: 'move' as const, playerId: 'home-w', direction: { x: 1, y: -1 }, tick: 46 },
      ],
      ticks: 180,
    };

    const first = runReplay(log);
    const second = runReplay(log);

    expect(stateHash(second)).toBe(stateHash(first));
    expect(eventLogHash(second.events)).toBe(eventLogHash(first.events));
  });
});
