export type ControlHint = {
  keys: string;
  action: string;
};

export const CONTROL_HINTS: ControlHint[] = [
  { keys: 'WASD / Arrows', action: 'Move selected skater' },
  { keys: 'J / Z', action: 'Pass' },
  { keys: 'K / X', action: 'Shoot' },
  { keys: 'L / C', action: 'Poke check / faceoff swipe' },
  { keys: 'Space', action: 'Switch to skater closest to puck' },
  { keys: 'Ctrl+H or ? button', action: 'Show or hide these hints' },
];

export function buildControlHintLines(): string[] {
  const keyColumnWidth = Math.max(...CONTROL_HINTS.map((hint) => hint.keys.length)) + 2;
  return ['CONTROLS', '', ...CONTROL_HINTS.map((hint) => `${hint.keys.padEnd(keyColumnWidth)}${hint.action}`)];
}
