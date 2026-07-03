import type { GameCommand } from '../sim/commands';
import { FACE_OFF, GOALIE, RINK, TICK_SECONDS } from '../sim/constants';
import type { GameState, GoalieState, PlayerState, TeamId } from '../sim/state';
import { attackingGoalX, findPlayer, goalieCreasePosition } from '../sim/state';
import { add, distance, length, normalize, scale, subtract } from '../sim/vector';
import type { Vec2 } from '../sim/vector';
import { clampToRink } from '../physics/rink';

const SUPPORT_FORWARD_OFFSET = 18;
const SUPPORT_WIDE_OFFSET = 14;
const PRESSURE_RADIUS = 13;
const SHOT_RANGE = 58;
const LANE_BLOCK_RADIUS = 7;
const GOALIE_LATERAL_SPEED = 18;

export function createAiCommands(state: GameState, tick: number): GameCommand[] {
  if (!state.aiEnabled) {
    return [];
  }

  if (state.mode === 'Faceoff') {
    return createFaceoffCommands(state, tick);
  }

  if (state.mode !== 'Gameplay') {
    return [];
  }

  const commands: GameCommand[] = [];
  for (const teamId of ['home', 'away'] as const) {
    commands.push(...createTeamCommands(state, teamId, tick));
  }
  return commands;
}

export function updateGoaliePositions(state: GameState): GameState {
  if (!state.aiEnabled) {
    return state;
  }

  if (state.mode !== 'Gameplay' && state.mode !== 'Faceoff') {
    return state;
  }

  const homeGoalie = moveGoalie(state, state.teams.home.goalie);
  const awayGoalie = moveGoalie(state, state.teams.away.goalie);
  return {
    ...state,
    teams: {
      home: {
        ...state.teams.home,
        goalie: homeGoalie,
      },
      away: {
        ...state.teams.away,
        goalie: awayGoalie,
      },
    },
  };
}

function createFaceoffCommands(state: GameState, tick: number): GameCommand[] {
  if (!state.faceoff || tick < state.faceoff.dropTick) {
    return [];
  }

  const awayCenter = state.teams.away.roster.find((player) => player.role === 'center');
  if (!awayCenter) {
    return [];
  }

  const delay = aiFaceoffDelay(state.seed, 'away');
  if (tick < state.faceoff.dropTick + delay) {
    return [];
  }

  return [{ type: 'pokeCheck', playerId: awayCenter.id, direction: { x: 1, y: 0 }, tick, source: 'ai' }];
}

function createTeamCommands(state: GameState, teamId: TeamId, tick: number): GameCommand[] {
  const owner = state.puck.ownerId ? findPlayer(state, state.puck.ownerId) : undefined;
  const roster = state.teams[teamId].roster;
  const commands: GameCommand[] = [];

  for (const player of roster) {
    if (isHumanControlled(state, player)) {
      continue;
    }

    if (owner?.id === player.id) {
      commands.push(...carrierCommands(state, player, tick));
      continue;
    }

    if (!owner) {
      if (isOneTimerCandidate(state, player)) {
        commands.push({
          type: 'shoot',
          playerId: player.id,
          target: { x: attackingGoalX(player.teamId, state.period), y: 0 },
          tick,
          source: 'ai',
        });
        continue;
      }

      if (player.id === closestEligibleSkater(state, teamId)?.id) {
        commands.push(moveCommand(player, state.puck.position, tick));
      }
      continue;
    }

    if (owner.teamId === teamId) {
      commands.push(supportCommand(state, player, owner, tick));
      continue;
    }

    const pressurePlayer = closestEligibleSkaterToPoint(roster, owner.position);
    if (pressurePlayer?.id === player.id) {
      commands.push(moveCommand(player, owner.position, tick));
      if (distance(player.position, owner.position) <= PRESSURE_RADIUS * 0.55) {
        commands.push({ type: 'pokeCheck', playerId: player.id, direction: subtract(owner.position, player.position), tick, source: 'ai' });
      }
    } else {
      commands.push(moveCommand(player, slotCenter(teamId), tick));
    }
  }

  return commands;
}

function carrierCommands(state: GameState, carrier: PlayerState, tick: number): GameCommand[] {
  const goal = { x: attackingGoalX(carrier.teamId, state.period), y: 0 };
  const pressured = isPressured(state, carrier);
  const teammate = bestPassTarget(state, carrier);
  const shotOpen = isShotLaneOpen(state, carrier.position, goal, carrier.teamId);

  if (shotOpen && distance(carrier.position, goal) <= SHOT_RANGE) {
    return [{ type: 'shoot', playerId: carrier.id, target: goal, tick, source: 'ai' }];
  }

  if (!pressured && teammate && isPassLaneOpen(state, carrier.position, teammate.position, carrier.teamId)) {
    return [
      { type: 'pass', playerId: carrier.id, target: teammate.id, tick, source: 'ai' },
      moveCommand(carrier, goal, tick),
    ];
  }

  if (pressured && !teammate) {
    return [{ type: 'dump', playerId: carrier.id, target: dumpTarget(carrier.teamId, state.period), tick, source: 'ai' }];
  }

  return [moveCommand(carrier, goal, tick)];
}

function supportCommand(state: GameState, player: PlayerState, carrier: PlayerState, tick: number): GameCommand {
  const attackSign = attackingGoalX(player.teamId, state.period) > carrier.position.x ? 1 : -1;
  const laneY = player.role === 'wing' ? -SUPPORT_WIDE_OFFSET : SUPPORT_WIDE_OFFSET;
  const target = {
    x: carrier.position.x + attackSign * SUPPORT_FORWARD_OFFSET,
    y: player.role === 'defense' ? carrier.position.y + SUPPORT_WIDE_OFFSET : laneY,
  };
  return moveCommand(player, clampToRink(target, RINK, player.radius), tick);
}

function moveCommand(player: PlayerState, target: Vec2, tick: number): GameCommand {
  return {
    type: 'move',
    playerId: player.id,
    direction: normalize(subtract(target, player.position)),
    tick,
    source: 'ai',
  };
}

function moveGoalie(state: GameState, goalie: GoalieState): GoalieState {
  const crease = goalieCreasePosition(goalie.teamId, state.period);
  const threatDistance = Math.abs(state.puck.position.x - crease.x);
  const tracksPuck = threatDistance < 80;
  const targetY = tracksPuck
    ? Math.max(-RINK.creaseRadius, Math.min(RINK.creaseRadius, state.puck.position.y))
    : 0;
  const target = { x: crease.x, y: targetY };
  const delta = subtract(target, goalie.position);
  const maxStep = GOALIE_LATERAL_SPEED * TICK_SECONDS;
  const step = length(delta) <= maxStep ? delta : scale(normalize(delta), maxStep);

  return {
    ...goalie,
    position: add(goalie.position, step),
  };
}

function isHumanControlled(state: GameState, player: PlayerState): boolean {
  return Boolean(state.humanTeamId && player.teamId === state.humanTeamId && player.id === state.teams[player.teamId].controlledPlayerId);
}

function closestEligibleSkater(state: GameState, teamId: TeamId): PlayerState | undefined {
  return closestEligibleSkaterToPoint(state.teams[teamId].roster, state.puck.position);
}

function closestEligibleSkaterToPoint(players: PlayerState[], point: Vec2): PlayerState | undefined {
  return players
    .filter((player) => player.possessionEligible)
    .sort((a, b) => {
      const distanceDiff = distance(a.position, point) - distance(b.position, point);
      return Math.abs(distanceDiff) > 1e-9 ? distanceDiff : a.id.localeCompare(b.id);
    })[0];
}

function isPressured(state: GameState, carrier: PlayerState): boolean {
  return state.teams[opponentOf(carrier.teamId)].roster.some((opponent) => distance(opponent.position, carrier.position) <= PRESSURE_RADIUS);
}

function isOneTimerCandidate(state: GameState, player: PlayerState): boolean {
  const window = state.puck.receiveWindow;
  if (
    state.puck.intent !== 'pass' ||
    state.puck.state !== 'loose' ||
    !window ||
    state.tick > window.untilTick ||
    (window.targetPlayerId && window.targetPlayerId !== player.id)
  ) {
    return false;
  }

  const goal = { x: attackingGoalX(player.teamId, state.period), y: 0 };
  return (
    distance(player.position, state.puck.position) <= player.radius + 5 &&
    isShotLaneOpen(state, player.position, goal, player.teamId)
  );
}

function bestPassTarget(state: GameState, carrier: PlayerState): PlayerState | undefined {
  return state.teams[carrier.teamId].roster
    .filter((player) => player.id !== carrier.id && player.possessionEligible)
    .filter((player) => isPassLaneOpen(state, carrier.position, player.position, carrier.teamId))
    .sort((a, b) => {
      const aScore = attackingProgress(a, carrier.teamId, state.period) - distance(a.position, carrier.position) * 0.05;
      const bScore = attackingProgress(b, carrier.teamId, state.period) - distance(b.position, carrier.position) * 0.05;
      return bScore - aScore || a.id.localeCompare(b.id);
    })[0];
}

function attackingProgress(player: PlayerState, teamId: TeamId, period: number): number {
  return attackingGoalX(teamId, period) > 0 ? player.position.x : -player.position.x;
}

function isShotLaneOpen(state: GameState, from: Vec2, goal: Vec2, teamId: TeamId): boolean {
  return isLaneOpen(state.teams[opponentOf(teamId)].roster, from, goal, LANE_BLOCK_RADIUS);
}

function isPassLaneOpen(state: GameState, from: Vec2, to: Vec2, teamId: TeamId): boolean {
  return isLaneOpen(state.teams[opponentOf(teamId)].roster, from, to, LANE_BLOCK_RADIUS * 0.75);
}

function isLaneOpen(blockers: PlayerState[], from: Vec2, to: Vec2, radius: number): boolean {
  return blockers.every((blocker) => distanceToSegment(blocker.position, from, to) > radius);
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segment = subtract(end, start);
  const segmentLengthSquared = segment.x * segment.x + segment.y * segment.y;
  if (segmentLengthSquared === 0) {
    return distance(point, start);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / segmentLengthSquared));
  return distance(point, add(start, scale(segment, t)));
}

function slotCenter(teamId: TeamId): Vec2 {
  return {
    x: RINK.slot[teamId].x,
    y: RINK.slot[teamId].y,
  };
}

function dumpTarget(teamId: TeamId, period: number): Vec2 {
  return {
    x: attackingGoalX(teamId, period) > 0 ? RINK.goalLineX - 4 : -RINK.goalLineX + 4,
    y: RINK.height * 0.32,
  };
}

function aiFaceoffDelay(seed: number, teamId: TeamId): number {
  const teamOffset = teamId === 'home' ? 3 : 7;
  return 4 + ((seed + teamOffset) % 10);
}

function opponentOf(teamId: TeamId): TeamId {
  return teamId === 'home' ? 'away' : 'home';
}
