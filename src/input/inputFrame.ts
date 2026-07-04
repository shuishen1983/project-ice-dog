import type { Vec2 } from '../sim/vector';
import { length } from '../sim/vector';

export type InputFrame = {
  direction: Vec2;
  pass: boolean;
  shoot: boolean;
  poke: boolean;
  boost: boolean;
  switchPlayer: boolean;
  startRegulation: boolean;
  startShootout: boolean;
};

export function emptyInputFrame(): InputFrame {
  return {
    direction: { x: 0, y: 0 },
    pass: false,
    shoot: false,
    poke: false,
    boost: false,
    switchPlayer: false,
    startRegulation: false,
    startShootout: false,
  };
}

export function mergeInputFrames(primary: InputFrame, secondary: InputFrame): InputFrame {
  return {
    direction: length(primary.direction) > 0 ? primary.direction : secondary.direction,
    pass: primary.pass || secondary.pass,
    shoot: primary.shoot || secondary.shoot,
    poke: primary.poke || secondary.poke,
    boost: primary.boost || secondary.boost,
    switchPlayer: primary.switchPlayer || secondary.switchPlayer,
    startRegulation: primary.startRegulation || secondary.startRegulation,
    startShootout: primary.startShootout || secondary.startShootout,
  };
}
