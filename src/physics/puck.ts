import { GOALIE, PASS, PUCK, RINK, SHOT, TICK_SECONDS } from '../sim/constants';
import type { GameCommand } from '../sim/commands';
import type { GameState, GoalieState, PlayerState, PuckState, TeamId } from '../sim/state';
import { attackingGoalX, findPlayer, getPlayers, puckPositionForOwner } from '../sim/state';
import { cornerArcAt } from './rink';
import { add, distance, length, normalize, scale, subtract } from '../sim/vector';
import type { Vec2 } from '../sim/vector';

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
  if (puck.state === 'held' || puck.goalieHold) {
    return puck;
  }

  const moved = add(puck.position, scale(puck.velocity, TICK_SECONDS));
  const collided = resolveBoardAndPostCollisions(moved, puck.velocity);
  const velocity = applyFriction(collided.velocity);

  return {
    ...puck,
    position: collided.position,
    velocity,
    ageTicks: puck.ageTicks + 1,
  };
}

export function releasePuckFromCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'pass' | 'shoot' | 'dump' }>,
): PuckState | undefined {
  const owner = findPlayer(state, command.playerId);
  if (!owner) {
    return undefined;
  }

  if (state.puck.ownerId !== command.playerId) {
    return command.type === 'shoot' ? releaseOneTimerFromCommand(state, command, owner) : undefined;
  }

  const target = resolveCommandTarget(state, command, owner);
  const direction = normalize({ x: target.x - owner.position.x, y: target.y - owner.position.y });
  const speed = command.type === 'pass' ? PASS.speed : command.type === 'dump' ? PASS.speed * 1.2 : SHOT.speed;

  return {
    ...state.puck,
    position: puckPositionForOwner(owner),
    velocity: scale(direction, speed),
    ownerId: undefined,
    state: 'loose',
    lastTouchPlayerId: owner.id,
    lastTouchTeamId: owner.teamId,
    intent: command.type === 'shoot' ? 'shot' : command.type,
    ageTicks: 0,
    receiveWindow:
      command.type === 'pass'
        ? {
            targetPlayerId: typeof command.target === 'string' ? command.target : undefined,
            untilTick: state.tick + PUCK.oneTimerWindowTicks,
          }
        : undefined,
    repossessLockout: {
      playerId: owner.id,
      untilTick: state.tick + PUCK.repossessLockoutTicks,
    },
  };
}

export function resolveGoalieHold(state: GameState): GameState {
  const hold = state.puck.goalieHold;
  if (!hold || state.tick < hold.releaseTick) {
    return state;
  }

  const defender =
    state.teams[hold.teamId].roster.find((player) => player.role === 'defense') ?? state.teams[hold.teamId].roster[0];
  if (!defender) {
    return {
      ...state,
      puck: {
        ...state.puck,
        goalieHold: undefined,
        state: 'loose',
        velocity: { x: 0, y: 0 },
      },
    };
  }

  return {
    ...state,
    puck: {
      ...state.puck,
      position: puckPositionForOwner(defender),
      velocity: defender.velocity,
      ownerId: defender.id,
      state: 'held',
      lastTouchPlayerId: defender.id,
      lastTouchTeamId: defender.teamId,
      intent: 'none',
      ageTicks: 0,
      goalieHold: undefined,
      repossessLockout: undefined,
      receiveWindow: undefined,
    },
    events: [
      ...state.events,
      { type: 'possessionChanged', playerId: defender.id, teamId: defender.teamId, tick: state.tick },
    ],
  };
}

export function resolveGoalieSave(state: GameState): GameState {
  if (state.mode !== 'Gameplay' || state.puck.state !== 'loose' || state.puck.goalieHold) {
    return state;
  }

  const goalie = goalieInSaveRange(state);
  if (!goalie || state.tick < goalie.reactionAvailableTick) {
    return state;
  }

  const speed = length(state.puck.velocity);
  const trapped = speed <= GOALIE.trapSpeed;
  const updatedGoalie: GoalieState = {
    ...goalie,
    reactionAvailableTick: state.tick + GOALIE.reactionCooldownTicks,
  };
  const savedPuck = trapped ? trapPuckAtGoalie(state.puck, updatedGoalie, state.tick) : reboundPuck(state, updatedGoalie);

  return {
    ...state,
    teams: {
      ...state.teams,
      [updatedGoalie.teamId]: {
        ...state.teams[updatedGoalie.teamId],
        goalie: updatedGoalie,
      },
    },
    puck: savedPuck,
    events: [...state.events, { type: 'goalieSave', goalieId: updatedGoalie.id, trapped, tick: state.tick }],
  };
}

export function releasePuckFromPokeCheck(
  state: GameState,
  command: Extract<GameCommand, { type: 'pokeCheck' }>,
): PuckState | undefined {
  const checker = findPlayer(state, command.playerId);
  const owner = state.puck.ownerId ? findPlayer(state, state.puck.ownerId) : undefined;
  if (!checker || !owner || checker.teamId === owner.teamId) {
    return undefined;
  }

  if (distance(checker.position, owner.position) > PUCK.pokeRange) {
    return undefined;
  }

  const direction = normalize(command.direction);
  return {
    ...state.puck,
    position: puckPositionForOwner(owner),
    velocity: scale(direction, PASS.speed * 0.45),
    ownerId: undefined,
    state: 'loose',
    intent: 'loose',
    ageTicks: 0,
    repossessLockout: {
      playerId: owner.id,
      untilTick: state.tick + PUCK.repossessLockoutTicks,
    },
  };
}

export function resolveLoosePuckPickup(state: GameState): GameState {
  if (state.mode !== 'Gameplay' || state.puck.state !== 'loose' || state.puck.goalieHold) {
    return state;
  }
  if (state.events.some((event) => event.type === 'faceoffWon' && event.tick === state.tick)) {
    return state;
  }

  const candidates = getPlayers(state)
    .filter((player) => {
      const lockedOut =
        state.puck.repossessLockout?.playerId === player.id && state.tick <= state.puck.repossessLockout.untilTick;
      return (
        player.possessionEligible &&
        !lockedOut &&
        distance(player.position, state.puck.position) <= player.radius + PUCK.pickupRadius
      );
    })
    .sort((a, b) => {
      const distanceDiff = distance(a.position, state.puck.position) - distance(b.position, state.puck.position);
      if (Math.abs(distanceDiff) > 1e-9) {
        return distanceDiff;
      }
      const teamDiff = a.teamId.localeCompare(b.teamId);
      return teamDiff !== 0 ? teamDiff : a.id.localeCompare(b.id);
    });

  const owner = candidates[0];
  if (!owner) {
    return state;
  }

  return {
    ...state,
    puck: {
      ...state.puck,
      position: puckPositionForOwner(owner),
      velocity: owner.velocity,
      ownerId: owner.id,
      state: 'held',
      lastTouchPlayerId: owner.id,
      lastTouchTeamId: owner.teamId,
      intent: 'none',
      ageTicks: 0,
      repossessLockout: undefined,
      receiveWindow: undefined,
    },
    events: [
      ...state.events,
      {
        type: 'possessionChanged',
        playerId: owner.id,
        teamId: owner.teamId,
        tick: state.tick,
      },
    ],
  };
}

function releaseOneTimerFromCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'shoot' }>,
  shooter: PlayerState,
): PuckState | undefined {
  const window = state.puck.receiveWindow;
  if (
    state.puck.state !== 'loose' ||
    state.puck.intent !== 'pass' ||
    !window ||
    state.tick > window.untilTick ||
    (window.targetPlayerId && window.targetPlayerId !== shooter.id)
  ) {
    return undefined;
  }

  if (distance(shooter.position, state.puck.position) > shooter.radius + PUCK.pickupRadius) {
    return undefined;
  }

  const direction = normalize(subtract(command.target, shooter.position));
  return {
    ...state.puck,
    position: state.puck.position,
    velocity: scale(direction, SHOT.speed),
    ownerId: undefined,
    state: 'loose',
    lastTouchPlayerId: shooter.id,
    lastTouchTeamId: shooter.teamId,
    intent: 'shot',
    ageTicks: 0,
    receiveWindow: undefined,
    repossessLockout: {
      playerId: shooter.id,
      untilTick: state.tick + PUCK.repossessLockoutTicks,
    },
  };
}

function resolveBoardAndPostCollisions(position: Vec2, velocity: Vec2): { position: Vec2; velocity: Vec2 } {
  const corner = resolveCornerBoardCollision(position, velocity);
  if (corner) {
    return resolvePostCollision(corner.position, corner.velocity);
  }

  const halfWidth = RINK.width / 2 - PUCK.radius;
  const halfHeight = RINK.height / 2 - PUCK.radius;
  let nextPosition = { ...position };
  let nextVelocity = { ...velocity };

  if (nextPosition.x < -halfWidth) {
    nextPosition = { ...nextPosition, x: -halfWidth };
    nextVelocity = { ...nextVelocity, x: Math.abs(nextVelocity.x) * PUCK.boardRestitution };
  } else if (nextPosition.x > halfWidth) {
    nextPosition = { ...nextPosition, x: halfWidth };
    nextVelocity = { ...nextVelocity, x: -Math.abs(nextVelocity.x) * PUCK.boardRestitution };
  }

  if (nextPosition.y < -halfHeight) {
    nextPosition = { ...nextPosition, y: -halfHeight };
    nextVelocity = { ...nextVelocity, y: Math.abs(nextVelocity.y) * PUCK.boardRestitution };
  } else if (nextPosition.y > halfHeight) {
    nextPosition = { ...nextPosition, y: halfHeight };
    nextVelocity = { ...nextVelocity, y: -Math.abs(nextVelocity.y) * PUCK.boardRestitution };
  }

  return resolvePostCollision(nextPosition, nextVelocity);
}

function resolveCornerBoardCollision(position: Vec2, velocity: Vec2): { position: Vec2; velocity: Vec2 } | undefined {
  const corner = cornerArcAt(position, RINK, PUCK.radius);
  if (!corner) {
    return undefined;
  }

  const offset = subtract(position, corner.center);
  const separation = length(offset);
  if (separation <= corner.radius) {
    return undefined;
  }

  const normal = scale(offset, 1 / separation);
  const normalSpeed = velocity.x * normal.x + velocity.y * normal.y;
  const reflectedVelocity =
    normalSpeed > 0
      ? subtract(velocity, scale(normal, (1 + PUCK.boardRestitution) * normalSpeed))
      : velocity;

  return {
    position: add(corner.center, scale(normal, corner.radius)),
    velocity: reflectedVelocity,
  };
}

function resolvePostCollision(position: Vec2, velocity: Vec2): { position: Vec2; velocity: Vec2 } {
  for (const signX of [-1, 1]) {
    for (const signY of [-1, 1]) {
      const post = { x: signX * RINK.goalLineX, y: signY * (RINK.goalMouthWidth / 2) };
      const offset = subtract(position, post);
      const separation = length(offset);
      const minimum = PUCK.radius;
      if (separation === 0 || separation > minimum) {
        continue;
      }

      const normal = normalize(offset);
      const dot = velocity.x * normal.x + velocity.y * normal.y;
      if (dot >= 0) {
        continue;
      }

      const reflected = subtract(velocity, scale(normal, 2 * dot));
      return {
        position: add(post, scale(normal, minimum)),
        velocity: scale(reflected, PUCK.postRestitution),
      };
    }
  }

  return { position, velocity };
}

function applyFriction(velocity: Vec2): Vec2 {
  const speed = length(velocity);
  if (speed <= PUCK.stopSpeed) {
    return { x: 0, y: 0 };
  }

  const nextSpeed = Math.max(0, speed - PUCK.frictionDecel * TICK_SECONDS);
  if (nextSpeed <= PUCK.stopSpeed) {
    return { x: 0, y: 0 };
  }

  return scale(velocity, nextSpeed / speed);
}

function goalieInSaveRange(state: GameState): GoalieState | undefined {
  const candidates = [state.teams.home.goalie, state.teams.away.goalie].filter((goalie) => {
    const puckHeadingTowardGoal =
      goalie.teamId === 'home' ? state.puck.velocity.x < 0 : state.puck.velocity.x > 0;
    return puckHeadingTowardGoal && distance(goalie.position, state.puck.position) <= goalie.radius + PUCK.radius + GOALIE.saveReach;
  });

  return candidates.sort((a, b) => a.id.localeCompare(b.id))[0];
}

function trapPuckAtGoalie(puck: PuckState, goalie: GoalieState, tick: number): PuckState {
  return {
    ...puck,
    position: goalie.position,
    velocity: { x: 0, y: 0 },
    ownerId: undefined,
    state: 'loose',
    intent: 'none',
    ageTicks: 0,
    receiveWindow: undefined,
    goalieHold: {
      goalieId: goalie.id,
      teamId: goalie.teamId,
      releaseTick: tick + GOALIE.holdTicks,
    },
  };
}

function reboundPuck(state: GameState, goalie: GoalieState): PuckState {
  const awayFromGoal = goalie.teamId === 'home' ? 1 : -1;
  const jitter = seededJitter(state.seed, state.tick, goalie.id);
  const direction = normalize({ x: awayFromGoal, y: jitter });
  const speed = Math.max(PASS.speed * 0.4, length(state.puck.velocity) * GOALIE.reboundSpeedFactor);

  return {
    ...state.puck,
    position: goalie.position,
    velocity: scale(direction, speed),
    ownerId: undefined,
    state: 'loose',
    intent: 'rebound',
    ageTicks: 0,
    receiveWindow: undefined,
    goalieHold: undefined,
  };
}

function seededJitter(seed: number, tick: number, id: string): number {
  let hash = seed * 31 + tick * 17;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 33 + id.charCodeAt(i)) % 9973;
  }
  return ((hash % 2001) / 1000 - 1) * 0.55;
}

function resolveCommandTarget(
  state: GameState,
  command: Extract<GameCommand, { type: 'pass' | 'shoot' | 'dump' }>,
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
    home: attackingGoalX('home', state.period),
    away: attackingGoalX('away', state.period),
  };
  return { x: teamGoalX[owner.teamId], y: 0 };
}
