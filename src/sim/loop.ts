import type { GameCommand } from './commands';
import { sortCommands } from './commands';
import { TICK_SECONDS } from './constants';
import { integrateLoosePuck, releasePuckFromCommand, updateHeldPuck } from '../physics/puck';
import { integrateSkater } from '../physics/skater';
import { applySwitchCommand, appendEvent, isCommandAllowed } from './rules';
import type { GameState, TeamId } from './state';
import { createRenderSnapshot } from './state';
import type { Vec2 } from './vector';
import { ZERO_VEC } from './vector';

export type TickResult = {
  state: GameState;
};

export function advanceTick(state: GameState, commands: GameCommand[] = []): TickResult {
  const targetTick = state.tick + 1;
  // Must match replay.ts exactly: stale or future commands never apply, or replays diverge.
  const tickCommands = sortCommands(commands.filter((command) => command.tick === targetTick));
  let nextState = {
    ...state,
    tick: targetTick,
  };

  const movementByPlayer = new Map<string, Vec2>();

  for (const command of tickCommands) {
    if (!isCommandAllowed(nextState, command)) {
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

    if (command.type === 'pass' || command.type === 'shoot') {
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
      }
    }
  }

  nextState = {
    ...nextState,
    teams: {
      home: integrateTeamSkaters(nextState, 'home', movementByPlayer),
      away: integrateTeamSkaters(nextState, 'away', movementByPlayer),
    },
  };

  nextState = {
    ...nextState,
    puck:
      nextState.puck.state === 'held'
        ? updateHeldPuck(nextState)
        : integrateLoosePuck(nextState.puck),
  };

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
