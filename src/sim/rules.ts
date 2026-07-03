import type { GameCommand } from './commands';
import type { GameEvent } from './events';
import type { GameState, PlayerState, TeamId } from './state';
import { findPlayer } from './state';
import { distance } from './vector';

export function applySwitchCommand(state: GameState, command: Extract<GameCommand, { type: 'switchPlayer' }>): GameState {
  const teamId = command.teamId as TeamId;
  const team = state.teams[teamId];
  if (!team) {
    return state;
  }

  const nextPlayerId = command.targetPlayerId ?? closestToPuckPlayerId(state, team.roster, team.controlledPlayerId);
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
  if (state.mode !== 'Gameplay') {
    return command.type === 'switchPlayer';
  }

  if ('playerId' in command) {
    return findPlayer(state, command.playerId) !== undefined;
  }

  return true;
}

function closestToPuckPlayerId(state: GameState, roster: PlayerState[], currentPlayerId: string): string {
  const candidates = roster
    .filter((player) => player.id !== currentPlayerId && player.possessionEligible)
    .sort((a, b) => a.id.localeCompare(b.id));

  let best: PlayerState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateDistance = distance(candidate.position, state.puck.position);
    if (candidateDistance < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }

  return best?.id ?? currentPlayerId;
}
