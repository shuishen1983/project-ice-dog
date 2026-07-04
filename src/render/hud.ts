import Phaser from 'phaser';
import type { RenderSnapshot } from '../sim/state';
import { TEAM_COLORS } from './teamColors';

export class Hud {
  private readonly homeScoreText: Phaser.GameObjects.Text;
  private readonly awayScoreText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly possessionText: Phaser.GameObjects.Text;
  private readonly boostText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const background = scene.add.rectangle(0, 0, 1100, 58, 0x10202f, 0.82);
    background.setOrigin(0, 0);
    background.setDepth(9);

    this.homeScoreText = scene.add.text(24, 16, '', {
      color: TEAM_COLORS.home.hud,
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });
    this.awayScoreText = scene.add.text(120, 16, '', {
      color: TEAM_COLORS.away.hud,
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });
    this.clockText = scene.add.text(258, 16, '', {
      color: '#dcecf7',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    });
    this.possessionText = scene.add.text(570, 14, '', {
      color: '#31485c',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      fontStyle: '700',
    });
    this.boostText = scene.add.text(570, 36, '', {
      color: '#177a8c',
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      fontStyle: '700',
    });
    this.homeScoreText.setDepth(10);
    this.awayScoreText.setDepth(10);
    this.clockText.setDepth(10);
    this.possessionText.setDepth(10);
    this.boostText.setDepth(10);
  }

  render(snapshot: RenderSnapshot) {
    const minutes = Math.floor(snapshot.clockSeconds / 60);
    const seconds = Math.floor(snapshot.clockSeconds % 60)
      .toString()
      .padStart(2, '0');
    const possession = snapshot.puck.ownerId
      ? `PUCK ${snapshot.puck.ownerId.toUpperCase()}`
      : `PUCK ${snapshot.puck.intent.toUpperCase()}`;
    this.homeScoreText.setText(`HOME ${snapshot.score.home}`);
    this.awayScoreText.setText(`AWAY ${snapshot.score.away}`);
    if (snapshot.matchType === 'shootout' && snapshot.shootout) {
      const shooter = snapshot.shootout.shooterTeamId.toUpperCase();
      this.clockText.setText(`SO R${snapshot.shootout.round} ${shooter}  ${minutes}:${seconds}  ${snapshot.mode}`);
    } else {
      this.clockText.setText(`P${snapshot.period}  ${minutes}:${seconds}  ${snapshot.mode}`);
    }
    this.possessionText.setText(possession);
    this.boostText.setText(boostLabel(snapshot));
  }
}

function boostLabel(snapshot: RenderSnapshot): string {
  const selected = snapshot.players.find((player) => player.id === snapshot.selectedPlayerId);
  if (!selected) {
    return '';
  }
  if (snapshot.tick < selected.boostUntilTick) {
    return 'BOOST!';
  }
  if (snapshot.tick < selected.boostReadyAtTick) {
    const seconds = Math.ceil((selected.boostReadyAtTick - snapshot.tick) / 60);
    return `BOOST IN ${seconds}s`;
  }
  return 'BOOST READY';
}
