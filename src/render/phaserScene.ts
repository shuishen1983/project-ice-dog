import Phaser from 'phaser';
import { commandsFromInput } from '../input/commandsFromInput';
import { mergeInputFrames } from '../input/inputFrame';
import type { MatchType } from '../sim/state';
import { FixedStepSimulation } from '../sim/loop';
import { createInitialState, type RenderSnapshot } from '../sim/state';
import { ControlsHelp } from './controlsHelp';
import { DebugOverlay } from './debugOverlay';
import { Hud } from './hud';
import { KeyboardInput } from './keyboardInput';
import { TEAM_COLORS } from './teamColors';
import { TouchControls, touchControlsWanted } from './touchControls';

const SCALE = 5;
const CENTER_X = 550;
const CENTER_Y = 335;

export class IceScene extends Phaser.Scene {
  private simulation!: FixedStepSimulation;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private menu!: Phaser.GameObjects.Container;
  private debugOverlay?: DebugOverlay;
  private keyboardInput!: KeyboardInput;
  private touchControls?: TouchControls;
  private menuSelection?: MatchType;

  constructor() {
    super('IceScene');
  }

  create() {
    this.simulation = new FixedStepSimulation(createInitialState({ seed: 1, startInMenu: true, enableAi: true }));
    this.graphics = this.add.graphics();
    this.hud = new Hud(this);
    if (import.meta.env.DEV) {
      this.debugOverlay = new DebugOverlay(this);
    }
    new ControlsHelp(this);
    this.menu = this.createMenu();
    this.keyboardInput = new KeyboardInput(this);
    if (touchControlsWanted()) {
      this.touchControls = new TouchControls(this);
    }
    // Dev/test hook: lets headless drivers inspect the live simulation.
    (window as unknown as { iceScene?: IceScene }).iceScene = this;
  }

  private createMenu(): Phaser.GameObjects.Container {
    const background = this.add.rectangle(550, 320, 460, 200, 0x10202f, 0.92);
    background.setStrokeStyle(2, 0xdcecf7, 1);
    const title = this.add.text(550, 275, 'PROJECT ICE', {
      align: 'center',
      color: '#eaf8ff',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '22px',
      fontStyle: '700',
    });
    title.setOrigin(0.5, 0.5);

    const options: Array<[MatchType, string, number]> = [
      ['regulation', '1 — Regulation (3 periods)', 330],
      ['shootout', '2 — Shootout (best of 5)', 372],
    ];
    const optionTexts = options.map(([matchType, label, y]) => {
      const option = this.add.text(550, y, label, {
        align: 'center',
        color: '#eaf8ff',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '700',
      });
      option.setOrigin(0.5, 0.5);
      option.setInteractive({ useHandCursor: true });
      option.on('pointerdown', () => {
        this.menuSelection = matchType;
      });
      return option;
    });

    const container = this.add.container(0, 0, [background, title, ...optionTexts]);
    container.setDepth(30);
    return container;
  }

  update(_time: number, deltaMs: number) {
    const snapshot = this.simulation.update(deltaMs / 1000, (nextTick) => this.commandsForInput(nextTick));
    this.renderSnapshot(snapshot);
  }

  private commandsForInput(tick: number) {
    const snapshot = this.simulation.snapshot;
    let frame = this.keyboardInput.sample();
    if (this.touchControls) {
      frame = mergeInputFrames(this.touchControls.sample(), frame);
    }
    if (this.menuSelection) {
      frame = {
        ...frame,
        startRegulation: frame.startRegulation || this.menuSelection === 'regulation',
        startShootout: frame.startShootout || this.menuSelection === 'shootout',
      };
      this.menuSelection = undefined;
    }
    return commandsFromInput(frame, snapshot, tick);
  }

  private renderSnapshot(snapshot: RenderSnapshot) {
    this.graphics.clear();
    this.drawRink(snapshot);
    this.drawPlayers(snapshot);
    this.drawPuck(snapshot);
    this.hud.render(snapshot);
    this.debugOverlay?.render(snapshot);
    this.menu.setVisible(snapshot.mode === 'Menu');
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
      this.graphics.fillStyle(TEAM_COLORS[player.teamId].skater, 1);
      this.graphics.fillCircle(screenX, screenY, player.radius * SCALE);

      if (hasPuck) {
        this.graphics.lineStyle(4, 0x2fbf71, 1);
        this.graphics.strokeCircle(screenX, screenY, player.radius * SCALE + 10);
      }

      if (snapshot.tick < player.boostUntilTick) {
        this.graphics.lineStyle(3, 0x22b8cf, 1);
        this.graphics.strokeCircle(screenX, screenY, player.radius * SCALE + 14);
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
      this.graphics.fillStyle(TEAM_COLORS[goalie.teamId].goalie, 1);
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
