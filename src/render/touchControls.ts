import Phaser from 'phaser';
import type { InputFrame } from '../input/inputFrame';
import { emptyInputFrame } from '../input/inputFrame';
import type { Vec2 } from '../sim/vector';

const JOYSTICK_ZONE_X = 420;
const JOYSTICK_RADIUS = 60;
const JOYSTICK_DEADZONE = 0.18;

type ActionKey = 'pass' | 'shoot' | 'poke' | 'boost' | 'switchPlayer';

type ButtonDef = {
  key: ActionKey;
  label: string;
  x: number;
  y: number;
  radius: number;
};

const BUTTONS: ButtonDef[] = [
  { key: 'shoot', label: 'SHOOT', x: 1005, y: 550, radius: 44 },
  { key: 'pass', label: 'PASS', x: 900, y: 590, radius: 36 },
  { key: 'poke', label: 'POKE', x: 905, y: 495, radius: 34 },
  { key: 'boost', label: 'BOOST', x: 1005, y: 448, radius: 34 },
  { key: 'switchPlayer', label: 'SWAP', x: 795, y: 590, radius: 32 },
];

export function touchControlsWanted(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.location.search.includes('touch=1')) {
    return true;
  }
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export class TouchControls {
  private joystickPointerId?: number;
  private joystickBase: Vec2 = { x: 0, y: 0 };
  private direction: Vec2 = { x: 0, y: 0 };
  private pressed: Record<ActionKey, boolean> = {
    pass: false,
    shoot: false,
    poke: false,
    boost: false,
    switchPlayer: false,
  };
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    // Joystick + at least one button may be held at once.
    scene.input.addPointer(3);

    this.base = scene.add.circle(0, 0, JOYSTICK_RADIUS, 0x10202f, 0.18);
    this.base.setStrokeStyle(2, 0x31485c, 0.5);
    this.knob = scene.add.circle(0, 0, 26, 0x31485c, 0.45);
    this.base.setDepth(40);
    this.knob.setDepth(41);
    this.base.setVisible(false);
    this.knob.setVisible(false);

    for (const def of BUTTONS) {
      const button = scene.add.circle(def.x, def.y, def.radius, 0x10202f, 0.28);
      button.setStrokeStyle(2, 0x31485c, 0.7);
      button.setDepth(40);
      button.setInteractive({ useHandCursor: false });
      button.on('pointerdown', () => {
        this.pressed[def.key] = true;
      });
      const label = scene.add.text(def.x, def.y, def.label, {
        color: '#dcecf7',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: def.radius >= 40 ? '16px' : '13px',
        fontStyle: '700',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(41);
      label.setAlpha(0.9);
    }

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId === undefined && pointer.x < JOYSTICK_ZONE_X) {
        this.joystickPointerId = pointer.id;
        this.joystickBase = { x: pointer.x, y: pointer.y };
        this.direction = { x: 0, y: 0 };
        this.base.setPosition(pointer.x, pointer.y);
        this.knob.setPosition(pointer.x, pointer.y);
        this.base.setVisible(true);
        this.knob.setVisible(true);
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystickPointerId) {
        return;
      }
      const dx = pointer.x - this.joystickBase.x;
      const dy = pointer.y - this.joystickBase.y;
      const magnitude = Math.hypot(dx, dy);
      const clamped = Math.min(magnitude, JOYSTICK_RADIUS);
      const strength = clamped / JOYSTICK_RADIUS;
      if (magnitude > 1e-6) {
        this.knob.setPosition(
          this.joystickBase.x + (dx / magnitude) * clamped,
          this.joystickBase.y + (dy / magnitude) * clamped,
        );
      }
      this.direction =
        strength < JOYSTICK_DEADZONE || magnitude <= 1e-6
          ? { x: 0, y: 0 }
          : { x: dx / magnitude, y: dy / magnitude };
    });

    const releaseJoystick = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystickPointerId) {
        return;
      }
      this.joystickPointerId = undefined;
      this.direction = { x: 0, y: 0 };
      this.base.setVisible(false);
      this.knob.setVisible(false);
    };
    scene.input.on('pointerup', releaseJoystick);
    scene.input.on('pointerupoutside', releaseJoystick);
  }

  sample(): InputFrame {
    const frame = emptyInputFrame();
    frame.direction = this.direction;
    frame.pass = this.consume('pass');
    frame.shoot = this.consume('shoot');
    frame.poke = this.consume('poke');
    frame.boost = this.consume('boost');
    frame.switchPlayer = this.consume('switchPlayer');
    return frame;
  }

  private consume(key: ActionKey): boolean {
    const value = this.pressed[key];
    this.pressed[key] = false;
    return value;
  }
}
