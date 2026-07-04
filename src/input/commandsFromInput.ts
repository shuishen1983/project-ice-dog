import type { GameCommand } from '../sim/commands';
import type { RenderSnapshot } from '../sim/state';
import type { InputFrame } from './inputFrame';

export function commandsFromInput(frame: InputFrame, snapshot: RenderSnapshot, tick: number): GameCommand[] {
  const commands: GameCommand[] = [];

  if (snapshot.mode === 'Menu') {
    if (frame.startRegulation) {
      commands.push({ type: 'startMatch', matchType: 'regulation', tick });
    }
    if (frame.startShootout) {
      commands.push({ type: 'startMatch', matchType: 'shootout', tick });
    }
    return commands;
  }

  const selectedPlayerId = snapshot.selectedPlayerId;
  if (!selectedPlayerId) {
    return commands;
  }

  commands.push({ type: 'move', playerId: selectedPlayerId, direction: frame.direction, tick });

  if (frame.switchPlayer) {
    commands.push({ type: 'switchPlayer', teamId: 'home', tick });
  }
  if (frame.boost) {
    commands.push({ type: 'boost', playerId: selectedPlayerId, tick });
  }
  if (frame.shoot) {
    commands.push({ type: 'shoot', playerId: selectedPlayerId, target: { x: snapshot.rink.goalLineX, y: 0 }, tick });
  }
  if (frame.pass) {
    const target = snapshot.players.find((player) => player.teamId === 'home' && player.id !== selectedPlayerId);
    commands.push({ type: 'pass', playerId: selectedPlayerId, target: target?.id, tick });
  }
  if (frame.poke) {
    const selected = snapshot.players.find((player) => player.id === selectedPlayerId);
    commands.push({
      type: 'pokeCheck',
      playerId: selectedPlayerId,
      direction: selected?.facing ?? { x: 1, y: 0 },
      tick,
    });
  }

  return commands;
}
