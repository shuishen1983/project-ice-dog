import { GOALIE, PERIOD_SECONDS, PUCK, RINK, SKATER } from './constants';
import type { GameEvent } from './events';
import type { Vec2 } from './vector';
import { normalize } from './vector';

export type TeamId = 'home' | 'away';
export type PlayerRole = 'center' | 'wing' | 'defense';
export type GameMode = 'Boot' | 'Menu' | 'Faceoff' | 'Gameplay' | 'Goal' | 'PeriodEnd' | 'GameEnd';
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
};

export type GameState = {
  seed: number;
  tick: number;
  mode: GameMode;
  period: number;
  clockSeconds: number;
  winnerTeamId?: TeamId;
  teams: Record<TeamId, TeamState>;
  puck: PuckState;
  events: GameEvent[];
  rink: typeof RINK;
};

export type RenderSnapshot = {
  tick: number;
  mode: GameMode;
  period: number;
  clockSeconds: number;
  score: Record<TeamId, number>;
  players: PlayerState[];
  goalies: GoalieState[];
  puck: PuckState;
  rink: typeof RINK;
  selectedPlayerId?: string;
  recentEvents: GameEvent[];
};

export type InitialGameConfig = {
  seed?: number;
  startInGameplay?: boolean;
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
  const homeRoster = createRoster('home', HOME_START, 'home-c');
  const awayRoster = createRoster('away', AWAY_START, 'away-c');
  const homeCenter = homeRoster[0] as PlayerState;
  const homeControlled = homeCenter.id;

  const initialMode: GameMode = config.startInGameplay ? 'Gameplay' : 'Faceoff';
  const initialEvents: GameEvent[] = [
    { type: 'modeChanged', mode: initialMode, tick: 0 },
    { type: 'faceoffStarted', spotId: 'center', tick: 0 },
    { type: 'possessionChanged', playerId: homeControlled, teamId: 'home', tick: 0 },
  ];

  return {
    seed: config.seed ?? 1,
    tick: 0,
    mode: initialMode,
    period: 1,
    clockSeconds: PERIOD_SECONDS,
    teams: {
      home: {
        id: 'home',
        side: 'left',
        roster: homeRoster.map((player, index) => ({
          ...player,
          hasHumanControl: index === 0,
        })),
        goalie: {
          id: 'home-g',
          teamId: 'home',
          position: { x: -(RINK.goalLineX - GOALIE.creaseOffset), y: 0 },
          radius: GOALIE.radius,
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
          position: { x: RINK.goalLineX - GOALIE.creaseOffset, y: 0 },
          radius: GOALIE.radius,
          intent: 'holdCrease',
        },
        controlledPlayerId: awayRoster[0]?.id ?? 'away-c',
        tacticalMode: 'balanced',
        score: 0,
      },
    },
    puck: {
      position: puckPositionForOwner(homeCenter),
      velocity: { x: 0, y: 0 },
      ownerId: homeControlled,
      state: 'held',
      lastTouchPlayerId: homeControlled,
      lastTouchTeamId: 'home',
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
    tick: state.tick,
    mode: state.mode,
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
    selectedPlayerId: state.teams.home.controlledPlayerId,
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
