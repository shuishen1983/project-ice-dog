import type { GameCommand } from './commands';
import { FACE_OFF, MODE_PAUSE, PERIOD_COUNT, PERIOD_SECONDS, RINK, TICK_SECONDS } from './constants';
import type { GameEvent } from './events';
import type { GameState, PlayerState, TeamId } from './state';
import { attackingGoalX, defendingDirectionX, faceoffFormation, findPlayer, goalieCreasePosition } from './state';
import { distance } from './vector';

export function applySwitchCommand(state: GameState, command: Extract<GameCommand, { type: 'switchPlayer' }>): GameState {
  const teamId = command.teamId as TeamId;
  const team = state.teams[teamId];
  if (!team) {
    return state;
  }

  const nextPlayerId = command.targetPlayerId ?? nextEligibleRosterPlayerId(team.roster, team.controlledPlayerId);
  const targetPlayer = team.roster.find((player) => player.id === nextPlayerId);
  if (!targetPlayer) {
    return state;
  }

  return {
    ...state,
    teams: {
      ...state.teams,
      [teamId]: {
        ...team,
        controlledPlayerId: targetPlayer.id,
        roster: team.roster.map((player) => ({
          ...player,
          hasHumanControl: player.id === targetPlayer.id,
        })),
      },
    },
  };
}

export function appendEvent(state: GameState, event: GameEvent): GameState {
  return {
    ...state,
    events: [...state.events, event],
  };
}

export function isCommandAllowed(state: GameState, command: GameCommand): boolean {
  if (state.mode === 'Faceoff') {
    return command.type === 'switchPlayer' || command.type === 'pokeCheck';
  }

  if (state.mode !== 'Gameplay') {
    return command.type === 'switchPlayer';
  }

  if ('playerId' in command) {
    const player = findPlayer(state, command.playerId);
    if (!player) {
      return false;
    }

    if (command.source !== 'ai' && command.type === 'move' && player.teamId === 'home') {
      return player.id === state.teams.home.controlledPlayerId;
    }

    return true;
  }

  return true;
}

export function startFaceoff(state: GameState, tick: number, spotId = 'center'): GameState {
  const spot = state.rink.faceoffSpots.find((candidate) => candidate.id === spotId) ?? state.rink.faceoffSpots[0];
  const puckPosition = spot?.position ?? { x: 0, y: 0 };
  const homeControlled = state.teams.home.controlledPlayerId;
  const awayControlled = state.teams.away.controlledPlayerId;

  return {
    ...state,
    mode: 'Faceoff',
    modeStartedTick: tick,
    faceoff: {
      spotId,
      startedTick: tick,
      dropTick: tick + FACE_OFF.countdownTicks,
      resolved: false,
    },
    teams: {
      home: {
        ...state.teams.home,
        roster: resetRosterForFaceoff(state.teams.home.roster, 'home', homeControlled),
        goalie: {
          ...state.teams.home.goalie,
          position: goalieCreasePosition('home', state.period),
        },
        controlledPlayerId: homeControlled,
      },
      away: {
        ...state.teams.away,
        roster: resetRosterForFaceoff(state.teams.away.roster, 'away', awayControlled),
        goalie: {
          ...state.teams.away.goalie,
          position: goalieCreasePosition('away', state.period),
        },
        controlledPlayerId: awayControlled,
      },
    },
    puck: {
      ...state.puck,
      position: puckPosition,
      velocity: { x: 0, y: 0 },
      ownerId: undefined,
      state: 'loose',
      intent: 'none',
      ageTicks: 0,
      repossessLockout: undefined,
    },
    events: [
      ...state.events,
      { type: 'modeChanged', mode: 'Faceoff', tick },
      { type: 'faceoffStarted', spotId, tick },
      { type: 'possessionChanged', tick },
    ],
  };
}

export function resolveFaceoff(state: GameState, commands: GameCommand[]): GameState {
  if (state.mode !== 'Faceoff' || !state.faceoff || state.tick < state.faceoff.dropTick) {
    return state;
  }

  const swipeWinner = commands
    .filter((command): command is Extract<GameCommand, { type: 'pokeCheck' }> => command.type === 'pokeCheck')
    .map((command) => findPlayer(state, command.playerId))
    .filter((player): player is PlayerState => Boolean(player))
    .filter((player) => player.role === 'center' && distance(player.position, state.puck.position) <= RINK.faceoffSpots.length + 6)
    .sort((a, b) => a.teamId.localeCompare(b.teamId) || a.id.localeCompare(b.id))[0];

  const shouldAutoResolve = state.tick >= state.faceoff.dropTick + FACE_OFF.autoResolveTicks;
  const winner = swipeWinner ?? (shouldAutoResolve ? deterministicFaceoffWinner(state) : undefined);
  if (!winner) {
    return state;
  }

  return {
    ...state,
    mode: 'Gameplay',
    modeStartedTick: state.tick,
    faceoff: {
      ...state.faceoff,
      resolved: true,
    },
    puck: {
      ...state.puck,
      ownerId: undefined,
      state: 'loose',
      velocity: { x: defendingDirectionX(winner.teamId, state.period) * FACE_OFF.drawBackSpeed, y: 0 },
      lastTouchPlayerId: winner.id,
      lastTouchTeamId: winner.teamId,
      intent: 'loose',
      ageTicks: 0,
    },
    events: [
      ...state.events,
      { type: 'faceoffWon', teamId: winner.teamId, playerId: winner.id, tick: state.tick },
      { type: 'modeChanged', mode: 'Gameplay', tick: state.tick },
    ],
  };
}

export function resolveGoalIfNeeded(state: GameState): GameState {
  if (state.mode !== 'Gameplay') {
    return state;
  }

  const scoringTeamId = scoringTeamForPuck(state);
  if (!scoringTeamId) {
    return state;
  }

  const scoringTeam = state.teams[scoringTeamId];
  return {
    ...state,
    mode: 'Goal',
    modeStartedTick: state.tick,
    teams: {
      ...state.teams,
      [scoringTeamId]: {
        ...scoringTeam,
        score: scoringTeam.score + 1,
      },
    },
    puck: {
      ...state.puck,
      ownerId: undefined,
      state: 'loose',
      velocity: { x: 0, y: 0 },
    },
    events: [
      ...state.events,
      { type: 'goal', teamId: scoringTeamId, scorerId: state.puck.lastTouchPlayerId, tick: state.tick },
      { type: 'modeChanged', mode: 'Goal', tick: state.tick },
    ],
  };
}

export function advanceRulesClock(state: GameState): GameState {
  if (state.mode !== 'Gameplay') {
    return state;
  }

  const clockSeconds = Math.max(0, state.clockSeconds - TICK_SECONDS);
  if (clockSeconds > 0) {
    return { ...state, clockSeconds };
  }

  const periodEndedEvent: GameEvent = { type: 'periodEnded', period: state.period, tick: state.tick };
  if (state.period >= PERIOD_COUNT) {
    const winnerTeamId = winnerForScore(state);
    return {
      ...state,
      mode: 'GameEnd',
      modeStartedTick: state.tick,
      clockSeconds,
      winnerTeamId,
      events: [
        ...state.events,
        periodEndedEvent,
        { type: 'gameEnded', winnerTeamId, tick: state.tick },
        { type: 'modeChanged', mode: 'GameEnd', tick: state.tick },
      ],
    };
  }

  return {
    ...state,
    mode: 'PeriodEnd',
    modeStartedTick: state.tick,
    clockSeconds,
    events: [...state.events, periodEndedEvent, { type: 'modeChanged', mode: 'PeriodEnd', tick: state.tick }],
  };
}

export function advanceTimedMode(state: GameState): GameState {
  if (state.mode === 'Goal' && state.tick - state.modeStartedTick >= MODE_PAUSE.goalTicks) {
    return startFaceoff(state, state.tick);
  }

  if (state.mode === 'PeriodEnd' && state.tick - state.modeStartedTick >= MODE_PAUSE.periodEndTicks) {
    return startFaceoff(
      {
        ...state,
        period: state.period + 1,
        clockSeconds: PERIOD_SECONDS,
      },
      state.tick,
    );
  }

  return state;
}

function resetRosterForFaceoff(roster: PlayerState[], teamId: TeamId, controlledPlayerId: string): PlayerState[] {
  const formation = faceoffFormation(teamId);
  return roster.map((player, index) => ({
    ...player,
    position: formation[index]?.[1] ?? player.position,
    velocity: { x: 0, y: 0 },
    facing: { x: teamId === 'home' ? 1 : -1, y: 0 },
    hasHumanControl: player.id === controlledPlayerId,
    intent: 'idle',
  }));
}

function deterministicFaceoffWinner(state: GameState): PlayerState {
  const homeCenter = state.teams.home.roster.find((player) => player.role === 'center') ?? state.teams.home.roster[0];
  const awayCenter = state.teams.away.roster.find((player) => player.role === 'center') ?? state.teams.away.roster[0];
  return state.seed % 2 === 0 ? (awayCenter as PlayerState) : (homeCenter as PlayerState);
}

function scoringTeamForPuck(state: GameState): TeamId | undefined {
  if (Math.abs(state.puck.position.y) > RINK.goalMouthWidth / 2) {
    return undefined;
  }

  const crossedPositiveGoal = state.puck.position.x >= RINK.goalLineX;
  const crossedNegativeGoal = state.puck.position.x <= -RINK.goalLineX;
  if (!crossedPositiveGoal && !crossedNegativeGoal) {
    return undefined;
  }

  const goalX = crossedPositiveGoal ? RINK.goalLineX : -RINK.goalLineX;
  return attackingGoalX('home', state.period) === goalX ? 'home' : 'away';
}

function winnerForScore(state: GameState): TeamId | undefined {
  if (state.teams.home.score === state.teams.away.score) {
    return undefined;
  }
  return state.teams.home.score > state.teams.away.score ? 'home' : 'away';
}

function nextEligibleRosterPlayerId(roster: PlayerState[], currentPlayerId: string): string {
  const currentIndex = roster.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex === -1) {
    return roster.find((player) => player.possessionEligible)?.id ?? currentPlayerId;
  }

  for (let offset = 1; offset <= roster.length; offset += 1) {
    const candidate = roster[(currentIndex + offset) % roster.length];
    if (candidate?.possessionEligible) {
      return candidate.id;
    }
  }

  return currentPlayerId;
}
