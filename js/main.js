import MenuScene from './MenuScene.js';
import TitleScene from './TitleScene.js';
import ModeScene from './ModeScene.js';
import SelectScene from './SelectScene.js';
import StageSelectScene from './StageSelectScene.js';
import VersusScene from './VersusScene.js';
import BattleScene from './BattleScene.js';
import PauseScene from './PauseScene.js';
import EndingScene from './EndingScene.js';
import OnlineLobbyScene from './OnlineLobbyScene.js';
import { DEFAULT_AUDIO_SETTINGS } from './audio/BattleAudioManager.js';

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
  input: {
    gamepad: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1100 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  scene: [MenuScene, OnlineLobbyScene, SelectScene, StageSelectScene, VersusScene, BattleScene, PauseScene, EndingScene, TitleScene, ModeScene]
};

const game = new Phaser.Game(config);
game.registry.set('audioSettings', { ...DEFAULT_AUDIO_SETTINGS });
