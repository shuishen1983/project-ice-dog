import { describe, expect, it } from 'vitest';
import type { GameCommand } from '../../sim/commands';
import { MODE_PAUSE, SHOOTOUT } from '../../sim/constants';
import { advanceTick } from '../../sim/loop';
import { eventLogHash, runReplay, stateHash } from '../../sim/replay';
import { createInitialState, type GameState } from '../../sim/state';

function menuState(seed = 2): GameState {
  return createInitialState({ seed, startInMenu: true, enableAi: true, humanTeamId: null });
}

function startShootout(state: GameState): GameState {
  return advanceTick(state, [{ type: 'startMatch', matchType: 'shootout', tick: state.tick + 1 }]).state;
}

function runToGameEnd(state: GameState, maxTicks = 40000): GameState {
  let current = state;
  for (let i = 0; i < maxTicks && current.mode !== 'GameEnd'; i += 1) {
    current = advanceTick(current).state;
  }
  return current;
}

describe('Shootout match type', () => {
  it('AT-020 menu starts the selected match type and ignores other commands', () => {
    const menu = menuState();

    const afterMove = advanceTick(menu, [
      { type: 'move', playerId: 'home-c', direction: { x: 1, y: 0 }, tick: menu.tick + 1 },
    ]).state;
    expect(afterMove.mode).toBe('Menu');
    expect(afterMove.teams.home.roster[0]?.velocity).toEqual({ x: 0, y: 0 });

    const regulation = advanceTick(menu, [
      { type: 'startMatch', matchType: 'regulation', tick: menu.tick + 1 },
    ]).state;
    expect(regulation.mode).toBe('Faceoff');
    expect(regulation.matchType).toBe('regulation');

    const shootout = startShootout(menu);
    expect(shootout.mode).toBe('AttemptSetup');
    expect(shootout.matchType).toBe('shootout');
    expect(shootout.shootout).toMatchObject({ round: 1, shooterTeamId: 'home' });
  });

  it('AT-021 attempt setup isolates shooter and defending goalie', () => {
    const state = startShootout(menuState());
    const shooterId = state.shootout?.shooterPlayerId;

    expect(state.puck.ownerId).toBe(shooterId);
    const shooter = state.teams.home.roster.find((player) => player.id === shooterId);
    expect(shooter?.position).toEqual({ x: 0, y: 0 });

    const others = [...state.teams.home.roster, ...state.teams.away.roster].filter(
      (player) => player.id !== shooterId,
    );
    expect(others).toHaveLength(5);
    for (const player of others) {
      expect(player.possessionEligible).toBe(false);
      expect(Math.abs(player.position.y)).toBeGreaterThan(30);
    }
    expect(state.teams.away.goalie.position).toEqual({ x: 87, y: 0 });
  });

  it('AT-022 attempt ends without a goal and no score is awarded', () => {
    // Human shooter that never moves: the attempt must die on the timer.
    let state = startShootout(createInitialState({ seed: 2, startInMenu: true, enableAi: true }));
    state = { ...state, clockSeconds: 0.05 };

    for (let i = 0; i < SHOOTOUT.setupTicks + 10 && state.mode !== 'AttemptEnd'; i += 1) {
      state = advanceTick(state).state;
    }
    expect(state.mode).toBe('AttemptEnd');
    expect(state.teams.home.score).toBe(0);

    for (let i = 0; i <= MODE_PAUSE.attemptEndTicks + 1 && state.mode !== 'AttemptSetup'; i += 1) {
      state = advanceTick(state).state;
    }
    expect(state.mode).toBe('AttemptSetup');
    expect(state.shootout?.shooterTeamId).toBe('away');
    expect(state.shootout?.attempts).toEqual({ home: 1, away: 0 });
  });

  it('AT-023 attempts alternate, rounds advance, and an AI shootout reaches a decided GameEnd', () => {
    const state = runToGameEnd(startShootout(menuState()));

    expect(state.mode).toBe('GameEnd');
    expect(state.winnerTeamId).toBeDefined();

    const starts = state.events.filter((event) => event.type === 'attemptStarted');
    expect(starts.length).toBeGreaterThanOrEqual(2);
    starts.forEach((event, index) => {
      if (event.type !== 'attemptStarted') {
        return;
      }
      expect(event.teamId).toBe(index % 2 === 0 ? 'home' : 'away');
      expect(event.round).toBe(Math.floor(index / 2) + 1);
    });

    const ends = state.events.filter((event) => event.type === 'attemptEnded');
    expect(ends).toHaveLength(starts.length);
    expect(state.events.filter((event) => event.type === 'gameEnded')).toHaveLength(1);
  });

  it('AT-024 clinch ends the shootout before all five rounds are played', () => {
    let state = startShootout(menuState());
    state = {
      ...state,
      mode: 'AttemptEnd',
      modeStartedTick: state.tick - MODE_PAUSE.attemptEndTicks,
      shootout: { round: 3, shooterTeamId: 'away', shooterPlayerId: 'away-c', attempts: { home: 3, away: 2 } },
      teams: {
        ...state.teams,
        home: { ...state.teams.home, score: 3 },
      },
    };

    // Away misses its 3rd attempt: 3-0 with only 2 away attempts remaining is decided.
    const after = advanceTick(state).state;
    expect(after.mode).toBe('GameEnd');
    expect(after.winnerTeamId).toBe('home');
  });

  it('AT-025 sudden death decides a tied shootout and tied rounds continue', () => {
    const base = startShootout(menuState());
    const suddenDeath = (homeScore: number, awayScore: number): GameState => ({
      ...base,
      mode: 'AttemptEnd',
      modeStartedTick: base.tick - MODE_PAUSE.attemptEndTicks,
      shootout: { round: 6, shooterTeamId: 'away', shooterPlayerId: 'away-c', attempts: { home: 6, away: 5 } },
      teams: {
        ...base.teams,
        home: { ...base.teams.home, score: homeScore },
        away: { ...base.teams.away, score: awayScore },
      },
    });

    const decided = advanceTick(suddenDeath(3, 2)).state;
    expect(decided.mode).toBe('GameEnd');
    expect(decided.winnerTeamId).toBe('home');

    const stillTied = advanceTick(suddenDeath(2, 2)).state;
    expect(stillTied.mode).toBe('AttemptSetup');
    expect(stillTied.shootout?.round).toBe(7);
    expect(stillTied.shootout?.shooterTeamId).toBe('home');
  });

  it('AT-014 extension: shootout replays are deterministic', () => {
    const commands: GameCommand[] = [{ type: 'startMatch', matchType: 'shootout', tick: 1 }];
    const log = {
      initialConfig: { seed: 2, startInMenu: true, enableAi: true, humanTeamId: null },
      commands,
      ticks: 3000,
    };

    const first = runReplay(log);
    const second = runReplay(log);
    expect(stateHash(first)).toBe(stateHash(second));
    expect(eventLogHash(first.events)).toBe(eventLogHash(second.events));
  });
});
