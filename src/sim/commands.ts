import type { MatchType } from './state';
import type { Vec2 } from './vector';

export type CommandSource = 'human' | 'ai';

export type GameCommand =
  | { type: 'move'; playerId: string; direction: Vec2; tick: number; source?: CommandSource }
  | { type: 'switchPlayer'; teamId: string; targetPlayerId?: string; tick: number; source?: CommandSource }
  | { type: 'pass'; playerId: string; target?: Vec2 | string; tick: number; source?: CommandSource }
  | { type: 'shoot'; playerId: string; target: Vec2; tick: number; source?: CommandSource }
  | { type: 'dump'; playerId: string; target: Vec2; tick: number; source?: CommandSource }
  | { type: 'pokeCheck'; playerId: string; direction: Vec2; tick: number; source?: CommandSource }
  | { type: 'boost'; playerId: string; tick: number; source?: CommandSource }
  | { type: 'startMatch'; matchType: MatchType; tick: number; source?: CommandSource };

export function sortCommands(commands: GameCommand[]): GameCommand[] {
  return [...commands].sort((a, b) => {
    const tickDiff = a.tick - b.tick;
    if (tickDiff !== 0) {
      return tickDiff;
    }

    const aActor = 'playerId' in a ? a.playerId : 'teamId' in a ? a.teamId : a.type;
    const bActor = 'playerId' in b ? b.playerId : 'teamId' in b ? b.teamId : b.type;
    const actorDiff = aActor.localeCompare(bActor);
    if (actorDiff !== 0) {
      return actorDiff;
    }

    return a.type.localeCompare(b.type);
  });
}
