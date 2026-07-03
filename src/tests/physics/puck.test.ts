import { describe, expect, it } from 'vitest';
import { advanceTick } from '../../sim/loop';
import { createInitialState, type GameState } from '../../sim/state';
import { length } from '../../sim/vector';

describe('Pass 2 puck physics', () => {
  it('AT-009 keeps a 45 degree bank pass repeatable', () => {
    const first = runTicks(bankFixture(), 240);
    const second = runTicks(bankFixture(), 240);

    expect(second.puck.position).toEqual(first.puck.position);
    expect(second.puck.velocity).toEqual(first.puck.velocity);
    expect(second.events).toEqual(first.events);
  });

  it('AT-010 monotonically removes loose-puck energy through friction', () => {
    let state = noPickupFixture({
      position: { x: 0, y: 0 },
      velocity: { x: 18, y: 0 },
    });
    let previousSpeed = length(state.puck.velocity);

    for (let i = 0; i < 240; i += 1) {
      state = advanceTick(state).state;
      const speed = length(state.puck.velocity);
      expect(speed).toBeLessThanOrEqual(previousSpeed + 1e-9);
      previousSpeed = speed;
    }

    expect(length(state.puck.velocity)).toBe(0);
  });

  it('reflects the puck from goal posts with reduced speed', () => {
    const state = noPickupFixture({
      position: { x: 88.9, y: 3 },
      velocity: { x: 20, y: 0 },
    });
    const beforeSpeed = length(state.puck.velocity);
    const after = advanceTick(state).state;

    expect(after.puck.position.x).toBeLessThanOrEqual(90.1);
    expect(length(after.puck.velocity)).toBeLessThan(beforeSpeed);
  });
});

function bankFixture() {
  return noPickupFixture({
    position: { x: 0, y: 35 },
    velocity: { x: 36, y: 36 },
  });
}

function noPickupFixture(puck: { position: { x: number; y: number }; velocity: { x: number; y: number } }): GameState {
  const state = createInitialState({ seed: 3, startInGameplay: true });
  return {
    ...state,
    teams: {
      home: {
        ...state.teams.home,
        roster: state.teams.home.roster.map((player) => ({ ...player, possessionEligible: false })),
      },
      away: {
        ...state.teams.away,
        roster: state.teams.away.roster.map((player) => ({ ...player, possessionEligible: false })),
      },
    },
    puck: {
      ...state.puck,
      ...puck,
      ownerId: undefined,
      state: 'loose',
      intent: 'pass',
      receiveWindow: undefined,
      repossessLockout: undefined,
    },
  };
}

function runTicks(state: GameState, ticks: number) {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = advanceTick(current).state;
  }
  return current;
}
