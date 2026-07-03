import Phaser from 'phaser';
import { IceScene } from './render/phaserScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1100,
  height: 640,
  backgroundColor: '#f4fbff',
  scene: [IceScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
