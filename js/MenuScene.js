import { DEFAULT_AUDIO_SETTINGS } from './audio/BattleAudioManager.js';
import { ARCADE_BOSS } from './data/characters.js';
import { formatArcadeTime, loadArcadeRecord } from './data/arcadeRecords.js';
import NetworkManager from './network/NetworkManager.js';

const MENU_OPTIONS = [
  { title: '1. MODO ARCADE (1P)', subtitle: 'Supera a todo el róster y derrota a Amparo Grisales.', mode: 'ARCADE', accent: 0xffd23f },
  { title: '2. VS CPU (1P)', subtitle: 'Elige luchador y rival para una pelea rápida.', mode: 'VS_CPU', accent: 0xff6b87 },
  { title: '3. VERSUS LOCAL (2P)', subtitle: 'Dos jugadores en el mismo teclado o con mandos.', mode: 'VERSUS_2P', accent: 0x69bfff },
  { title: '4. ENTRENAMIENTO', subtitle: 'Elige un luchador, consulta sus controles y practica sin límites.', mode: 'TRAINING', accent: 0xffa64d },
  { title: '5. MULTIJUGADOR ONLINE', subtitle: 'Crea o únete a una sala privada de cuatro letras.', mode: 'ONLINE', accent: 0x5eff9d },
  { title: '6. OPCIONES', subtitle: 'Audio y guía completa de controles.', mode: 'OPTIONS', accent: 0xa66cff }
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  preload() {
    this.loadAudioIfMissing('bgm_menu', 'assets/audio/bgm_menu.mp3');
    this.loadAudioIfMissing('sfx_enter', 'assets/audio/sfx_enter.mp3');
    this.loadAudioIfMissing('sfx_hover', 'assets/audio/sfx_hover.wav');
    this.loadAudioIfMissing('sfx_select', 'assets/audio/sfx_select.mp3');
  }

  create() {
    this.transitioning = false;
    this.optionsOpen = false;
    this.focusedIndex = 0;
    this.menuButtons = [];
    this.applyAudioSettings();
    this.ensureMenuMusic();
    this.drawBackground();

    const logoFrame = this.add.graphics();
    logoFrame.fillStyle(0x090d1d, 0.72);
    logoFrame.fillRoundedRect(222, 42, 836, 108, 18);
    logoFrame.lineStyle(5, 0x4bc6ff, 0.75);
    logoFrame.strokeRoundedRect(222, 42, 836, 108, 18);
    logoFrame.lineStyle(2, 0xff315f, 1);
    logoFrame.strokeRoundedRect(232, 52, 816, 88, 14);
    const logoGlow = this.add.rectangle(640, 96, 790, 82, 0xff315f, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    const logoEcho = this.add.text(647, 103, 'GUACHAFITA STRIKE', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '59px', fontStyle: 'bold italic',
      color: '#42cfff', stroke: '#07101e', strokeThickness: 13
    }).setOrigin(0.5).setAlpha(0.62).setAngle(-1);
    const logo = this.add.text(640, 94, 'GUACHAFITA STRIKE', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '59px', fontStyle: 'bold italic',
      color: '#ffe357', stroke: '#ff315f', strokeThickness: 9,
      shadow: { color: '#ff315f', blur: 26, fill: true }
    }).setOrigin(0.5).setAngle(-1);
    this.add.text(640, 169, 'ELIGE CÓMO QUIERES ARMAR LA GUACHAFITA', {
      fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#b8c7df', letterSpacing: 3
    }).setOrigin(0.5);

    const bestRecord = loadArcadeRecord();
    this.add.text(640, 202, bestRecord
      ? `MEJOR TIEMPO ARCADE  ${formatArcadeTime(bestRecord.timeMs)}  ·  ${bestRecord.characterName.toUpperCase()}`
      : 'MEJOR TIEMPO ARCADE  --:--.--  ·  SIN REGISTRO', {
      fontFamily: 'Consolas, monospace', fontSize: '13px', fontStyle: 'bold',
      color: bestRecord ? '#ffd84d' : '#75859d', letterSpacing: 1
    }).setOrigin(0.5);

    MENU_OPTIONS.forEach((option, index) => {
      this.menuButtons.push(this.createMenuButton(640, 250 + index * 64, 620, 56, option, index));
    });

    this.add.text(640, 675, '↑ ↓ NAVEGAR  ·  ENTER / A CONFIRMAR', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#8292aa', letterSpacing: 2
    }).setOrigin(0.5);

    this.keyboardHandler = event => this.handleKeyboard(event);
    this.gamepadHandler = (pad, button) => this.handleGamepad(button);
    this.input.keyboard.on('keydown', this.keyboardHandler);
    this.input.gamepad?.on('down', this.gamepadHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyboardHandler);
      this.input.gamepad?.off('down', this.gamepadHandler);
    });

    this.setFocus(0, false);
    this.cameras.main.fadeIn(260, 4, 7, 15);
    this.tweens.add({ targets: logo, scale: 1.035, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: [logo, logoEcho], y: '-=6', duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: logoEcho, alpha: { from: 0.28, to: 0.78 }, duration: 720, yoyo: true, repeat: -1 });
    this.tweens.add({
      targets: logoGlow,
      alpha: { from: 0.04, to: 0.24 },
      scaleX: { from: 0.96, to: 1.06 },
      scaleY: { from: 0.84, to: 1.15 },
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({ targets: logoFrame, alpha: { from: 0.72, to: 1 }, duration: 1080, yoyo: true, repeat: -1 });
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x100525, 0x100525, 0xd65758, 0xd65758, 1);
    g.fillRect(0, 0, 1280, 430);
    const sun = this.add.circle(640, 330, 110, 0xffb94a, 0.72);
    this.tweens.add({ targets: sun, alpha: 0.46, scale: 1.04, duration: 1400, yoyo: true, repeat: -1 });

    g.fillStyle(0x100b24, 1);
    for (let x = 0; x < 1280; x += 42) {
      const buildingHeight = 38 + ((x * 13) % 115);
      g.fillRect(x, 430 - buildingHeight, Math.min(34, 1280 - x), buildingHeight);
    }
    g.fillStyle(0x060713, 1);
    g.fillRect(0, 430, 1280, 290);
    g.lineStyle(2, 0xb84dff, 0.46);
    for (let y = 442; y <= 720; y += 28) g.lineBetween(0, y, 1280, y);
    g.lineStyle(2, 0x3d8dff, 0.44);
    for (let x = 0; x <= 1280; x += 96) g.lineBetween(640, 430, x, 720);
    g.lineStyle(3, 0xff4fb8, 0.72);
    g.lineBetween(0, 430, 1280, 430);
    this.createRetroParticles();
  }

  createRetroParticles() {
    if (!this.textures.exists('menu_retro_spark')) {
      const spark = this.make.graphics({ x: 0, y: 0, add: false });
      spark.fillStyle(0xffffff, 1);
      spark.fillRect(4, 0, 4, 12);
      spark.fillRect(0, 4, 12, 4);
      spark.fillStyle(0xffffff, 0.65);
      spark.fillRect(2, 2, 8, 8);
      spark.generateTexture('menu_retro_spark', 12, 12);
      spark.destroy();
    }
    this.menuParticles = this.add.particles(0, 0, 'menu_retro_spark', {
      x: { min: 20, max: 1260 },
      y: { min: 170, max: 715 },
      lifespan: { min: 2600, max: 5200 },
      speedX: { min: -9, max: 9 },
      speedY: { min: -28, max: -10 },
      rotate: { min: 0, max: 180 },
      scale: { start: 0.85, end: 0.08 },
      alpha: { start: 0.78, end: 0 },
      tint: [0xffe357, 0xff5a83, 0x4bc6ff, 0xa66cff],
      frequency: 135,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD
    });
  }

  createMenuButton(x, y, width, height, option, index) {
    const bg = this.add.graphics();
    const title = this.add.text(-width / 2 + 24, -13, option.title, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0, 0.5);
    const subtitle = this.add.text(-width / 2 + 24, 17, option.subtitle, {
      fontFamily: 'Arial', fontSize: '12px', color: '#aebdd2'
    }).setOrigin(0, 0.5);
    const marker = this.add.text(width / 2 - 30, 0, '›', {
      fontFamily: 'Arial', fontSize: '35px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const container = this.add.container(x, y, [bg, title, subtitle, marker, hitZone]);
    const view = { option, index, container, bg, title, subtitle, marker, width, height };

    hitZone.on('pointerover', () => this.setFocus(index, true));
    hitZone.on('pointerdown', () => container.setScale(0.985));
    hitZone.on('pointerup', () => {
      container.setScale(1);
      this.activateFocusedOption();
    });
    this.drawMenuButton(view, false);
    return view;
  }

  drawMenuButton(view, focused) {
    const { bg, width, height, option, title, subtitle, marker } = view;
    bg.clear();
    if (focused) {
      bg.fillStyle(option.accent, 0.13);
      bg.fillRoundedRect(-width / 2 - 7, -height / 2 - 6, width + 14, height + 12, 15);
    }
    bg.fillStyle(focused ? 0x213753 : 0x10192b, 0.98);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    bg.lineStyle(focused ? 4 : 2, focused ? option.accent : 0x3d4b62, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    title.setColor(focused ? '#ffd84d' : '#ffffff');
    subtitle.setColor(focused ? '#e6f2ff' : '#aebdd2');
    marker.setColor(focused ? '#ffd84d' : '#718198');
  }

  setFocus(index, playSound = true) {
    this.focusedIndex = Phaser.Math.Wrap(index, 0, MENU_OPTIONS.length);
    this.menuButtons.forEach(view => {
      const focused = view.index === this.focusedIndex;
      this.drawMenuButton(view, focused);
      this.tweens.killTweensOf(view.container);
      if (focused) {
        this.tweens.add({
          targets: view.container,
          scale: { from: 1.012, to: 1.035 },
          duration: 430,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        view.container.setScale(1);
      }
    });
    if (playSound) this.playOneShot('sfx_hover', 0.34);
  }

  handleKeyboard(event) {
    if (event.repeat || this.transitioning) return;
    if (this.optionsOpen) {
      if (event.code === 'Escape') this.closeOptions();
      return;
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') this.setFocus(this.focusedIndex - 1);
    if (event.code === 'ArrowDown' || event.code === 'KeyS') this.setFocus(this.focusedIndex + 1);
    if (event.code === 'Enter' || event.code === 'Space') this.activateFocusedOption();
  }

  handleGamepad(button) {
    if (!button || this.transitioning) return;
    if (this.optionsOpen) {
      if (button.index === 1) this.closeOptions();
      return;
    }
    if (button.index === 12) this.setFocus(this.focusedIndex - 1);
    if (button.index === 13) this.setFocus(this.focusedIndex + 1);
    if (button.index === 0) this.activateFocusedOption();
  }

  activateFocusedOption() {
    const option = MENU_OPTIONS[this.focusedIndex];
    this.unlockAudioContext();
    this.ensureMenuMusic();
    this.playOneShot('sfx_select', 0.8);
    this.playConfirmFlash(MENU_OPTIONS[this.focusedIndex].accent);
    if (option.mode === 'OPTIONS') {
      this.openOptions();
      return;
    }
    this.startMode(option.mode);
  }

  startMode(gameMode) {
    this.registry.set('gameMode', gameMode);
    this.registry.set('isCpuMode', !['VERSUS_2P', 'ONLINE', 'TRAINING'].includes(gameMode));
    this.registry.set('isOnline', gameMode === 'ONLINE');
    this.registry.remove('selectedStageId');
    this.registry.remove('selectedStage');
    if (gameMode !== 'ONLINE') NetworkManager.disconnect();
    if (gameMode === 'ARCADE') {
      this.registry.set('arcadeQueue', []);
      this.registry.set('arcadeFightIndex', 0);
      this.registry.set('arcadeElapsedMs', 0);
      this.registry.set('arcadeBossKey', ARCADE_BOSS.id);
      this.registry.remove('arcadePlayerKey');
    }
    this.transitioning = true;
    this.cameras.main.fadeOut(220, 3, 6, 13);
    this.time.delayedCall(230, () => this.scene.start(gameMode === 'ONLINE' ? 'OnlineLobbyScene' : 'SelectScene'));
  }

  openOptions() {
    if (this.optionsOpen) return;
    this.optionsOpen = true;
    const blocker = this.add.rectangle(640, 360, 1280, 720, 0x02040a, 0.9).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0x10192a, 1);
    panel.fillRoundedRect(310, 72, 660, 576, 18);
    panel.lineStyle(4, 0xa66cff, 1);
    panel.strokeRoundedRect(310, 72, 660, 576, 18);
    const title = this.add.text(640, 112, 'OPCIONES', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffd84d'
    }).setOrigin(0.5);
    this.bgmValueText = this.add.text(640, 180, '', {
      fontFamily: 'Consolas, monospace', fontSize: '17px', fontStyle: 'bold', color: '#69bfff'
    }).setOrigin(0.5);
    this.sfxValueText = this.add.text(640, 250, '', {
      fontFamily: 'Consolas, monospace', fontSize: '17px', fontStyle: 'bold', color: '#ff8294'
    }).setOrigin(0.5);
    const guide = this.add.text(640, 390,
      'CONTROLES DE COMBATE\n\nP1: A/D mover · W saltar · S guardia · J/K/L ataques\nP2: Flechas mover/saltar/guardia · I/O/P o Numpad 1/2/3\n\nGAMEPAD: Stick/D-pad mover · Y saltar · L1 guardia · A/B/X ataques', {
        fontFamily: 'Consolas, monospace', fontSize: '14px', color: '#d7e3f4',
        align: 'center', lineSpacing: 7, wordWrap: { width: 580 }
      }).setOrigin(0.5);

    this.optionsContainer = this.add.container(0, 0, [blocker, panel, title, this.bgmValueText, this.sfxValueText, guide]).setDepth(100);
    this.createOptionsButton(this.optionsContainer, 475, 180, '−', () => this.changeAudioSetting('musicVolume', -0.1));
    this.createOptionsButton(this.optionsContainer, 805, 180, '+', () => this.changeAudioSetting('musicVolume', 0.1));
    this.createOptionsButton(this.optionsContainer, 475, 250, '−', () => this.changeAudioSetting('sfxVolume', -0.1));
    this.createOptionsButton(this.optionsContainer, 805, 250, '+', () => this.changeAudioSetting('sfxVolume', 0.1));
    this.createOptionsButton(this.optionsContainer, 550, 580, 'SILENCIAR', () => this.toggleMute(), 190);
    this.createOptionsButton(this.optionsContainer, 755, 580, 'CERRAR', () => this.closeOptions(), 170);
    this.refreshOptionsValues();
  }

  createOptionsButton(parent, x, y, label, onClick, width = 58) {
    const bg = this.add.rectangle(x, y, width, 46, 0x1b2a43, 1).setStrokeStyle(2, 0x69bfff, 1);
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, width, 46).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => bg.setStrokeStyle(4, 0xffd84d, 1));
    zone.on('pointerout', () => bg.setStrokeStyle(2, 0x69bfff, 1));
    zone.on('pointerup', () => {
      this.playConfirmFlash(0x69bfff);
      onClick();
    });
    parent.add([bg, text, zone]);
  }

  changeAudioSetting(key, delta) {
    const settings = this.getAudioSettings();
    settings[key] = Phaser.Math.Clamp(settings[key] + delta, 0, 1);
    this.registry.set('audioSettings', settings);
    if (key === 'musicVolume') this.registry.get('bgmMenuInstance')?.setVolume(settings.musicVolume);
    this.refreshOptionsValues();
    this.playOneShot('sfx_enter', 0.55);
  }

  toggleMute() {
    const settings = this.getAudioSettings();
    settings.muted = !settings.muted;
    this.registry.set('audioSettings', settings);
    this.sound.mute = settings.muted;
    this.refreshOptionsValues();
  }

  refreshOptionsValues() {
    const settings = this.getAudioSettings();
    this.bgmValueText?.setText(`MÚSICA BGM   ${Math.round(settings.musicVolume * 100)}%`);
    this.sfxValueText?.setText(`EFECTOS SFX  ${Math.round(settings.sfxVolume * 100)}%`);
  }

  closeOptions() {
    if (!this.optionsOpen) return;
    this.optionsOpen = false;
    this.optionsContainer?.destroy(true);
    this.optionsContainer = null;
  }

  getAudioSettings() {
    return { ...DEFAULT_AUDIO_SETTINGS, ...(this.registry.get('audioSettings') || {}) };
  }

  applyAudioSettings() {
    const settings = this.getAudioSettings();
    this.sound.mute = settings.muted;
    this.sound.volume = settings.masterVolume;
  }

  ensureMenuMusic() {
    if (!this.cache.audio.exists('bgm_menu')) return null;
    const settings = this.getAudioSettings();
    let music = this.registry.get('bgmMenuInstance');
    if (!music || !music.manager) {
      music = this.sound.add('bgm_menu', { loop: true, volume: settings.musicVolume });
      this.registry.set('bgmMenuInstance', music);
    }
    music.setVolume(settings.musicVolume);
    if (!music.isPlaying) music.play();
    return music;
  }

  unlockAudioContext() {
    if (this.sound.locked && typeof this.sound.unlock === 'function') this.sound.unlock();
    if (this.sound.context?.state === 'suspended') this.sound.context.resume().catch(() => {});
  }

  playOneShot(key, volume = 1) {
    const settings = this.getAudioSettings();
    if (settings.muted || !this.cache.audio.exists(key)) return;
    const sound = this.sound.add(key, { volume: volume * settings.sfxVolume });
    sound.once('complete', () => sound.destroy());
    if (!sound.play()) sound.destroy();
  }

  loadAudioIfMissing(key, path) {
    if (!this.cache.audio.exists(key)) this.load.audio(key, path);
  }

  playConfirmFlash(accent = 0xffd23f) {
    const color = Phaser.Display.Color.IntegerToColor(accent);
    this.cameras.main.flash(165, color.red, color.green, color.blue, false);
  }
}
