import { describe, expect, it } from 'vitest';
import { buildControlHintLines, CONTROL_HINTS } from '../../render/controlHints';

describe('control hints', () => {
  it('covers every spec input mapping', () => {
    const actions = CONTROL_HINTS.map((hint) => hint.action.toLowerCase()).join(' ');
    expect(actions).toContain('move');
    expect(actions).toContain('pass');
    expect(actions).toContain('shoot');
    expect(actions).toContain('poke');
    expect(actions).toContain('switch');

    const keys = CONTROL_HINTS.map((hint) => hint.keys.toLowerCase()).join(' ');
    expect(keys).toContain('wasd');
    expect(keys).toContain('j / z');
    expect(keys).toContain('k / x');
    expect(keys).toContain('l / c');
    expect(keys).toContain('space');
    expect(keys).toContain('ctrl+h');
  });

  it('builds one aligned line per hint plus a title', () => {
    const lines = buildControlHintLines();
    expect(lines[0]).toBe('CONTROLS');
    expect(lines).toHaveLength(CONTROL_HINTS.length + 2);
    for (const hint of CONTROL_HINTS) {
      expect(lines.some((line) => line.startsWith(hint.keys) && line.endsWith(hint.action))).toBe(true);
    }
  });
});
