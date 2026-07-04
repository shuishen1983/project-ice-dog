import type { GameEvent } from '../sim/events';
import type { RenderSnapshot } from '../sim/state';

export function buildDebugLines(snapshot: RenderSnapshot): string[] {
  return [
    `seed ${snapshot.seed}`,
    `tick ${snapshot.tick}`,
    `mode ${snapshot.mode}`,
    `possession ${possessionLabel(snapshot)}`,
    `events ${snapshot.recentEvents.map(eventLabel).join(' | ') || 'none'}`,
  ];
}

function possessionLabel(snapshot: RenderSnapshot): string {
  if (snapshot.puck.ownerId) {
    return snapshot.puck.ownerId;
  }
  if (snapshot.puck.goalieHold) {
    return `${snapshot.puck.goalieHold.goalieId} hold`;
  }
  return snapshot.puck.intent;
}

function eventLabel(event: GameEvent): string {
  switch (event.type) {
    case 'goal':
      return `goal:${event.teamId}`;
    case 'faceoffWon':
      return `draw:${event.teamId}`;
    case 'possessionChanged':
      return event.playerId ? `puck:${event.playerId}` : 'puck:loose';
    case 'goalieSave':
      return event.trapped ? `save:${event.goalieId}:trap` : `save:${event.goalieId}:rebound`;
    case 'periodEnded':
      return `period:${event.period}`;
    case 'gameEnded':
      return event.winnerTeamId ? `final:${event.winnerTeamId}` : 'final:tie';
    case 'modeChanged':
      return `mode:${event.mode}`;
    case 'faceoffStarted':
      return `faceoff:${event.spotId}`;
    case 'puckReleased':
      return `release:${event.playerId}`;
    case 'matchStarted':
      return `match:${event.matchType}`;
    case 'attemptStarted':
      return `attempt:${event.teamId}:r${event.round}`;
    case 'attemptEnded':
      return event.scored ? `attempt:${event.teamId}:goal` : `attempt:${event.teamId}:miss`;
    case 'boostStarted':
      return `boost:${event.playerId}`;
  }
}
