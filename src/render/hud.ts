import Phaser from 'phaser';
import type { RenderSnapshot } from '../sim/state';

export class Hud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly possessionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scoreText = scene.add.text(24, 16, '', {
      color: '#10202f',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });
    this.clockText = scene.add.text(460, 16, '', {
      color: '#10202f',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });
    this.possessionText = scene.add.text(760, 18, '', {
      color: '#31485c',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      fontStyle: '700',
    });
    this.scoreText.setDepth(10);
    this.clockText.setDepth(10);
    this.possessionText.setDepth(10);
  }

  render(snapshot: RenderSnapshot) {
    const minutes = Math.floor(snapshot.clockSeconds / 60);
    const seconds = Math.floor(snapshot.clockSeconds % 60)
      .toString()
      .padStart(2, '0');
    const possession = snapshot.puck.ownerId
      ? `PUCK ${snapshot.puck.ownerId.toUpperCase()}`
      : `PUCK ${snapshot.puck.intent.toUpperCase()}`;
    this.scoreText.setText(`HOME ${snapshot.score.home}  AWAY ${snapshot.score.away}`);
    this.clockText.setText(`P${snapshot.period}  ${minutes}:${seconds}  ${snapshot.mode}`);
    this.possessionText.setText(possession);
  }
}
