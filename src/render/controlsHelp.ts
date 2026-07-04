import Phaser from 'phaser';
import { buildControlHintLines } from './controlHints';

export class ControlsHelp {
  private readonly button: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Container;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.button = scene.add.text(1076, 16, '?  ', {
      color: '#10202f',
      backgroundColor: '#dcecf7',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      padding: { x: 10, y: 12 },
    });
    this.button.setOrigin(1, 0);
    this.button.setDepth(20);
    this.button.setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.toggle());

    const background = scene.add.rectangle(550, 320, 420, 260, 0x10202f, 0.92);
    background.setStrokeStyle(2, 0xdcecf7, 1);
    const text = scene.add.text(550 - 186, 320 - 106, buildControlHintLines().join('\n'), {
      color: '#eaf8ff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '15px',
      lineSpacing: 8,
    });
    this.panel = scene.add.container(0, 0, [background, text]);
    this.panel.setDepth(21);
    this.panel.setVisible(false);

    scene.input.keyboard?.on('keydown-H', (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        this.toggle();
      }
    });
  }

  private toggle() {
    this.visible = !this.visible;
    this.panel.setVisible(this.visible);
  }
}
