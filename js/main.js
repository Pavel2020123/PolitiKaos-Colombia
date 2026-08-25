import TitleScene from './TitleScene.js';
import ModeScene from './ModeScene.js';
import SelectScene from './SelectScene.js';
import BattleScene from './BattleScene.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#070b16',
  pixelArt: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  scene: [TitleScene, ModeScene, SelectScene, BattleScene]
};

new Phaser.Game(config);
