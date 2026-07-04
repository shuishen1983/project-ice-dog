import type { GameCommand } from './commands';
import { BOOST, FACE_OFF, MODE_PAUSE, PERIOD_COUNT, RINK, SHOOTOUT, TICK_SECONDS } from './constants';
import type { GameEvent } from './events';
import type { GameState, PlayerState, TeamId } from './state';
import {
  attackingGoalX,
  defendingDirectionX,
  faceoffFormation,
  findPlayer,
  goalieCreasePosition,
  puckPositionForOwner,
} from './state';
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
  if (command.type === 'startMatch') {
    return state.mode === 'Menu';
  }

  if (state.mode === 'Menu' || state.mode === 'AttemptSetup' || state.mode === 'AttemptEnd') {
    return false;
  }

  if (state.mode === 'Faceoff') {
    return command.type === 'switchPlayer' || command.type === 'pokeCheck';
  }

  if (state.mode !== 'Gameplay') {
    return command.type === 'switchPlayer';
  }

  if (state.matchType === 'shootout') {
    return (
      'playerId' in command &&
      command.playerId === state.shootout?.shooterPlayerId &&
      (command.type === 'move' || command.type === 'shoot' || command.type === 'boost')
    );
  }

  if ('playerId' in command) {
    const player = findPlayer(state, command.playerId);
    if (!player) {
      return false;
    }

    if (
      command.source !== 'ai' &&
      (command.type === 'move' || command.type === 'boost') &&
      state.humanTeamId &&
      player.teamId === state.humanTeamId
    ) {
      return player.id === state.teams[state.humanTeamId].controlledPlayerId;
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
        roster: resetRosterForFaceoff(state.teams.home.roster, 'home', homeControlled, state.humanTeamId),
        goalie: {
          ...state.teams.home.goalie,
          position: goalieCreasePosition('home', state.period),
        },
        controlledPlayerId: homeControlled,
      },
      away: {
        ...state.teams.away,
        roster: resetRosterForFaceoff(state.teams.away.roster, 'away', awayControlled, state.humanTeamId),
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

export function applyBoostCommand(state: GameState, command: Extract<GameCommand, { type: 'boost' }>): GameState {
  const player = findPlayer(state, command.playerId);
  if (!player || state.tick < player.boostReadyAtTick) {
    return state;
  }

  const team = state.teams[player.teamId];
  return {
    ...state,
    teams: {
      ...state.teams,
      [player.teamId]: {
        ...team,
        roster: team.roster.map((rosterPlayer) =>
          rosterPlayer.id === player.id
            ? {
                ...rosterPlayer,
                boostUntilTick: state.tick + BOOST.durationTicks,
                boostReadyAtTick: state.tick + BOOST.durationTicks + BOOST.cooldownTicks,
              }
            : rosterPlayer,
        ),
      },
    },
    events: [...state.events, { type: 'boostStarted', playerId: player.id, tick: state.tick }],
  };
}

export function applyStartMatch(state: GameState, command: Extract<GameCommand, { type: 'startMatch' }>): GameState {
  if (state.mode !== 'Menu') {
    return state;
  }

  const started: GameState = {
    ...state,
    matchType: command.matchType,
    events: [...state.events, { type: 'matchStarted', matchType: command.matchType, tick: state.tick }],
  };

  if (command.matchType === 'shootout') {
    return startAttempt(
      {
        ...started,
        shootout: {
          round: 1,
          shooterTeamId: 'home',
          shooterPlayerId: shooterFor(started, 'home'),
          attempts: { home: 0, away: 0 },
        },
      },
      state.tick,
    );
  }

  return startFaceoff(started, state.tick);
}

export function startAttempt(state: GameState, tick: number): GameState {
  const shootout = state.shootout;
  if (!shootout) {
    return state;
  }

  const shooterTeamId = shootout.shooterTeamId;
  const shooterId = shooterFor(state, shooterTeamId);
  const attackDirection = attackingGoalX(shooterTeamId, 1) > 0 ? 1 : -1;

  const placeRoster = (teamId: TeamId): PlayerState[] =>
    state.teams[teamId].roster.map((player, index) => {
      if (player.id === shooterId) {
        return {
          ...player,
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          facing: { x: attackDirection, y: 0 },
          possessionEligible: true,
          hasHumanControl: state.humanTeamId === teamId && player.id === state.teams[teamId].controlledPlayerId,
          intent: 'idle' as const,
        };
      }
      const parkedSign = teamId === 'home' ? -1 : 1;
      return {
        ...player,
        position: { x: parkedSign * (SHOOTOUT.parkedBaseX - index * SHOOTOUT.parkedSpacingX), y: SHOOTOUT.parkedLineY },
        velocity: { x: 0, y: 0 },
        facing: { x: -parkedSign, y: 0 },
        possessionEligible: false,
        hasHumanControl: false,
        intent: 'idle' as const,
      };
    });

  const homeRoster = placeRoster('home');
  const awayRoster = placeRoster('away');
  const shooter = [...homeRoster, ...awayRoster].find((player) => player.id === shooterId) as PlayerState;

  return {
    ...state,
    mode: 'AttemptSetup',
    modeStartedTick: tick,
    faceoff: undefined,
    clockSeconds: SHOOTOUT.attemptSeconds,
    shootout: { ...shootout, shooterPlayerId: shooterId },
    teams: {
      home: {
        ...state.teams.home,
        roster: homeRoster,
        goalie: { ...state.teams.home.goalie, position: goalieCreasePosition('home', 1) },
      },
      away: {
        ...state.teams.away,
        roster: awayRoster,
        goalie: { ...state.teams.away.goalie, position: goalieCreasePosition('away', 1) },
      },
    },
    puck: {
      ...state.puck,
      position: puckPositionForOwner(shooter),
      velocity: { x: 0, y: 0 },
      ownerId: shooterId,
      state: 'held',
      lastTouchPlayerId: shooterId,
      lastTouchTeamId: shooterTeamId,
      intent: 'none',
      ageTicks: 0,
      repossessLockout: undefined,
      receiveWindow: undefined,
      goalieHold: undefined,
    },
    events: [
      ...state.events,
      { type: 'attemptStarted', round: shootout.round, teamId: shooterTeamId, playerId: shooterId, tick },
      { type: 'modeChanged', mode: 'AttemptSetup', tick },
    ],
  };
}

export function resolveAttemptEndIfNeeded(state: GameState): GameState {
  if (state.matchType !== 'shootout' || state.mode !== 'Gameplay') {
    return state;
  }

  if (state.puck.goalieHold) {
    return endAttempt(state, state.tick);
  }

  if (state.puck.state === 'loose' && Math.abs(state.puck.position.x) > RINK.goalLineX) {
    return endAttempt(state, state.tick);
  }

  return state;
}

function endAttempt(state: GameState, tick: number): GameState {
  return {
    ...state,
    mode: 'AttemptEnd',
    modeStartedTick: tick,
    puck: {
      ...state.puck,
      ownerId: undefined,
      state: 'loose',
      velocity: { x: 0, y: 0 },
      goalieHold: undefined,
      receiveWindow: undefined,
    },
    events: [...state.events, { type: 'modeChanged', mode: 'AttemptEnd', tick }],
  };
}

function advanceShootoutAfterAttempt(state: GameState, tick: number, scored: boolean): GameState {
  const shootout = state.shootout;
  if (!shootout) {
    return state;
  }

  const attempts: Record<TeamId, number> = {
    ...shootout.attempts,
    [shootout.shooterTeamId]: shootout.attempts[shootout.shooterTeamId] + 1,
  };
  const events: GameEvent[] = [
    ...state.events,
    { type: 'attemptEnded', round: shootout.round, teamId: shootout.shooterTeamId, scored, tick },
  ];
  const goals: Record<TeamId, number> = {
    home: state.teams.home.score,
    away: state.teams.away.score,
  };

  const winnerTeamId = shootoutWinner(goals, attempts);
  if (winnerTeamId) {
    return {
      ...state,
      mode: 'GameEnd',
      modeStartedTick: tick,
      winnerTeamId,
      shootout: { ...shootout, attempts },
      events: [
        ...events,
        { type: 'gameEnded', winnerTeamId, tick },
        { type: 'modeChanged', mode: 'GameEnd', tick },
      ],
    };
  }

  const nextShooterTeamId: TeamId = shootout.shooterTeamId === 'home' ? 'away' : 'home';
  const nextRound = shootout.shooterTeamId === 'home' ? shootout.round : shootout.round + 1;
  return startAttempt(
    {
      ...state,
      shootout: {
        round: nextRound,
        shooterTeamId: nextShooterTeamId,
        shooterPlayerId: shooterFor(state, nextShooterTeamId),
        attempts,
      },
      events,
    },
    tick,
  );
}

function shootoutWinner(goals: Record<TeamId, number>, attempts: Record<TeamId, number>): TeamId | undefined {
  const pairs: Array<[TeamId, TeamId]> = [
    ['home', 'away'],
    ['away', 'home'],
  ];
  for (const [leader, trailer] of pairs) {
    if (attempts[trailer] < SHOOTOUT.rounds && goals[leader] > goals[trailer] + (SHOOTOUT.rounds - attempts[trailer])) {
      return leader;
    }
  }

  if (attempts.home === attempts.away && attempts.home >= SHOOTOUT.rounds && goals.home !== goals.away) {
    return goals.home > goals.away ? 'home' : 'away';
  }

  return undefined;
}

function shooterFor(state: GameState, teamId: TeamId): string {
  if (state.humanTeamId === teamId) {
    return state.teams[teamId].controlledPlayerId;
  }
  const center = state.teams[teamId].roster.find((player) => player.role === 'center');
  return center?.id ?? state.teams[teamId].controlledPlayerId;
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

  if (state.matchType === 'shootout') {
    return endAttempt({ ...state, clockSeconds }, state.tick);
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
    return state.matchType === 'shootout'
      ? advanceShootoutAfterAttempt(state, state.tick, true)
      : startFaceoff(state, state.tick);
  }

  if (state.mode === 'AttemptSetup' && state.tick - state.modeStartedTick >= SHOOTOUT.setupTicks) {
    return {
      ...state,
      mode: 'Gameplay',
      modeStartedTick: state.tick,
      events: [...state.events, { type: 'modeChanged', mode: 'Gameplay', tick: state.tick }],
    };
  }

  if (state.mode === 'AttemptEnd' && state.tick - state.modeStartedTick >= MODE_PAUSE.attemptEndTicks) {
    return advanceShootoutAfterAttempt(state, state.tick, false);
  }

  if (state.mode === 'PeriodEnd' && state.tick - state.modeStartedTick >= MODE_PAUSE.periodEndTicks) {
    return startFaceoff(
      {
        ...state,
        period: state.period + 1,
        clockSeconds: state.periodSeconds,
      },
      state.tick,
    );
  }

  return state;
}

function resetRosterForFaceoff(
  roster: PlayerState[],
  teamId: TeamId,
  controlledPlayerId: string,
  humanTeamId?: TeamId,
): PlayerState[] {
  const formation = faceoffFormation(teamId);
  return roster.map((player, index) => ({
    ...player,
    position: formation[index]?.[1] ?? player.position,
    velocity: { x: 0, y: 0 },
    facing: { x: teamId === 'home' ? 1 : -1, y: 0 },
    hasHumanControl: humanTeamId === teamId && player.id === controlledPlayerId,
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
