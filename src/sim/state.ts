import { FACE_OFF, GOALIE, PERIOD_SECONDS, PUCK, RINK, SKATER } from './constants';
import type { GameEvent } from './events';
import type { Vec2 } from './vector';
import { normalize } from './vector';

export type TeamId = 'home' | 'away';
export type PlayerRole = 'center' | 'wing' | 'defense';
export type MatchType = 'regulation' | 'shootout';
export type GameMode = 'Boot' | 'Menu' | 'Faceoff' | 'Gameplay' | 'Goal' | 'PeriodEnd' | 'AttemptSetup' | 'AttemptEnd' | 'GameEnd';
export type PuckIntent = 'none' | 'pass' | 'shot' | 'dump' | 'rebound' | 'loose';

export type PlayerState = {
  id: string;
  teamId: TeamId;
  role: PlayerRole;
  position: Vec2;
  velocity: Vec2;
  facing: Vec2;
  radius: number;
  hasHumanControl: boolean;
  possessionEligible: boolean;
  intent: 'idle' | 'move' | 'pass' | 'shoot' | 'support';
};

export type GoalieState = {
  id: string;
  teamId: TeamId;
  position: Vec2;
  radius: number;
  reactionAvailableTick: number;
  intent: 'holdCrease';
};

export type TeamState = {
  id: TeamId;
  side: 'left' | 'right';
  roster: PlayerState[];
  goalie: GoalieState;
  controlledPlayerId: string;
  tacticalMode: 'balanced';
  score: number;
};

export type PuckState = {
  position: Vec2;
  velocity: Vec2;
  ownerId?: string;
  state: 'held' | 'loose';
  lastTouchPlayerId?: string;
  lastTouchTeamId?: TeamId;
  intent: PuckIntent;
  ageTicks: number;
  repossessLockout?: {
    playerId: string;
    untilTick: number;
  };
  receiveWindow?: {
    targetPlayerId?: string;
    untilTick: number;
  };
  goalieHold?: {
    goalieId: string;
    teamId: TeamId;
    releaseTick: number;
  };
};

export type FaceoffState = {
  spotId: string;
  startedTick: number;
  dropTick: number;
  resolved: boolean;
};

export type ShootoutState = {
  round: number;
  shooterTeamId: TeamId;
  shooterPlayerId: string;
  attempts: Record<TeamId, number>;
};

export type GameState = {
  seed: number;
  aiEnabled: boolean;
  humanTeamId?: TeamId;
  tick: number;
  mode: GameMode;
  modeStartedTick: number;
  matchType: MatchType;
  period: number;
  periodSeconds: number;
  clockSeconds: number;
  winnerTeamId?: TeamId;
  faceoff?: FaceoffState;
  shootout?: ShootoutState;
  teams: Record<TeamId, TeamState>;
  puck: PuckState;
  events: GameEvent[];
  rink: typeof RINK;
};

export type RenderSnapshot = {
  seed: number;
  aiEnabled: boolean;
  tick: number;
  mode: GameMode;
  matchType: MatchType;
  shootout?: ShootoutState;
  period: number;
  clockSeconds: number;
  score: Record<TeamId, number>;
  players: PlayerState[];
  goalies: GoalieState[];
  puck: PuckState;
  rink: typeof RINK;
  humanTeamId?: TeamId;
  selectedPlayerId?: string;
  recentEvents: GameEvent[];
};

export type InitialGameConfig = {
  seed?: number;
  startInGameplay?: boolean;
  startInMenu?: boolean;
  enableAi?: boolean;
  humanTeamId?: TeamId | null;
  periodSeconds?: number;
};

const HOME_START: Array<[PlayerRole, Vec2]> = [
  ['center', { x: -16, y: 0 }],
  ['wing', { x: -30, y: -18 }],
  ['defense', { x: -44, y: 18 }],
];

const AWAY_START: Array<[PlayerRole, Vec2]> = [
  ['center', { x: 16, y: 0 }],
  ['wing', { x: 30, y: 18 }],
  ['defense', { x: 44, y: -18 }],
];

export function createInitialState(config: InitialGameConfig = {}): GameState {
  const humanTeamId = config.humanTeamId === null ? undefined : config.humanTeamId ?? 'home';
  const periodSeconds = config.periodSeconds ?? PERIOD_SECONDS;
  const homeRoster = createRoster('home', config.startInGameplay ? HOME_START : faceoffFormation('home'), 'home-c');
  const awayRoster = createRoster('away', config.startInGameplay ? AWAY_START : faceoffFormation('away'), 'away-c');
  const homeCenter = homeRoster[0] as PlayerState;
  const homeControlled = homeCenter.id;

  const initialMode: GameMode = config.startInMenu ? 'Menu' : config.startInGameplay ? 'Gameplay' : 'Faceoff';
  const initialEvents: GameEvent[] = [{ type: 'modeChanged', mode: initialMode, tick: 0 }];
  if (initialMode !== 'Menu') {
    initialEvents.push({ type: 'faceoffStarted', spotId: 'center', tick: 0 });
  }
  if (config.startInGameplay) {
    initialEvents.push({ type: 'possessionChanged', playerId: homeControlled, teamId: 'home', tick: 0 });
  }

  return {
    seed: config.seed ?? 1,
    aiEnabled: config.enableAi ?? false,
    humanTeamId,
    tick: 0,
    mode: initialMode,
    modeStartedTick: 0,
    matchType: 'regulation',
    period: 1,
    periodSeconds,
    clockSeconds: periodSeconds,
    faceoff: config.startInGameplay || config.startInMenu
      ? undefined
      : {
          spotId: 'center',
          startedTick: 0,
          dropTick: FACE_OFF.countdownTicks,
          resolved: false,
        },
    teams: {
      home: {
        id: 'home',
        side: 'left',
        roster: homeRoster.map((player, index) => ({
          ...player,
          hasHumanControl: humanTeamId === 'home' && index === 0,
        })),
        goalie: {
          id: 'home-g',
          teamId: 'home',
          position: goalieCreasePosition('home', 1),
          radius: GOALIE.radius,
          reactionAvailableTick: 0,
          intent: 'holdCrease',
        },
        controlledPlayerId: homeControlled,
        tacticalMode: 'balanced',
        score: 0,
      },
      away: {
        id: 'away',
        side: 'right',
        roster: awayRoster,
        goalie: {
          id: 'away-g',
          teamId: 'away',
          position: goalieCreasePosition('away', 1),
          radius: GOALIE.radius,
          reactionAvailableTick: 0,
          intent: 'holdCrease',
        },
        controlledPlayerId: awayRoster[0]?.id ?? 'away-c',
        tacticalMode: 'balanced',
        score: 0,
      },
    },
    puck: {
      position: config.startInGameplay ? puckPositionForOwner(homeCenter) : { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      ownerId: config.startInGameplay ? homeControlled : undefined,
      state: config.startInGameplay ? 'held' : 'loose',
      lastTouchPlayerId: config.startInGameplay ? homeControlled : undefined,
      lastTouchTeamId: config.startInGameplay ? 'home' : undefined,
      intent: 'none',
      ageTicks: 0,
    },
    events: initialEvents,
    rink: RINK,
  };
}

export function createRenderSnapshot(state: GameState): RenderSnapshot {
  const players = getPlayers(state);
  return {
    seed: state.seed,
    aiEnabled: state.aiEnabled,
    tick: state.tick,
    mode: state.mode,
    matchType: state.matchType,
    shootout: state.shootout,
    period: state.period,
    clockSeconds: state.clockSeconds,
    score: {
      home: state.teams.home.score,
      away: state.teams.away.score,
    },
    players,
    goalies: [state.teams.home.goalie, state.teams.away.goalie],
    puck: state.puck,
    rink: state.rink,
    humanTeamId: state.humanTeamId,
    selectedPlayerId: state.humanTeamId ? state.teams[state.humanTeamId].controlledPlayerId : undefined,
    recentEvents: state.events.slice(-8),
  };
}

export function getPlayers(state: GameState): PlayerState[] {
  return [...state.teams.home.roster, ...state.teams.away.roster];
}

export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return getPlayers(state).find((player) => player.id === playerId);
}

export function puckPositionForOwner(owner: PlayerState): Vec2 {
  const facing = normalize(owner.facing);
  return {
    x: owner.position.x + facing.x * PUCK.stickOffset,
    y: owner.position.y + facing.y * PUCK.stickOffset,
  };
}

export function attackingGoalX(teamId: TeamId, period: number): number {
  const homeAttacksPositive = period % 2 === 1;
  if (teamId === 'home') {
    return homeAttacksPositive ? RINK.goalLineX : -RINK.goalLineX;
  }
  return homeAttacksPositive ? -RINK.goalLineX : RINK.goalLineX;
}

export function defendingDirectionX(teamId: TeamId, period: number): number {
  return attackingGoalX(teamId, period) > 0 ? -1 : 1;
}

export function faceoffFormation(teamId: TeamId): Array<[PlayerRole, Vec2]> {
  const side = teamId === 'home' ? -1 : 1;
  return [
    ['center', { x: side * 3, y: 0 }],
    ['wing', { x: side * 10, y: -9 }],
    ['defense', { x: side * 16, y: 12 }],
  ];
}

export function goalieCreasePosition(teamId: TeamId, period: number): Vec2 {
  const defendingGoalX = attackingGoalX(teamId === 'home' ? 'away' : 'home', period);
  return {
    x: defendingGoalX > 0 ? RINK.goalLineX - GOALIE.creaseOffset : -(RINK.goalLineX - GOALIE.creaseOffset),
    y: 0,
  };
}

function createRoster(teamId: TeamId, starts: Array<[PlayerRole, Vec2]>, centerId: string): PlayerState[] {
  return starts.map(([role, position], index) => {
    const suffix = role === 'center' ? 'c' : role === 'wing' ? 'w' : 'd';
    const id = index === 0 ? centerId : `${teamId}-${suffix}`;
    const attackingDirection = teamId === 'home' ? 1 : -1;
    return {
      id,
      teamId,
      role,
      position,
      velocity: { x: 0, y: 0 },
      facing: { x: attackingDirection, y: 0 },
      radius: SKATER.radius,
      hasHumanControl: false,
      possessionEligible: true,
      intent: 'idle',
    };
  });
}
