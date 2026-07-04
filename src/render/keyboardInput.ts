import Phaser from 'phaser';
import type { InputFrame } from '../input/inputFrame';
import { emptyInputFrame } from '../input/inputFrame';

export class KeyboardInput {
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard?.createCursorKeys();
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D,J,K,L,Z,X,C,SPACE,ONE,TWO,SHIFT') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  sample(): InputFrame {
    const frame = emptyInputFrame();
    const left = Boolean(this.cursors?.left.isDown || this.keys?.A.isDown);
    const right = Boolean(this.cursors?.right.isDown || this.keys?.D.isDown);
    const up = Boolean(this.cursors?.up.isDown || this.keys?.W.isDown);
    const down = Boolean(this.cursors?.down.isDown || this.keys?.S.isDown);

    frame.direction = {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0),
    };
    frame.pass = justDown(this.keys?.J) || justDown(this.keys?.Z);
    frame.shoot = justDown(this.keys?.K) || justDown(this.keys?.X);
    frame.poke = justDown(this.keys?.L) || justDown(this.keys?.C);
    frame.boost = justDown(this.keys?.SHIFT);
    frame.switchPlayer = justDown(this.keys?.SPACE);
    frame.startRegulation = justDown(this.keys?.ONE);
    frame.startShootout = justDown(this.keys?.TWO);
    return frame;
  }
}

function justDown(key?: Phaser.Input.Keyboard.Key) {
  return key ? Phaser.Input.Keyboard.JustDown(key) : false;
}
