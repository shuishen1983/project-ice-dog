import type { GameCommand } from './commands';
import { sortCommands } from './commands';
import { createAiCommands, updateGoaliePositions } from '../ai/behavior';
import { RINK, TICK_SECONDS } from './constants';
import {
  integrateLoosePuck,
  releasePuckFromCommand,
  releasePuckFromPokeCheck,
  resolveGoalieHold,
  resolveGoalieSave,
  resolveLoosePuckPickup,
  updateHeldPuck,
} from '../physics/puck';
import { integrateSkater } from '../physics/skater';
import { clampToRink } from '../physics/rink';
import {
  advanceRulesClock,
  advanceTimedMode,
  applyStartMatch,
  applySwitchCommand,
  appendEvent,
  isCommandAllowed,
  resolveAttemptEndIfNeeded,
  resolveFaceoff,
  resolveGoalIfNeeded,
} from './rules';
import type { GameState, PlayerState, TeamId } from './state';
import { createRenderSnapshot, getPlayers } from './state';
import type { Vec2 } from './vector';
import { add, distance, normalize, scale, subtract, ZERO_VEC } from './vector';

export type TickResult = {
  state: GameState;
};

export function advanceTick(state: GameState, commands: GameCommand[] = []): TickResult {
  const targetTick = state.tick + 1;
  let nextState = {
    ...state,
    tick: targetTick,
  };

  nextState = advanceTimedMode(nextState);
  const aiCommands = createAiCommands(nextState, targetTick);
  // Must match replay.ts exactly: stale or future commands never apply, or replays diverge.
  const tickCommands = sortCommands([...commands.filter((command) => command.tick === targetTick), ...aiCommands]);

  const movementByPlayer = new Map<string, Vec2>();

  for (const command of tickCommands) {
    if (!isCommandAllowed(nextState, command)) {
      continue;
    }

    if (command.type === 'startMatch') {
      nextState = applyStartMatch(nextState, command);
      continue;
    }

    if (command.type === 'switchPlayer') {
      nextState = applySwitchCommand(nextState, command);
      continue;
    }

    if (command.type === 'move') {
      movementByPlayer.set(command.playerId, command.direction);
      continue;
    }

    if (command.type === 'pass' || command.type === 'shoot' || command.type === 'dump') {
      const releasedPuck = releasePuckFromCommand(nextState, command);
      if (releasedPuck) {
        nextState = {
          ...nextState,
          puck: releasedPuck,
        };
        nextState = appendEvent(nextState, {
          type: 'possessionChanged',
          tick: targetTick,
        });
        nextState = appendEvent(nextState, {
          type: 'puckReleased',
          playerId: command.playerId,
          tick: targetTick,
        });
      }
    }

    if (command.type === 'pokeCheck') {
      const releasedPuck = releasePuckFromPokeCheck(nextState, command);
      if (releasedPuck) {
        nextState = {
          ...nextState,
          puck: releasedPuck,
        };
        nextState = appendEvent(nextState, {
          type: 'possessionChanged',
          tick: targetTick,
        });
      }
    }
  }

  nextState = resolveFaceoff(nextState, tickCommands);

  nextState = {
    ...nextState,
    teams: {
      home: integrateTeamSkaters(nextState, 'home', movementByPlayer),
      away: integrateTeamSkaters(nextState, 'away', movementByPlayer),
    },
  };

  nextState = separateSkaterContacts(nextState);
  nextState = updateGoaliePositions(nextState);
  nextState = resolveGoalieHold(nextState);

  nextState = {
    ...nextState,
    puck:
      nextState.puck.state === 'held'
        ? updateHeldPuck(nextState)
        : integrateLoosePuck(nextState.puck),
  };

  nextState = resolveGoalieSave(nextState);
  nextState = resolveLoosePuckPickup(nextState);
  nextState = resolveGoalIfNeeded(nextState);
  nextState = resolveAttemptEndIfNeeded(nextState);
  nextState = advanceRulesClock(nextState);

  return { state: nextState };
}

export class FixedStepSimulation {
  private accumulatorSeconds = 0;
  private queuedCommands: GameCommand[] = [];

  constructor(private state: GameState) {}

  get snapshot() {
    return createRenderSnapshot(this.state);
  }

  get currentState() {
    return this.state;
  }

  queueCommand(command: GameCommand) {
    this.queuedCommands.push(command);
  }

  stepOne(commands: GameCommand[] = []) {
    const result = advanceTick(this.state, [...this.queuedCommands, ...commands]);
    this.state = result.state;
    this.queuedCommands = [];
    return this.snapshot;
  }

  update(deltaSeconds: number, commandFactory?: (nextTick: number) => GameCommand[]) {
    // Cap catch-up work so a background tab or long frame cannot stall the loop.
    this.accumulatorSeconds = Math.min(this.accumulatorSeconds + deltaSeconds, 0.25);

    while (this.accumulatorSeconds >= TICK_SECONDS) {
      const nextTick = this.state.tick + 1;
      const commands = commandFactory?.(nextTick) ?? [];
      this.stepOne(commands);
      this.accumulatorSeconds -= TICK_SECONDS;
    }

    return this.snapshot;
  }
}

function integrateTeamSkaters(state: GameState, teamId: TeamId, movementByPlayer: Map<string, Vec2>) {
  const team = state.teams[teamId];
  return {
    ...team,
    roster: team.roster.map((player) =>
      integrateSkater(player, movementByPlayer.get(player.id) ?? ZERO_VEC, state.puck.ownerId === player.id),
    ),
  };
}

function separateSkaterContacts(state: GameState): GameState {
  const players = getPlayers(state)
    .map((player) => ({ ...player }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const first = players[i] as PlayerState;
      const second = players[j] as PlayerState;
      const minimumDistance = first.radius + second.radius;
      const currentDistance = distance(first.position, second.position);
      if (currentDistance >= minimumDistance) {
        continue;
      }

      const direction = currentDistance === 0 ? { x: first.id.localeCompare(second.id) <= 0 ? -1 : 1, y: 0 } : normalize(subtract(first.position, second.position));
      const correction = scale(direction, (minimumDistance - currentDistance) / 2);
      first.position = clampToRink(add(first.position, correction), RINK, first.radius);
      second.position = clampToRink(add(second.position, scale(correction, -1)), RINK, second.radius);
    }
  }

  const byId = new Map(players.map((player) => [player.id, player]));
  return {
    ...state,
    teams: {
      home: {
        ...state.teams.home,
        roster: state.teams.home.roster.map((player) => byId.get(player.id) ?? player),
      },
      away: {
        ...state.teams.away,
        roster: state.teams.away.roster.map((player) => byId.get(player.id) ?? player),
      },
    },
  };
}
