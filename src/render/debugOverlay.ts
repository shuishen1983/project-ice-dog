import Phaser from 'phaser';
import type { RenderSnapshot } from '../sim/state';
import { buildDebugLines } from './debugModel';

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(24, 574, '', {
      color: '#20313f',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '12px',
      lineSpacing: 3,
    });
    this.text.setDepth(10);
  }

  render(snapshot: RenderSnapshot) {
    this.text.setText(buildDebugLines(snapshot).join('\n'));
  }
}
