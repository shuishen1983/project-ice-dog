import type { GameCommand } from './commands';
import { advanceTick } from './loop';
import type { GameEvent } from './events';
import type { GameState, InitialGameConfig } from './state';
import { createInitialState, getPlayers } from './state';

export type ReplayLog = {
  initialConfig: InitialGameConfig;
  commands: GameCommand[];
  ticks: number;
};

export function runReplay(log: ReplayLog): GameState {
  let state = createInitialState(log.initialConfig);

  for (let i = 0; i < log.ticks; i += 1) {
    const nextTick = state.tick + 1;
    const commands = log.commands.filter((command) => command.tick === nextTick);
    state = advanceTick(state, commands).state;
  }

  return state;
}

export function stateHash(state: GameState): string {
  return fnv1a(
    stableStringify({
      seed: state.seed,
      aiEnabled: state.aiEnabled,
      humanTeamId: state.humanTeamId,
      tick: state.tick,
      mode: state.mode,
      period: state.period,
      periodSeconds: round(state.periodSeconds),
      clockSeconds: round(state.clockSeconds),
      winnerTeamId: state.winnerTeamId,
      faceoff: state.faceoff,
      score: {
        home: state.teams.home.score,
        away: state.teams.away.score,
      },
      controlled: {
        home: state.teams.home.controlledPlayerId,
        away: state.teams.away.controlledPlayerId,
      },
      players: getPlayers(state).map((player) => ({
        id: player.id,
        teamId: player.teamId,
        role: player.role,
        position: roundVec(player.position),
        velocity: roundVec(player.velocity),
        facing: roundVec(player.facing),
        intent: player.intent,
      })),
      goalies: [state.teams.home.goalie, state.teams.away.goalie].map((goalie) => ({
        id: goalie.id,
        teamId: goalie.teamId,
        position: roundVec(goalie.position),
        reactionAvailableTick: goalie.reactionAvailableTick,
      })),
      puck: {
        position: roundVec(state.puck.position),
        velocity: roundVec(state.puck.velocity),
        ownerId: state.puck.ownerId,
        state: state.puck.state,
        lastTouchPlayerId: state.puck.lastTouchPlayerId,
        lastTouchTeamId: state.puck.lastTouchTeamId,
        intent: state.puck.intent,
        ageTicks: state.puck.ageTicks,
        repossessLockout: state.puck.repossessLockout,
        receiveWindow: state.puck.receiveWindow,
        goalieHold: state.puck.goalieHold,
      },
    }),
  );
}

export function eventLogHash(events: GameEvent[]): string {
  return fnv1a(stableStringify(events));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundVec(vec: { x: number; y: number }) {
  return {
    x: round(vec.x),
    y: round(vec.y),
  };
}
