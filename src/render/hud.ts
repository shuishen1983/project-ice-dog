import Phaser from 'phaser';
import type { RenderSnapshot } from '../sim/state';

export class Hud {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(24, 18, '', {
      color: '#10202f',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '18px',
      fontStyle: '700',
    });
    this.text.setDepth(10);
  }

  render(snapshot: RenderSnapshot) {
    const minutes = Math.floor(snapshot.clockSeconds / 60);
    const seconds = Math.floor(snapshot.clockSeconds % 60)
      .toString()
      .padStart(2, '0');
    this.text.setText(
      `HOME ${snapshot.score.home}  AWAY ${snapshot.score.away}    P${snapshot.period} ${minutes}:${seconds}    ${snapshot.mode}`,
    );
  }
}
