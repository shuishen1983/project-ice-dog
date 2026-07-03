import { describe, expect, it } from 'vitest';
import { advanceTick } from '../../sim/loop';
import { createInitialState, type GameState } from '../../sim/state';

describe('Pass 4 gameplay completion', () => {
  it('AT-015 runs ten complete AI-vs-AI games without crashing', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const final = runCompleteGame(createInitialState({ seed, enableAi: true, humanTeamId: null, periodSeconds: 2 }));

      expect(final.mode).toBe('GameEnd');
      expect(final.period).toBe(3);
      expect(final.events.some((event) => event.type === 'gameEnded')).toBe(true);
      expect(final.teams.home.score).toBeGreaterThanOrEqual(0);
      expect(final.teams.away.score).toBeGreaterThanOrEqual(0);
    }
  });
});

function runCompleteGame(initial: GameState): GameState {
  let state = initial;
  for (let i = 0; i < 5_000 && state.mode !== 'GameEnd'; i += 1) {
    state = advanceTick(state).state;
  }
  return state;
}
