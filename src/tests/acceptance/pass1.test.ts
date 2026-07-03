import { describe, expect, it } from 'vitest';
import { FACE_OFF, MODE_PAUSE, RINK, TICK_SECONDS } from '../../sim/constants';
import { advanceTick } from '../../sim/loop';
import type { GameState } from '../../sim/state';
import { createInitialState } from '../../sim/state';

describe('Pass 1 core rules and control', () => {
  it('AT-001 increments score exactly once for one goal crossing', () => {
    const initial = withPuckAtGoalLine(createInitialState({ startInGameplay: true }), 'home');

    let state = advanceTick(initial).state;
    expect(state.teams.home.score).toBe(1);
    expect(state.events.filter((event) => event.type === 'goal')).toHaveLength(1);

    for (let i = 0; i < 20; i += 1) {
      state = advanceTick(state).state;
    }

    expect(state.teams.home.score).toBe(1);
    expect(state.events.filter((event) => event.type === 'goal')).toHaveLength(1);
  });

  it('AT-002 resets to a paused faceoff after a goal', () => {
    let state = advanceTick(withPuckAtGoalLine(createInitialState({ startInGameplay: true }), 'home')).state;
    const clockAfterGoal = state.clockSeconds;

    for (let i = 0; i < MODE_PAUSE.goalTicks; i += 1) {
      state = advanceTick(state).state;
    }

    expect(state.mode).toBe('Faceoff');
    expect(state.clockSeconds).toBe(clockAfterGoal);
    expect(state.puck.ownerId).toBeUndefined();
    expect(state.puck.velocity).toEqual({ x: 0, y: 0 });
    expect(state.teams.home.roster.find((player) => player.role === 'center')?.position).toEqual({ x: -3, y: 0 });
    expect(state.teams.away.roster.find((player) => player.role === 'center')?.position).toEqual({ x: 3, y: 0 });
  });

  it('AT-003 ends the third period and declares the leading winner', () => {
    const initial = createInitialState({ startInGameplay: true });
    const state = advanceTick({
      ...initial,
      period: 3,
      clockSeconds: TICK_SECONDS / 2,
      teams: {
        ...initial.teams,
        home: { ...initial.teams.home, score: 2 },
        away: { ...initial.teams.away, score: 1 },
      },
    }).state;

    expect(state.mode).toBe('GameEnd');
    expect(state.winnerTeamId).toBe('home');
    expect(state.events.some((event) => event.type === 'periodEnded' && event.period === 3)).toBe(true);
    expect(state.events.some((event) => event.type === 'gameEnded' && event.winnerTeamId === 'home')).toBe(true);
  });

  it('AT-004 allows a tied final score in MVP', () => {
    const initial = createInitialState({ startInGameplay: true });
    const state = advanceTick({
      ...initial,
      period: 3,
      clockSeconds: TICK_SECONDS / 2,
    }).state;

    expect(state.mode).toBe('GameEnd');
    expect(state.winnerTeamId).toBeUndefined();
    expect(state.events.some((event) => event.type === 'gameEnded' && event.winnerTeamId === undefined)).toBe(true);
  });

  it('AT-006 human movement affects only the selected skater', () => {
    const initial = createInitialState({ startInGameplay: true });
    const selectedId = initial.teams.home.controlledPlayerId;
    const unselected = initial.teams.home.roster.find((player) => player.id !== selectedId);

    const state = advanceTick(initial, [
      { type: 'move', playerId: selectedId, direction: { x: 1, y: 0 }, tick: 1 },
      { type: 'move', playerId: unselected?.id ?? 'missing', direction: { x: -1, y: 0 }, tick: 1 },
    ]).state;

    const movedSelected = state.teams.home.roster.find((player) => player.id === selectedId);
    const stillUnselected = state.teams.home.roster.find((player) => player.id === unselected?.id);

    expect(movedSelected?.position.x).toBeGreaterThan(
      initial.teams.home.roster.find((player) => player.id === selectedId)?.position.x ?? 0,
    );
    expect(stillUnselected?.position).toEqual(unselected?.position);
  });

  it('resolves the faceoff drop and swipe contest deterministically', () => {
    let state = createInitialState({ seed: 11 });

    for (let i = 0; i < FACE_OFF.countdownTicks; i += 1) {
      state = advanceTick(state).state;
    }

    expect(state.mode).toBe('Faceoff');
    expect(state.puck.ownerId).toBeUndefined();

    state = advanceTick(state, [{ type: 'pokeCheck', playerId: 'home-c', direction: { x: -1, y: 0 }, tick: state.tick + 1 }])
      .state;

    expect(state.mode).toBe('Gameplay');
    expect(state.events.filter((event) => event.type === 'faceoffWon')).toEqual([
      { type: 'faceoffWon', teamId: 'home', playerId: 'home-c', tick: state.tick },
    ]);
    expect(state.puck.lastTouchPlayerId).toBe('home-c');
    expect(state.puck.velocity.x).toBeLessThan(0);
  });
});

function withPuckAtGoalLine(state: GameState, scoringTeamId: 'home' | 'away'): GameState {
  const goalX = scoringTeamId === 'home' ? RINK.goalLineX + 0.5 : -RINK.goalLineX - 0.5;
  return {
    ...state,
    puck: {
      ...state.puck,
      position: { x: goalX, y: 0 },
      velocity: { x: 0, y: 0 },
      ownerId: undefined,
      state: 'loose',
      lastTouchPlayerId: `${scoringTeamId}-c`,
      lastTouchTeamId: scoringTeamId,
    },
  };
}
