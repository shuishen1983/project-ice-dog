import { describe, expect, it } from 'vitest';
import { buildRenderModel } from '../../render/renderModel';
import { createRenderSnapshot, createInitialState } from '../../sim/state';

describe('Pass 4 render smoke model', () => {
  it('AT-016 exposes required rink, HUD, player, puck, and feedback elements', () => {
    const snapshot = createRenderSnapshot(createInitialState({ startInGameplay: true, enableAi: true }));
    const elements = buildRenderModel(snapshot);
    const kinds = elements.map((element) => element.kind);

    expect(kinds).toContain('rink');
    expect(kinds).toContain('boards');
    expect(kinds).toContain('centerLine');
    expect(kinds.filter((kind) => kind === 'blueLine')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'goalMouth')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'skater')).toHaveLength(6);
    expect(kinds.filter((kind) => kind === 'goalie')).toHaveLength(2);
    expect(kinds).toContain('puck');
    expect(kinds).toContain('score');
    expect(kinds).toContain('periodClock');
    expect(kinds).toContain('selectedPlayer');
    expect(kinds).toContain('possessionMarker');
    expect(kinds.filter((kind) => kind === 'skaterFacing')).toHaveLength(6);
  });
});
