import type { Vec2 } from './vector';

export type GameCommand =
  | { type: 'move'; playerId: string; direction: Vec2; tick: number }
  | { type: 'switchPlayer'; teamId: string; targetPlayerId?: string; tick: number }
  | { type: 'pass'; playerId: string; target?: Vec2 | string; tick: number }
  | { type: 'shoot'; playerId: string; target: Vec2; tick: number }
  | { type: 'pokeCheck'; playerId: string; direction: Vec2; tick: number };

export function sortCommands(commands: GameCommand[]): GameCommand[] {
  return [...commands].sort((a, b) => {
    const tickDiff = a.tick - b.tick;
    if (tickDiff !== 0) {
      return tickDiff;
    }

    const aActor = 'playerId' in a ? a.playerId : a.teamId;
    const bActor = 'playerId' in b ? b.playerId : b.teamId;
    const actorDiff = aActor.localeCompare(bActor);
    if (actorDiff !== 0) {
      return actorDiff;
    }

    return a.type.localeCompare(b.type);
  });
}
