import { describe, expect, it } from 'vitest';
import { commandsFromInput } from '../../input/commandsFromInput';
import { emptyInputFrame, mergeInputFrames } from '../../input/inputFrame';
import { createInitialState, createRenderSnapshot } from '../../sim/state';

function gameplaySnapshot() {
  return createRenderSnapshot(createInitialState({ seed: 1, startInGameplay: true }));
}

function menuSnapshot() {
  return createRenderSnapshot(createInitialState({ seed: 1, startInMenu: true }));
}

describe('AT-027/AT-028 device-agnostic input mapping', () => {
  it('maps menu selections to startMatch and ignores gameplay flags in Menu', () => {
    const frame = { ...emptyInputFrame(), startShootout: true, shoot: true, pass: true };
    const commands = commandsFromInput(frame, menuSnapshot(), 5);
    expect(commands).toEqual([{ type: 'startMatch', matchType: 'shootout', tick: 5 }]);

    const regulation = commandsFromInput({ ...emptyInputFrame(), startRegulation: true }, menuSnapshot(), 6);
    expect(regulation).toEqual([{ type: 'startMatch', matchType: 'regulation', tick: 6 }]);
  });

  it('maps every gameplay control to its command (touch completeness)', () => {
    const frame = {
      direction: { x: 1, y: 0 },
      pass: true,
      shoot: true,
      poke: true,
      boost: true,
      switchPlayer: true,
      startRegulation: false,
      startShootout: false,
    };
    const commands = commandsFromInput(frame, gameplaySnapshot(), 9);
    const types = commands.map((command) => command.type).sort();
    expect(types).toEqual(['boost', 'move', 'pass', 'pokeCheck', 'shoot', 'switchPlayer']);
    for (const command of commands) {
      expect(command.tick).toBe(9);
      if ('playerId' in command) {
        expect(command.playerId).toBe('home-c');
      }
    }
  });

  it('produces identical commands for identical frames regardless of source (device parity)', () => {
    const touchOnly = mergeInputFrames(
      { ...emptyInputFrame(), direction: { x: 0.6, y: -0.8 }, shoot: true },
      emptyInputFrame(),
    );
    const keyboardOnly = mergeInputFrames(emptyInputFrame(), {
      ...emptyInputFrame(),
      direction: { x: 0.6, y: -0.8 },
      shoot: true,
    });
    const snapshot = gameplaySnapshot();
    expect(commandsFromInput(touchOnly, snapshot, 3)).toEqual(commandsFromInput(keyboardOnly, snapshot, 3));
  });

  it('merges frames with primary direction precedence and OR of action flags', () => {
    const touch = { ...emptyInputFrame(), direction: { x: 1, y: 0 }, boost: true };
    const keyboard = { ...emptyInputFrame(), direction: { x: -1, y: 0 }, pass: true };
    const merged = mergeInputFrames(touch, keyboard);
    expect(merged.direction).toEqual({ x: 1, y: 0 });
    expect(merged.boost).toBe(true);
    expect(merged.pass).toBe(true);

    const noTouchDirection = mergeInputFrames({ ...emptyInputFrame(), shoot: true }, keyboard);
    expect(noTouchDirection.direction).toEqual({ x: -1, y: 0 });
  });
});
