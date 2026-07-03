import { describe, expect, it } from 'vitest';
import { FACE_OFF, GOALIE, PUCK, RINK } from '../../sim/constants';
import { advanceTick } from '../../sim/loop';
import { createInitialState, type GameState } from '../../sim/state';
import { length } from '../../sim/vector';

describe('Pass 2 deterministic puck physics and replay acceptance', () => {
  it('AT-007 pass receive changes possession deterministically', () => {
    const first = advanceTick(receiveFixture()).state;
    const second = advanceTick(receiveFixture()).state;

    expect(first.puck.ownerId).toBe('home-w');
    expect(second.puck.ownerId).toBe('home-w');
    expect(second.events).toEqual(first.events);
  });

  it('AT-008 releases a one-timer shot without settled possession', () => {
    const state = oneTimerFixture();
    const after = advanceTick(state, [
      { type: 'shoot', playerId: 'home-w', target: { x: RINK.goalLineX, y: 0 }, tick: state.tick + 1 },
    ]).state;

    expect(after.puck.ownerId).toBeUndefined();
    expect(after.puck.intent).toBe('shot');
    expect(after.puck.lastTouchPlayerId).toBe('home-w');
    expect(length(after.puck.velocity)).toBeGreaterThan(50);
  });

  it('AT-017 faceoff contest is deterministic across identical runs', () => {
    const first = resolveFaceoffFixture();
    const second = resolveFaceoffFixture();

    expect(second.puck.position).toEqual(first.puck.position);
    expect(second.puck.velocity).toEqual(first.puck.velocity);
    expect(second.events.filter((event) => event.type === 'faceoffWon')).toEqual(
      first.events.filter((event) => event.type === 'faceoffWon'),
    );
  });

  it('AT-018 contested pickup uses closest skater then team/player id tie-breaks', () => {
    const closest = advanceTick(contestedPickupFixture({ homeX: -2, awayX: 4 })).state;
    expect(closest.puck.ownerId).toBe('home-c');

    const tie = advanceTick(contestedPickupFixture({ homeX: -4, awayX: 4 })).state;
    expect(tie.puck.ownerId).toBe('away-c');
  });

  it('AT-019 traps slow goalie saves and releases to a defender', () => {
    let state = goalieShotFixture({ velocity: { x: -12, y: 0 } });
    state = advanceTick(state).state;

    expect(state.events.some((event) => event.type === 'goalieSave' && event.trapped)).toBe(true);
    expect(state.puck.goalieHold?.goalieId).toBe('home-g');

    for (let i = 0; i < GOALIE.holdTicks; i += 1) {
      state = advanceTick(state).state;
    }

    expect(state.puck.ownerId).toBe('home-d');
  });

  it('AT-019 rebounds fast goalie saves deterministically', () => {
    const first = advanceTick(goalieShotFixture({ velocity: { x: -70, y: 0 } })).state;
    const second = advanceTick(goalieShotFixture({ velocity: { x: -70, y: 0 } })).state;

    expect(first.events.some((event) => event.type === 'goalieSave' && !event.trapped)).toBe(true);
    expect(second.puck.position).toEqual(first.puck.position);
    expect(second.puck.velocity).toEqual(first.puck.velocity);
    expect(first.puck.intent).toBe('rebound');
  });
});

function receiveFixture(): GameState {
  const state = createInitialState({ seed: 5, startInGameplay: true });
  return {
    ...state,
    puck: {
      ...state.puck,
      position: { x: -30, y: -18 },
      velocity: { x: 0, y: 0 },
      ownerId: undefined,
      state: 'loose',
      intent: 'pass',
      receiveWindow: { targetPlayerId: 'home-w', untilTick: 20 },
      repossessLockout: undefined,
    },
  };
}

function oneTimerFixture(): GameState {
  const state = createInitialState({ seed: 7, startInGameplay: true });
  return {
    ...state,
    puck: {
      ...state.puck,
      position: { x: -30, y: -18 },
      velocity: { x: 8, y: 0 },
      ownerId: undefined,
      state: 'loose',
      intent: 'pass',
      ageTicks: 4,
      receiveWindow: { targetPlayerId: 'home-w', untilTick: PUCK.oneTimerWindowTicks + 1 },
      repossessLockout: undefined,
    },
  };
}

function resolveFaceoffFixture(): GameState {
  let state = createInitialState({ seed: 11 });
  for (let i = 0; i < FACE_OFF.countdownTicks; i += 1) {
    state = advanceTick(state).state;
  }
  return advanceTick(state, [
    { type: 'pokeCheck', playerId: 'home-c', direction: { x: -1, y: 0 }, tick: state.tick + 1 },
  ]).state;
}

function contestedPickupFixture({ homeX, awayX }: { homeX: number; awayX: number }): GameState {
  const state = createInitialState({ seed: 2, startInGameplay: true });
  return {
    ...state,
    teams: {
      home: {
        ...state.teams.home,
        roster: state.teams.home.roster.map((player) =>
          player.id === 'home-c' ? { ...player, position: { x: homeX, y: -4 }, velocity: { x: 0, y: 0 } } : player,
        ),
      },
      away: {
        ...state.teams.away,
        roster: state.teams.away.roster.map((player) =>
          player.id === 'away-c' ? { ...player, position: { x: awayX, y: -4 }, velocity: { x: 0, y: 0 } } : player,
        ),
      },
    },
    puck: {
      ...state.puck,
      position: { x: 0, y: -4 },
      velocity: { x: 0, y: 0 },
      ownerId: undefined,
      state: 'loose',
      intent: 'loose',
      repossessLockout: undefined,
      receiveWindow: undefined,
    },
  };
}

function goalieShotFixture({ velocity }: { velocity: { x: number; y: number } }): GameState {
  const state = createInitialState({ seed: 23, startInGameplay: true });
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
      position: { x: -85.5, y: 0 },
      velocity,
      ownerId: undefined,
      state: 'loose',
      intent: 'shot',
      lastTouchPlayerId: 'away-c',
      lastTouchTeamId: 'away',
      receiveWindow: undefined,
      repossessLockout: undefined,
    },
  };
}
