import type { GameCommand } from './commands';
import { advanceTick } from './loop';
import type { GameState, InitialGameConfig } from './state';
import { createInitialState } from './state';

export type ReplayLog = {
  initialConfig: InitialGameConfig;
  commands: GameCommand[];
  ticks: number;
};

export function runReplay(log: ReplayLog): GameState {
  let state = createInitialState(log.initialConfig);

  for (let i = 0; i < log.ticks; i += 1) {
    const nextTick = state.tick + 1;
    const commands = log.commands.filter((command) => command.tick === nextTick);
    state = advanceTick(state, commands).state;
  }

  return state;
}
