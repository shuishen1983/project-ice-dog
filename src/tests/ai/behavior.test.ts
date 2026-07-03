import { describe, expect, it } from 'vitest';
import { createAiCommands, updateGoaliePositions } from '../../ai/behavior';
import { FACE_OFF, RINK } from '../../sim/constants';
import { advanceTick } from '../../sim/loop';
import { createInitialState, type GameState } from '../../sim/state';

describe('Pass 3 team AI and goalie behavior', () => {
  it('AT-011 recognizes a one-timer opportunity and shoots', () => {
    const state = oneTimerAiFixture();
    const after = advanceTick(state).state;

    expect(after.puck.intent).toBe('shot');
    expect(after.puck.lastTouchPlayerId).toBe('home-w');
    expect(after.puck.ownerId).toBeUndefined();
  });

  it('AT-012 dumps the puck when pressured and lanes are blocked', () => {
    const commands = createAiCommands(dumpFixture(), 1);

    expect(commands).toContainEqual(
      expect.objectContaining({
        type: 'dump',
        playerId: 'away-c',
        source: 'ai',
      }),
    );
  });

  it('AT-013 assigns one defender to pressure and another to protect the slot', () => {
    const commands = createAiCommands(defenseFixture(), 1);
    const pressure = commands.find((command) => command.type === 'move' && command.playerId === 'away-c');
    const slot = commands.find((command) => command.type === 'move' && command.playerId === 'away-d');

    expect(pressure).toEqual(expect.objectContaining({ direction: expect.objectContaining({ x: expect.any(Number) }) }));
    expect(pressure?.type === 'move' ? pressure.direction.x : 0).toBeLessThan(0);
    expect(slot?.type === 'move' ? slot.direction.x : 0).toBeGreaterThan(0);
  });

  it('moves goalies along the crease toward puck threat', () => {
    const state = {
      ...createInitialState({ seed: 1, startInGameplay: true, enableAi: true }),
      puck: {
        ...createInitialState({ seed: 1, startInGameplay: true, enableAi: true }).puck,
        position: { x: -80, y: 20 },
        ownerId: undefined,
        state: 'loose' as const,
      },
    };
    const before = state.teams.home.goalie.position.y;
    const after = updateGoaliePositions(state);

    expect(after.teams.home.goalie.position.y).toBeGreaterThan(before);
  });

  it('challenges forward within the crease as the shooter approaches', () => {
    let state = createInitialState({ seed: 1, startInGameplay: true, enableAi: true });
    state = {
      ...state,
      puck: { ...state.puck, position: { x: -70, y: 0 }, ownerId: undefined, state: 'loose' as const },
    };

    for (let i = 0; i < 240; i += 1) {
      state = updateGoaliePositions(state);
    }

    const goalie = state.teams.home.goalie;
    const anchorX = -(RINK.goalLineX - 2);
    expect(goalie.position.x).toBeGreaterThan(anchorX);
    const fromGoal = Math.hypot(goalie.position.x + RINK.goalLineX, goalie.position.y);
    expect(fromGoal).toBeLessThanOrEqual(RINK.creaseRadius - goalie.radius + 1e-6);
  });

  it('retreats to hug the near post when the puck is behind the goal', () => {
    let state = createInitialState({ seed: 1, startInGameplay: true, enableAi: true });
    state = {
      ...state,
      puck: { ...state.puck, position: { x: -95, y: 8 }, ownerId: undefined, state: 'loose' as const },
    };

    for (let i = 0; i < 240; i += 1) {
      state = updateGoaliePositions(state);
    }

    const goalie = state.teams.home.goalie;
    expect(goalie.position.x).toBeGreaterThanOrEqual(-RINK.goalLineX);
    expect(goalie.position.x).toBeLessThan(-RINK.goalLineX + 3);
    expect(goalie.position.y).toBeGreaterThan(0);
    expect(goalie.position.y).toBeLessThanOrEqual(RINK.goalMouthWidth / 2 + 1e-6);
  });

  it('creates deterministic AI faceoff swipe commands', () => {
    const state = createInitialState({ seed: 11, enableAi: true });
    const tick = FACE_OFF.countdownTicks + 12;
    const first = createAiCommands(state, tick);
    const second = createAiCommands(state, tick);

    expect(first).toEqual(second);
    expect(first).toContainEqual(
      expect.objectContaining({
        type: 'pokeCheck',
        playerId: 'away-c',
        source: 'ai',
      }),
    );
  });
});

function oneTimerAiFixture(): GameState {
  const state = createInitialState({ seed: 5, startInGameplay: true, enableAi: true });
  return {
    ...state,
    puck: {
      ...state.puck,
      position: { x: -30, y: -18 },
      velocity: { x: 8, y: 0 },
      ownerId: undefined,
      state: 'loose',
      intent: 'pass',
      receiveWindow: { targetPlayerId: 'home-w', untilTick: 20 },
      repossessLockout: undefined,
    },
  };
}

function dumpFixture(): GameState {
  const state = createInitialState({ seed: 2, startInGameplay: true, enableAi: true });
  return {
    ...state,
    teams: {
      home: {
        ...state.teams.home,
        roster: state.teams.home.roster.map((player) => {
          if (player.id === 'home-c') return { ...player, position: { x: 4, y: 0 } };
          if (player.id === 'home-w') return { ...player, position: { x: 25, y: -8 } };
          return { ...player, position: { x: 20, y: 9 } };
        }),
      },
      away: {
        ...state.teams.away,
        roster: state.teams.away.roster.map((player) => {
          if (player.id === 'away-c') return { ...player, position: { x: 10, y: 0 } };
          if (player.id === 'away-w') return { ...player, position: { x: 30, y: 18 } };
          return { ...player, position: { x: 44, y: -18 } };
        }),
      },
    },
    puck: {
      ...state.puck,
      position: { x: 13.2, y: 0 },
      ownerId: 'away-c',
      state: 'held',
      lastTouchPlayerId: 'away-c',
      lastTouchTeamId: 'away',
    },
  };
}

function defenseFixture(): GameState {
  const state = createInitialState({ seed: 3, startInGameplay: true, enableAi: true });
  return {
    ...state,
    teams: {
      ...state.teams,
      home: {
        ...state.teams.home,
        roster: state.teams.home.roster.map((player) =>
          player.id === 'home-c' ? { ...player, position: { x: -10, y: 0 } } : player,
        ),
      },
      away: {
        ...state.teams.away,
        roster: state.teams.away.roster.map((player) => {
          if (player.id === 'away-c') return { ...player, position: { x: 0, y: 0 } };
          if (player.id === 'away-d') return { ...player, position: { x: 40, y: 0 } };
          return { ...player, position: { x: 20, y: 20 } };
        }),
      },
    },
    puck: {
      ...state.puck,
      position: { x: -6.8, y: 0 },
      ownerId: 'home-c',
      state: 'held',
      lastTouchPlayerId: 'home-c',
      lastTouchTeamId: 'home',
    },
    rink: RINK,
  };
}
