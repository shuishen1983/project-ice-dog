import { PASS, PUCK, RINK, SHOT, TICK_SECONDS } from '../sim/constants';
import type { GameCommand } from '../sim/commands';
import type { GameState, PlayerState, PuckState, TeamId } from '../sim/state';
import { findPlayer, puckPositionForOwner } from '../sim/state';
import { add, normalize, scale } from '../sim/vector';
import type { Vec2 } from '../sim/vector';
import { clampToRink } from './rink';

export function updateHeldPuck(state: GameState): PuckState {
  if (!state.puck.ownerId) {
    return state.puck;
  }

  const owner = findPlayer(state, state.puck.ownerId);
  if (!owner) {
    return { ...state.puck, ownerId: undefined, state: 'loose' };
  }

  return {
    ...state.puck,
    position: puckPositionForOwner(owner),
    velocity: owner.velocity,
    state: 'held',
    ageTicks: state.puck.ageTicks + 1,
  };
}

export function integrateLoosePuck(puck: PuckState): PuckState {
  if (puck.state === 'held') {
    return puck;
  }

  return {
    ...puck,
    position: clampToRink(add(puck.position, scale(puck.velocity, TICK_SECONDS)), RINK, PUCK.radius),
    ageTicks: puck.ageTicks + 1,
  };
}

export function releasePuckFromCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'pass' | 'shoot' }>,
): PuckState | undefined {
  if (state.puck.ownerId !== command.playerId) {
    return undefined;
  }

  const owner = findPlayer(state, command.playerId);
  if (!owner) {
    return undefined;
  }

  const target = resolveCommandTarget(state, command, owner);
  const direction = normalize({ x: target.x - owner.position.x, y: target.y - owner.position.y });
  const speed = command.type === 'pass' ? PASS.speed : SHOT.speed;

  return {
    ...state.puck,
    position: puckPositionForOwner(owner),
    velocity: scale(direction, speed),
    ownerId: undefined,
    state: 'loose',
    lastTouchPlayerId: owner.id,
    lastTouchTeamId: owner.teamId,
    intent: command.type === 'pass' ? 'pass' : 'shot',
    ageTicks: 0,
  };
}

function resolveCommandTarget(
  state: GameState,
  command: Extract<GameCommand, { type: 'pass' | 'shoot' }>,
  owner: PlayerState,
): Vec2 {
  if (typeof command.target === 'string') {
    const targetPlayer = findPlayer(state, command.target);
    return targetPlayer?.position ?? owner.position;
  }

  if (command.target) {
    return command.target;
  }

  const teamGoalX: Record<TeamId, number> = {
    home: RINK.goalLineX,
    away: -RINK.goalLineX,
  };
  return { x: teamGoalX[owner.teamId], y: 0 };
}
