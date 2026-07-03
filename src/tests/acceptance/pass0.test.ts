import { describe, expect, it } from 'vitest';
import { RINK, SKATER } from '../../sim/constants';
import type { GameCommand } from '../../sim/commands';
import { advanceTick, FixedStepSimulation } from '../../sim/loop';
import { runReplay } from '../../sim/replay';
import { createInitialState, createRenderSnapshot, getPlayers } from '../../sim/state';
import { length } from '../../sim/vector';

describe('Pass 0 foundation', () => {
  it('advances the simulation headlessly', () => {
    let state = createInitialState({ startInGameplay: true });

    for (let i = 0; i < 120; i += 1) {
      state = advanceTick(state).state;
    }

    expect(state.tick).toBe(120);
  });

  it('moves the selected skater from a command', () => {
    const initial = createInitialState({ startInGameplay: true });
    const selectedPlayerId = initial.teams.home.controlledPlayerId;
    const before = initial.teams.home.roster.find((player) => player.id === selectedPlayerId);

    const after = advanceTick(initial, [
      { type: 'move', playerId: selectedPlayerId, direction: { x: 1, y: 0 }, tick: 1 },
    ]).state;
    const moved = after.teams.home.roster.find((player) => player.id === selectedPlayerId);

    expect(moved?.position.x).toBeGreaterThan(before?.position.x ?? 0);
  });

  it('switches the human-controlled skater on the committed tick', () => {
    const initial = createInitialState({ startInGameplay: true });
    const targetPlayerId = initial.teams.home.roster[1]?.id;

    const after = advanceTick(initial, [{ type: 'switchPlayer', teamId: 'home', targetPlayerId, tick: 1 }]).state;

    expect(after.teams.home.controlledPlayerId).toBe(targetPlayerId);
    expect(after.teams.home.roster.filter((player) => player.hasHumanControl)).toHaveLength(1);
  });

  it('exposes render snapshots without Phaser', () => {
    const simulation = new FixedStepSimulation(createInitialState({ startInGameplay: true }));
    simulation.stepOne();
    const snapshot = createRenderSnapshot(simulation.currentState);

    expect(snapshot.players).toHaveLength(6);
    expect(snapshot.goalies).toHaveLength(2);
    expect(snapshot.rink).toBe(RINK);
    expect(snapshot.puck.position).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it('cycles to the next eligible roster skater when no target is given', () => {
    const initial = createInitialState({ startInGameplay: true });
    const firstExpected = initial.teams.home.roster[1]?.id;
    const secondExpected = initial.teams.home.roster[2]?.id;

    const firstSwitch = advanceTick(initial, [{ type: 'switchPlayer', teamId: 'home', tick: 1 }]).state;
    const secondSwitch = advanceTick(firstSwitch, [{ type: 'switchPlayer', teamId: 'home', tick: 2 }]).state;

    expect(firstSwitch.teams.home.controlledPlayerId).toBe(firstExpected);
    expect(secondSwitch.teams.home.controlledPlayerId).toBe(secondExpected);
  });

  it('places goalies inside the rink in front of their goal lines', () => {
    const state = createInitialState();
    expect(Math.abs(state.teams.home.goalie.position.x)).toBeLessThan(RINK.goalLineX);
    expect(Math.abs(state.teams.away.goalie.position.x)).toBeLessThan(RINK.goalLineX);
  });

  it('caps skater speed and glides to a stop without input', () => {
    let state = createInitialState({ startInGameplay: true });
    const playerId = state.teams.home.controlledPlayerId;

    for (let tick = 1; tick <= 120; tick += 1) {
      state = advanceTick(state, [{ type: 'move', playerId, direction: { x: 1, y: 0 }, tick }]).state;
      const player = state.teams.home.roster.find((candidate) => candidate.id === playerId);
      expect(length(player?.velocity ?? { x: 0, y: 0 })).toBeLessThanOrEqual(SKATER.maxSpeed + 1e-9);
    }

    for (let i = 0; i < 180; i += 1) {
      state = advanceTick(state).state;
    }
    const stopped = state.teams.home.roster.find((candidate) => candidate.id === playerId);
    expect(length(stopped?.velocity ?? { x: 1, y: 1 })).toBe(0);
  });

  it('reproduces the same state from the same seed and command log', () => {
    const commands: GameCommand[] = [];
    const playerId = createInitialState({ startInGameplay: true }).teams.home.controlledPlayerId;
    for (let tick = 1; tick <= 300; tick += 1) {
      commands.push({ type: 'move', playerId, direction: { x: 1, y: tick % 40 < 20 ? 1 : -1 }, tick });
      if (tick === 90) {
        commands.push({ type: 'pass', playerId, tick });
      }
      if (tick === 150) {
        commands.push({ type: 'switchPlayer', teamId: 'home', tick });
      }
    }

    const log = { initialConfig: { seed: 7, startInGameplay: true }, commands, ticks: 300 };
    const first = runReplay(log);
    const second = runReplay(log);

    expect(second).toEqual(first);
    expect(getPlayers(second).map((player) => player.position)).toEqual(
      getPlayers(first).map((player) => player.position),
    );
  });
});
