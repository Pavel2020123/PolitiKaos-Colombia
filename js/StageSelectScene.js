import { CHARACTER_BY_ID } from './data/characters.js';
import { STAGES } from '../src/data/stages.js';

const RANDOM_CHOICE = Object.freeze({
  id: 'random',
  name: 'ALEATORIO',
  description: 'Deja que el caos elija una arena por ti. El escenario se revelará al comenzar el combate.',
  accentColor: 0xa66cff
});

export default class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelectScene');
  }

  init(data) {
    const player1Key = data?.player1Key || this.registry.get('selectedP1Key');
    const player2Key = data?.player2Key || this.registry.get('selectedP2Key');
    this.fightData = {
      player1Key,
      player2Key,
      player1: data?.player1 || CHARACTER_BY_ID[player1Key],
      player2: data?.player2 || CHARACTER_BY_ID[player2Key]
    };
    this.choices = [...STAGES, RANDOM_CHOICE];
    this.previewLayers = new Map(STAGES.map(stage => [stage.id, this.getPreviewLayers(stage)]));
  }

  preload() {
    this.failedTextureKeys = new Set();
    this.load.on('loaderror', file => this.failedTextureKeys.add(file.key));
    const uniqueLayers = new Map();
    this.previewLayers.forEach(layers => layers.forEach(layer => uniqueLayers.set(layer.texture, layer)));
    uniqueLayers.forEach(layer => {
      if (layer.image && !this.textures.exists(layer.texture)) this.load.image(layer.texture, layer.image);
    });
    if (!this.cache.audio.exists('bgm_menu')) this.load.audio('bgm_menu', 'assets/audio/bgm_menu.mp3');
    if (!this.cache.audio.exists('sfx_hover')) this.load.audio('sfx_hover', 'assets/audio/sfx_hover.wav');
    if (!this.cache.audio.exists('sfx_select')) this.load.audio('sfx_select', 'assets/audio/sfx_select.mp3');
  }

  create() {
    this.transitioning = false;
    this.focusedIndex = 0;
    this.axisDirection = 0;
    this.axisUnlockedAt = 0;
    this.cards = [];
    this.ensureFallbackPreviews();
    this.ensureMenuMusic();
    this.drawBackground();

    this.add.text(640, 42, 'SELECCIÓN DE ESCENARIO', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '38px', fontStyle: 'bold italic',
      color: '#ffd84d', stroke: '#090d17', strokeThickness: 8
    }).setOrigin(0.5);
    this.add.text(640, 85, 'A / D O FLECHAS · STICK / D-PAD · ENTER / A CONFIRMAR', {
      fontFamily: 'Consolas, monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#82c4ff', letterSpacing: 2
    }).setOrigin(0.5);

    this.focusGlow = this.add.rectangle(0, 0, 278, 308, 0xffd84d, 0.05)
      .setStrokeStyle(5, 0xffd84d, 1)
      .setDepth(3);
    this.tweens.add({
      targets: this.focusGlow,
      alpha: { from: 0.35, to: 0.9 },
      scale: { from: 1, to: 1.018 },
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.choices.forEach((choice, index) => this.createStageCard(choice, index));
    this.createDetailsPanel();
    this.createButtons();
    this.bindInputs();
    this.setFocus(0, false);
    this.cameras.main.fadeIn(230, 4, 7, 15);
  }

  update(time) {
    if (this.transitioning) return;
    const pad = this.input.gamepad?.getPad(0);
    const axis = pad?.axes?.[0]?.getValue?.() ?? 0;
    const direction = axis < -0.55 ? -1 : axis > 0.55 ? 1 : 0;
    if (direction === 0) {
      this.axisDirection = 0;
      return;
    }
    if (direction !== this.axisDirection || time >= this.axisUnlockedAt) {
      this.axisDirection = direction;
      this.axisUnlockedAt = time + 280;
      this.moveFocus(direction);
    }
  }

  getPreviewLayers(stage) {
    const normalize = (value, slot) => {
      if (!value) return null;
      const config = typeof value === 'string' ? { image: value } : value;
      return {
        texture: config.texture || `${stage.id}_${slot}_preview`,
        image: config.image || config.path,
        slot
      };
    };
    const far = normalize(stage.bgFar, 'far');
    const mid = normalize(stage.bgMid, 'mid');
    if (typeof stage.bgImage === 'string' && !stage.bgImage.startsWith('data:') && far) {
      far.texture = stage.bgTexture || `${stage.id}_photo_preview`;
      far.image = stage.bgImage;
    }
    const layers = [far, mid].filter(Boolean);
    if (layers.length) return layers;
    return [normalize({ texture: stage.bgTexture, image: stage.bgImage }, 'legacy')].filter(Boolean);
  }

  ensureFallbackPreviews() {
    STAGES.forEach((stage, stageIndex) => {
      this.previewLayers.get(stage.id).forEach((layer, layerIndex) => {
        if (this.textures.exists(layer.texture)) return;
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        const base = layerIndex === 0 ? 0x15203d : stage.floorColor;
        graphics.fillGradientStyle(base, base, stage.accentColor, stage.accentColor, 1, 1, 0.7, 0.7);
        graphics.fillRect(0, 0, 560, 300);
        graphics.fillStyle(0x0a1020, 0.75);
        for (let x = 0; x < 560; x += 70) {
          const height = 42 + ((x + stageIndex * 31) % 90);
          graphics.fillRect(x, 300 - height, 54, height);
        }
        graphics.lineStyle(5, stage.accentColor, 0.8);
        graphics.lineBetween(0, 294, 560, 294);
        graphics.generateTexture(layer.texture, 560, 300);
        graphics.destroy();
      });
    });
  }

  drawBackground() {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x090d21, 0x1b1038, 0x28133c, 0x0b1429, 1);
    graphics.fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0xff8057, 0.14);
    graphics.fillCircle(640, 340, 240);
    graphics.lineStyle(2, 0x6955d9, 0.22);
    for (let y = 118; y <= 720; y += 42) graphics.lineBetween(0, y, 1280, y);
    for (let x = 0; x <= 1280; x += 64) graphics.lineBetween(x, 118, x, 720);
    graphics.fillStyle(0x050912, 0.82);
    graphics.fillRect(0, 625, 1280, 95);
  }

  createStageCard(choice, index) {
    const x = 170 + index * 313;
    const y = 320;
    const container = this.add.container(x, y).setDepth(4);
    const background = this.add.graphics();
    const previewFrame = this.add.rectangle(0, -47, 244, 150, 0x070b14, 1)
      .setStrokeStyle(2, 0x40516d, 1);
    container.add([background, previewFrame]);

    if (choice.id === 'random') {
      const randomGlow = this.add.circle(0, -47, 64, choice.accentColor, 0.2)
        .setStrokeStyle(4, 0xd5b6ff, 0.8);
      const question = this.add.text(0, -50, '?', {
        fontFamily: 'Trebuchet MS, Arial', fontSize: '92px', fontStyle: 'bold italic',
        color: '#ffffff', stroke: '#6d39a8', strokeThickness: 9
      }).setOrigin(0.5);
      container.add([randomGlow, question]);
      this.tweens.add({ targets: [randomGlow, question], angle: 3, scale: 1.04, duration: 700, yoyo: true, repeat: -1 });
    } else {
      this.previewLayers.get(choice.id).forEach(layer => {
        const image = this.add.image(0, -47, layer.texture);
        image.setScale(Math.min(236 / Math.max(1, image.width), 142 / Math.max(1, image.height)));
        container.add(image);
      });
    }

    const name = this.add.text(0, 64, choice.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffffff',
      align: 'center', wordWrap: { width: 236, useAdvancedWrap: true },
      stroke: '#070b14', strokeThickness: 4
    }).setOrigin(0.5);
    const label = this.add.text(0, 116, choice.id === 'random' ? 'SORPRESA' : `ARENA ${index + 1}`, {
      fontFamily: 'Consolas, monospace', fontSize: '11px', fontStyle: 'bold',
      color: choice.id === 'random' ? '#d5b6ff' : '#90a6c4', letterSpacing: 2
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 270, 300).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => this.setFocus(index, true));
    hitZone.on('pointerup', () => this.setFocus(index, false));
    container.add([name, label, hitZone]);
    container.setData({ background, choice, index });
    this.cards.push(container);
    this.drawCard(container, false);
  }

  drawCard(card, focused) {
    const choice = card.getData('choice');
    const accent = choice.accentColor || 0x69bfff;
    const background = card.getData('background');
    background.clear();
    background.fillStyle(focused ? 0x1c2c48 : 0x101827, focused ? 0.98 : 0.94);
    background.fillRoundedRect(-135, -150, 270, 300, 14);
    background.lineStyle(focused ? 4 : 2, focused ? accent : 0x40516d, 1);
    background.strokeRoundedRect(-135, -150, 270, 300, 14);
  }

  createDetailsPanel() {
    this.add.rectangle(640, 555, 880, 104, 0x0b1426, 0.96)
      .setStrokeStyle(3, 0x5a6f96, 0.9);
    this.stageNameText = this.add.text(640, 528, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '23px', fontStyle: 'bold', color: '#ffd84d'
    }).setOrigin(0.5);
    this.stageDescriptionText = this.add.text(640, 574, '', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '15px', color: '#d3deee', align: 'center',
      wordWrap: { width: 810, useAdvancedWrap: true }
    }).setOrigin(0.5);
  }

  createButtons() {
    this.backButton = this.createButton(120, 674, 190, 52, '‹ PERSONAJES', 0x60708c, () => this.goBack());
    this.confirmButton = this.createButton(640, 674, 350, 58, 'CONFIRMAR ESCENARIO', 0xffd23f, () => this.confirmStage());
  }

  createButton(x, y, width, height, label, accent, callback) {
    const container = this.add.container(x, y).setDepth(8);
    const background = this.add.rectangle(0, 0, width, height, 0x14223a, 1)
      .setStrokeStyle(3, accent, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => {
      background.setFillStyle(0x29486f, 1);
      container.setScale(1.04);
    });
    hitZone.on('pointerout', () => {
      background.setFillStyle(0x14223a, 1);
      container.setScale(1);
    });
    hitZone.on('pointerup', callback);
    container.add([background, text, hitZone]);
    return container;
  }

  bindInputs() {
    this.keyboardHandler = event => {
      if (event.repeat || this.transitioning) return;
      if (['ArrowLeft', 'KeyA'].includes(event.code)) this.moveFocus(-1);
      if (['ArrowRight', 'KeyD'].includes(event.code)) this.moveFocus(1);
      if (['Enter', 'Space'].includes(event.code)) this.confirmStage();
      if (event.code === 'Escape') this.goBack();
    };
    this.gamepadHandler = (pad, button) => {
      if (this.transitioning || !button) return;
      if (button.index === 14) this.moveFocus(-1);
      if (button.index === 15) this.moveFocus(1);
      if (button.index === 0) this.confirmStage();
      if (button.index === 1) this.goBack();
    };
    this.input.keyboard.on('keydown', this.keyboardHandler);
    this.input.gamepad?.on('down', this.gamepadHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyboardHandler);
      this.input.gamepad?.off('down', this.gamepadHandler);
    });
  }

  moveFocus(direction) {
    this.setFocus(Phaser.Math.Wrap(this.focusedIndex + direction, 0, this.choices.length), true);
  }

  setFocus(index, playSound = true) {
    if (this.transitioning) return;
    this.focusedIndex = Phaser.Math.Wrap(index, 0, this.choices.length);
    this.cards.forEach((card, cardIndex) => this.drawCard(card, cardIndex === this.focusedIndex));
    const card = this.cards[this.focusedIndex];
    const choice = this.choices[this.focusedIndex];
    this.focusGlow.setPosition(card.x, card.y).setStrokeStyle(5, choice.accentColor || 0x69bfff, 1);
    this.stageNameText.setText(choice.name.toUpperCase()).setColor(choice.id === 'random' ? '#d5b6ff' : '#ffd84d');
    this.stageDescriptionText.setText(choice.description);
    if (playSound) this.playOneShot('sfx_hover', 0.38);
  }

  confirmStage() {
    if (this.transitioning) return;
    const choice = this.choices[this.focusedIndex];
    const selectedStage = choice.id === 'random'
      ? Phaser.Utils.Array.GetRandom(STAGES)
      : choice;
    this.transitioning = true;
    this.registry.set('selectedStage', selectedStage);
    this.registry.set('selectedStageId', selectedStage.id);
    this.playOneShot('sfx_select', 0.85);
    this.stopMenuMusic();
    this.stageNameText.setText(`ARENA: ${selectedStage.name.toUpperCase()}`).setColor('#5eff9d');
    this.cameras.main.fadeOut(300, 3, 6, 13);
    this.time.delayedCall(310, () => this.scene.start('VersusScene', {
      ...this.fightData,
      stageId: selectedStage.id
    }));
  }

  goBack() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.registry.remove('selectedStage');
    this.registry.remove('selectedStageId');
    this.cameras.main.fadeOut(190, 3, 6, 13);
    this.time.delayedCall(200, () => this.scene.start('SelectScene'));
  }

  ensureMenuMusic() {
    if (!this.cache.audio.exists('bgm_menu')) return;
    let music = this.registry.get('bgmMenuInstance');
    if (!music || !music.manager) {
      music = this.sound.add('bgm_menu', { loop: true, volume: 0.5 });
      this.registry.set('bgmMenuInstance', music);
    }
    if (!music.isPlaying) music.play({ loop: true, volume: 0.5 });
  }

  stopMenuMusic() {
    const music = this.registry.get('bgmMenuInstance');
    if (!music) return;
    if (music.isPlaying || music.isPaused) music.stop();
    if (music.manager) music.destroy();
    this.registry.remove('bgmMenuInstance');
  }

  playOneShot(key, volume = 1) {
    if (!this.cache.audio.exists(key)) return;
    const sound = this.sound.add(key, { volume });
    sound.once('complete', () => sound.destroy());
    if (!sound.play()) sound.destroy();
  }
}
