import Phaser from 'phaser';
import type { GameCommand } from '../sim/commands';
import { FixedStepSimulation } from '../sim/loop';
import { createInitialState, type RenderSnapshot } from '../sim/state';
import { ControlsHelp } from './controlsHelp';
import { DebugOverlay } from './debugOverlay';
import { Hud } from './hud';

const SCALE = 5;
const CENTER_X = 550;
const CENTER_Y = 335;

export class IceScene extends Phaser.Scene {
  private simulation!: FixedStepSimulation;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private debugOverlay!: DebugOverlay;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('IceScene');
  }

  create() {
    this.simulation = new FixedStepSimulation(createInitialState({ seed: 1, startInGameplay: true, enableAi: true }));
    this.graphics = this.add.graphics();
    this.hud = new Hud(this);
    this.debugOverlay = new DebugOverlay(this);
    new ControlsHelp(this);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,J,K,L,Z,X,C,SPACE') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  update(_time: number, deltaMs: number) {
    const snapshot = this.simulation.update(deltaMs / 1000, (nextTick) => this.commandsForInput(nextTick));
    this.renderSnapshot(snapshot);
  }

  private commandsForInput(tick: number) {
    const snapshot = this.simulation.snapshot;
    const selectedPlayerId = snapshot.selectedPlayerId;
    const commands: GameCommand[] = [];
    if (!selectedPlayerId) {
      return commands;
    }

    const direction = this.inputDirection();
    commands.push({ type: 'move' as const, playerId: selectedPlayerId, direction, tick });

    if (justDown(this.keys?.SPACE)) {
      commands.push({ type: 'switchPlayer' as const, teamId: 'home' as const, tick });
    }
    if (justDown(this.keys?.K) || justDown(this.keys?.X)) {
      commands.push({
        type: 'shoot' as const,
        playerId: selectedPlayerId,
        target: { x: snapshot.rink.goalLineX, y: 0 },
        tick,
      });
    }
    if (justDown(this.keys?.J) || justDown(this.keys?.Z)) {
      const target = snapshot.players.find((player) => player.teamId === 'home' && player.id !== selectedPlayerId);
      commands.push({ type: 'pass' as const, playerId: selectedPlayerId, target: target?.id, tick });
    }
    if (justDown(this.keys?.L) || justDown(this.keys?.C)) {
      const selected = snapshot.players.find((player) => player.id === selectedPlayerId);
      commands.push({
        type: 'pokeCheck' as const,
        playerId: selectedPlayerId,
        direction: selected?.facing ?? { x: 1, y: 0 },
        tick,
      });
    }

    return commands;
  }

  private inputDirection() {
    const left = Boolean(this.cursors?.left.isDown || this.keys?.A.isDown);
    const right = Boolean(this.cursors?.right.isDown || this.keys?.D.isDown);
    const up = Boolean(this.cursors?.up.isDown || this.keys?.W.isDown);
    const down = Boolean(this.cursors?.down.isDown || this.keys?.S.isDown);

    return {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0),
    };
  }

  private renderSnapshot(snapshot: RenderSnapshot) {
    this.graphics.clear();
    this.drawRink(snapshot);
    this.drawPlayers(snapshot);
    this.drawPuck(snapshot);
    this.hud.render(snapshot);
    this.debugOverlay.render(snapshot);
  }

  private drawRink(snapshot: RenderSnapshot) {
    const rink = snapshot.rink;
    const left = CENTER_X - (rink.width * SCALE) / 2;
    const top = CENTER_Y - (rink.height * SCALE) / 2;
    const width = rink.width * SCALE;
    const height = rink.height * SCALE;
    const cornerRadius = rink.cornerRadius * SCALE;

    this.graphics.fillStyle(0xf7fbff, 1);
    this.graphics.fillRect(0, 0, 1100, 640);
    this.graphics.fillStyle(0xeaf8ff, 1);
    this.graphics.fillRoundedRect(left, top, width, height, cornerRadius);
    this.graphics.lineStyle(4, 0x1f5d7a, 1);
    this.graphics.strokeRoundedRect(left, top, width, height, cornerRadius);

    this.graphics.lineStyle(2, 0xd73f3f, 0.8);
    this.graphics.lineBetween(CENTER_X, top, CENTER_X, top + height);
    this.graphics.strokeCircle(CENTER_X, CENTER_Y, 13 * SCALE);

    this.graphics.lineStyle(2, 0x2368b8, 0.7);
    this.graphics.lineBetween(toScreenX(-rink.blueLineX), top, toScreenX(-rink.blueLineX), top + height);
    this.graphics.lineBetween(toScreenX(rink.blueLineX), top, toScreenX(rink.blueLineX), top + height);

    const creaseRadius = rink.creaseRadius * SCALE;
    for (const sign of [-1, 1] as const) {
      const goalScreenX = toScreenX(sign * rink.goalLineX);
      const startAngle = sign === -1 ? -Math.PI / 2 : Math.PI / 2;
      const endAngle = sign === -1 ? Math.PI / 2 : Math.PI * 1.5;
      this.graphics.fillStyle(0x9fd4f5, 0.45);
      this.graphics.slice(goalScreenX, CENTER_Y, creaseRadius, startAngle, endAngle, false);
      this.graphics.fillPath();
      this.graphics.lineStyle(2, 0xc83333, 0.9);
      this.graphics.slice(goalScreenX, CENTER_Y, creaseRadius, startAngle, endAngle, false);
      this.graphics.strokePath();
    }

    const goalMouthHalf = (rink.goalMouthWidth / 2) * SCALE;
    this.graphics.lineStyle(2, 0xc83333, 0.8);
    this.graphics.lineBetween(toScreenX(-rink.goalLineX), top, toScreenX(-rink.goalLineX), top + height);
    this.graphics.lineBetween(toScreenX(rink.goalLineX), top, toScreenX(rink.goalLineX), top + height);
    this.graphics.lineStyle(6, 0xc83333, 1);
    this.graphics.lineBetween(toScreenX(-rink.goalLineX), CENTER_Y - goalMouthHalf, toScreenX(-rink.goalLineX), CENTER_Y + goalMouthHalf);
    this.graphics.lineBetween(toScreenX(rink.goalLineX), CENTER_Y - goalMouthHalf, toScreenX(rink.goalLineX), CENTER_Y + goalMouthHalf);
  }

  private drawPlayers(snapshot: RenderSnapshot) {
    for (const player of snapshot.players) {
      const selected = player.id === snapshot.selectedPlayerId;
      const hasPuck = player.id === snapshot.puck.ownerId;
      const screenX = toScreenX(player.position.x);
      const screenY = toScreenY(player.position.y);
      this.graphics.fillStyle(player.teamId === 'home' ? 0x0f6bdc : 0xd63d32, 1);
      this.graphics.fillCircle(screenX, screenY, player.radius * SCALE);

      if (hasPuck) {
        this.graphics.lineStyle(4, 0x2fbf71, 1);
        this.graphics.strokeCircle(screenX, screenY, player.radius * SCALE + 10);
      }

      const stickLength = (player.radius + (selected ? 3.5 : 2.5)) * SCALE;
      this.graphics.lineStyle(selected ? 4 : 2, selected ? 0xf4c542 : 0x10202f, 1);
      this.graphics.lineBetween(
        screenX,
        screenY,
        screenX + player.facing.x * stickLength,
        screenY + player.facing.y * stickLength,
      );

      if (selected) {
        this.graphics.lineStyle(3, 0xf4c542, 1);
        this.graphics.strokeCircle(screenX, screenY, player.radius * SCALE + 6);
      }
    }

    for (const goalie of snapshot.goalies) {
      this.graphics.fillStyle(goalie.teamId === 'home' ? 0x0b3f86 : 0x8f231c, 1);
      this.graphics.fillRect(
        toScreenX(goalie.position.x) - goalie.radius * SCALE,
        toScreenY(goalie.position.y) - goalie.radius * SCALE,
        goalie.radius * SCALE * 2,
        goalie.radius * SCALE * 2,
      );
    }
  }

  private drawPuck(snapshot: RenderSnapshot) {
    this.graphics.fillStyle(0x111111, 1);
    this.graphics.fillCircle(toScreenX(snapshot.puck.position.x), toScreenY(snapshot.puck.position.y), 5);
    if (!snapshot.puck.ownerId) {
      this.graphics.lineStyle(2, snapshot.puck.intent === 'shot' ? 0xd63d32 : 0x2fbf71, 1);
      this.graphics.strokeCircle(toScreenX(snapshot.puck.position.x), toScreenY(snapshot.puck.position.y), 9);
    }
  }
}

function toScreenX(x: number) {
  return CENTER_X + x * SCALE;
}

function toScreenY(y: number) {
  return CENTER_Y + y * SCALE;
}

function justDown(key?: Phaser.Input.Keyboard.Key) {
  return key ? Phaser.Input.Keyboard.JustDown(key) : false;
}
