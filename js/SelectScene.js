const ROSTER = [
  { id: 'abelardo', name: 'Abelardo', texture: 'abelardo_eleccion', color: 0x2f80ed },
  { id: 'alexchar', name: 'Alex Char', texture: 'alexchar', color: 0x22c1c3 },
  { id: 'cepeda', name: 'Cepeda', texture: 'cepeda_eleccion', color: 0xe0a93b },
  { id: 'claudia', name: 'Claudia López', texture: 'claudia_lopez', color: 0x58d68d },
  { id: 'duque', name: 'Duque', texture: 'duque_eleccion', color: 0x7d8ba8 },
  { id: 'fajardo', name: 'Fajardo', texture: 'fajardo', color: 0xf39c5a },
  { id: 'santos', name: 'Santos', texture: 'santos', color: 0x8da0cb },
  { id: 'cabal', name: 'Cabal', texture: 'cabal', color: 0xd46fbd },
  { id: 'migueluribe', name: 'Miguel Uribe', texture: 'miguel_uribe', color: 0x5dade2 },
  { id: 'petro', name: 'Petro', texture: 'petro_eleccion', color: 0xeb3b5a },
  { id: 'polopolo', name: 'Polo Polo', texture: 'polopolo_eleccion', color: 0xff9f43 },
  { id: 'uribe', name: 'Uribe', texture: 'uribe_eleccion', color: 0x5aa9e6 }
];

export default class SelectScene extends Phaser.Scene {
  constructor() {
    super('SelectScene');
  }

  preload() {
    this.failedTextureKeys = new Set();
    this.load.on('loaderror', file => this.failedTextureKeys.add(file.key));

    this.loadAudioIfMissing('bgm_menu', 'assets/audio/bgm_menu.mp3');
    this.loadAudioIfMissing('sfx_enter', 'assets/audio/sfx_enter.mp3');
    this.loadAudioIfMissing('sfx_hover', 'assets/audio/sfx_hover.wav');
    this.loadAudioIfMissing('sfx_select', 'assets/audio/sfx_select.mp3');
    this.loadAudioIfMissing('sfx_fight', 'assets/audio/sfx_fight.flac');

    if (!this.textures.exists('abelardo_eleccion')) this.load.image('abelardo_eleccion', 'assets/images/abelardo_eleccion.png');
    if (!this.textures.exists('alexchar')) this.load.image('alexchar', 'assets/images/AlexChar.png');
    if (!this.textures.exists('cepeda_eleccion')) this.load.image('cepeda_eleccion', 'assets/images/cepeda_eleccion.png');
    if (!this.textures.exists('claudia_lopez')) this.load.image('claudia_lopez', 'assets/images/ClaudiaLopez.png');
    if (!this.textures.exists('duque_eleccion')) this.load.image('duque_eleccion', 'assets/images/duque_eleccion.png');
    if (!this.textures.exists('fajardo')) this.load.image('fajardo', 'assets/images/Fajardo.png');
    if (!this.textures.exists('santos')) this.load.image('santos', 'assets/images/JuanManuelSantos.png');
    if (!this.textures.exists('cabal')) this.load.image('cabal', 'assets/images/MariaFernandaCabal.png');
    if (!this.textures.exists('miguel_uribe')) this.load.image('miguel_uribe', 'assets/images/MiguelUribe.png');
    if (!this.textures.exists('petro_eleccion')) this.load.image('petro_eleccion', 'assets/images/petro_eleccion.png');
    if (!this.textures.exists('polopolo_eleccion')) this.load.image('polopolo_eleccion', 'assets/images/polopolo_eleccion.png');
    if (!this.textures.exists('uribe_eleccion')) this.load.image('uribe_eleccion', 'assets/images/uribe_eleccion.png');
  }

  create() {
    this.transitioning = false;
    this.ensureMenuMusic();
    this.player1 = null;
    this.player2 = null;
    this.cards = [];
    this.ensureFallbackTextures();
    this.drawBackground();

    this.add.text(640, 34, 'ELIGE A TUS LUCHADORES', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffd84d',
      stroke: '#090d17', strokeThickness: 6
    }).setOrigin(0.5);
    this.guide = this.add.text(640, 76, 'PRIMER CLIC: JUGADOR 1', {
      fontFamily: 'Consolas, monospace', fontSize: '14px', fontStyle: 'bold', color: '#69bfff', letterSpacing: 2
    }).setOrigin(0.5);

    this.leftPreview = this.createPreviewPanel(140, 360, 'JUGADOR 1', 0x2f80ed);
    this.rightPreview = this.createPreviewPanel(1140, 360, 'RIVAL · IA', 0xeb3b5a);

    ROSTER.forEach((fighter, index) => this.createRosterCard(fighter, index));

    this.backButton = this.createActionButton(160, 650, 190, 58, '‹ VOLVER', 0x60708c, () => this.goTo('ModeScene'));
    this.resetButton = this.createActionButton(400, 650, 190, 58, 'REINICIAR', 0xa66cff, () => this.resetSelection());
    this.fightButton = this.createActionButton(820, 650, 330, 64, '¡A COMBATIR!', 0xffd23f, () => this.startBattle());
    this.fightButton.setVisible(false);
    this.fightButton.getData('hitZone').disableInteractive();

    this.input.keyboard.once('keydown-ESC', () => this.goTo('ModeScene'));
    this.cameras.main.fadeIn(250, 4, 7, 15);
  }

  drawBackground() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerX = width / 2;
    const horizon = 420;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x170832, 0x170832, 0xf17855, 0xf17855, 1);
    sky.fillRect(0, 0, width, horizon);
    const sun = this.add.circle(centerX, 295, 100, 0xffbd51, 0.7);
    this.tweens.add({ targets: sun, alpha: 0.46, scale: 1.045, duration: 1350, yoyo: true, repeat: -1 });

    const g = this.add.graphics();
    g.fillStyle(0x100b25, 1);
    for (let x = 0; x < width; x += 42) {
      const buildingHeight = 30 + ((x * 13) % 78);
      g.fillRect(x, horizon - buildingHeight, Math.min(34, width - x), buildingHeight);
    }
    g.fillStyle(0x070817, 1);
    g.fillRect(0, horizon, width, height - horizon);
    g.lineStyle(2, 0xb84dff, 0.46);
    for (let y = horizon + 10; y <= height; y += 27) g.lineBetween(0, y, width, y);
    g.lineStyle(2, 0x3d8dff, 0.44);
    for (let x = 0; x <= width; x += 96) g.lineBetween(centerX, horizon, x, height);
    g.lineBetween(centerX, horizon, width, height);
    g.lineStyle(3, 0xff4fb8, 0.72);
    g.lineBetween(0, horizon, width, horizon);

    g.fillStyle(0x080d19, 0.82);
    g.fillRoundedRect(330, 102, 620, 498, 14);
    g.lineStyle(2, 0x65499b, 0.75);
    g.strokeRoundedRect(330, 102, 620, 498, 14);
    g.fillStyle(0x050810, 0.94);
    g.fillRect(0, 618, width, height - 618);

    const scanline = this.add.rectangle(centerX, horizon + 4, width, 3, 0xff70c5, 0.23);
    this.tweens.add({ targets: scanline, y: height - 4, alpha: 0, duration: 2350, repeat: -1 });
  }

  ensureFallbackTextures() {
    ROSTER.forEach(fighter => {
      if (this.textures.exists(fighter.texture)) return;
      const g = this.add.graphics();
      g.fillStyle(0x111827, 1);
      g.fillRect(0, 0, 300, 300);
      for (let y = 0; y < 300; y += 30) {
        g.fillStyle(y % 60 === 0 ? fighter.color : 0x243047, 0.32);
        g.fillRect(0, y, 300, 12);
      }
      g.fillStyle(fighter.color, 0.88);
      g.fillCircle(150, 105, 54);
      g.fillRoundedRect(70, 165, 160, 145, 50);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(130, 96, 7);
      g.fillCircle(170, 96, 7);
      g.lineStyle(8, 0xffffff, 0.75);
      g.lineBetween(128, 128, 172, 128);
      g.lineStyle(5, fighter.color, 1);
      g.strokeRect(5, 5, 290, 290);
      g.generateTexture(fighter.texture, 300, 300);
      g.destroy();
    });
  }

  createPreviewPanel(x, y, label, accent) {
    const bg = this.add.graphics();
    bg.fillStyle(0x10192a, 0.98);
    bg.fillRoundedRect(-110, -240, 220, 480, 14);
    bg.lineStyle(3, accent, 1);
    bg.strokeRoundedRect(-110, -240, 220, 480, 14);
    bg.fillStyle(accent, 0.85);
    bg.fillRect(-105, -235, 210, 8);

    const title = this.add.text(0, -207, label, {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const portraitFrame = this.add.rectangle(0, -37, 194, 304, 0x070b13, 1).setStrokeStyle(3, 0x3a475e, 1);
    const portrait = this.add.image(0, -37, ROSTER[0].texture).setVisible(false);
    const prompt = this.add.text(0, -37, '?', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '72px', fontStyle: 'bold', color: '#42516a'
    }).setOrigin(0.5);
    const name = this.add.text(0, 145, 'SIN ELEGIR', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '19px', fontStyle: 'bold', color: '#8492a8',
      align: 'center', wordWrap: { width: 194 }
    }).setOrigin(0.5);
    const status = this.add.text(0, 196, 'ESPERANDO...', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#65748d'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, portraitFrame, portrait, prompt, title, name, status]);
    return { container, portrait, prompt, name, status, accent };
  }

  createRosterCard(fighter, index) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 430 + column * 140;
    const y = 195 + row * 145;
    const bg = this.add.graphics();
    const portrait = this.add.image(0, -14, fighter.texture);
    this.scaleToFit(portrait, 114, 90);
    const name = this.add.text(0, 48, fighter.name.toUpperCase(), {
      fontFamily: 'Arial', fontSize: fighter.name.length > 10 ? '10px' : '11px',
      fontStyle: 'bold', color: '#ffffff', align: 'center'
    }).setOrigin(0.5);
    const badge = this.add.text(0, -65, '', {
      fontFamily: 'Consolas, monospace', fontSize: '9px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const card = this.add.container(x, y, [bg, portrait, name, badge]);
    card.setSize(126, 138);
    const hitZone = this.add.zone(0, 0, 126, 138).setOrigin(0.5).setInteractive({ useHandCursor: true });
    card.add(hitZone);
    const view = { fighter, card, bg, badge, hitZone };
    this.cards.push(view);
    this.drawRosterCard(view, false);

    hitZone.on('pointerover', () => {
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, scale: 1.055, duration: 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.drawRosterCard(view, true);
    });
    hitZone.on('pointerout', () => {
      this.tweens.killTweensOf(card);
      card.setScale(1);
      this.drawRosterCard(view, false);
    });
    hitZone.on('pointerdown', () => {
      this.unlockAudioContext();
      this.playOneShot('sfx_hover', 0.45);
    });
    hitZone.on('pointerup', () => this.selectFighter(fighter));
  }

  drawRosterCard(view, hovered) {
    const isP1 = this.player1?.id === view.fighter.id;
    const isP2 = this.player2?.id === view.fighter.id;
    const border = isP1 ? 0x45a7ff : isP2 ? 0xff526f : hovered ? view.fighter.color : 0x3f4d64;
    view.bg.clear();
    view.bg.fillStyle(isP1 ? 0x173356 : isP2 ? 0x451b28 : 0x111a2b, 1);
    view.bg.fillRoundedRect(-63, -69, 126, 138, 9);
    view.bg.lineStyle(isP1 || isP2 ? 4 : 2, border, 1);
    view.bg.strokeRoundedRect(-63, -69, 126, 138, 9);
    view.badge.setText(isP1 ? 'P1' : isP2 ? 'IA' : '');
    view.badge.setColor(isP1 ? '#69bfff' : '#ff8294');
  }

  selectFighter(fighter) {
    if (!this.player1) {
      this.player1 = fighter;
      this.playOneShot('sfx_select', 0.9);
      this.updatePreview(this.leftPreview, fighter);
      this.guide.setText('SEGUNDO CLIC: ELIGE AL RIVAL').setColor('#ff8294');
    } else if (fighter.id === this.player1.id) {
      this.guide.setText('EL RIVAL DEBE SER OTRO PERSONAJE').setColor('#ffd84d');
    } else {
      this.player2 = fighter;
      this.playOneShot('sfx_select', 0.9);
      this.updatePreview(this.rightPreview, fighter);
      this.guide.setText('DUELO LISTO · ¡A COMBATIR!').setColor('#5ee69a');
      this.fightButton.setVisible(true);
      this.fightButton.getData('hitZone').setInteractive({ useHandCursor: true });
    }
    this.cards.forEach(view => this.drawRosterCard(view, false));
  }

  updatePreview(panel, fighter) {
    panel.portrait.setTexture(fighter.texture).setVisible(true);
    this.scaleToFit(panel.portrait, 188, 298);
    panel.prompt.setVisible(false);
    panel.name.setText(fighter.name.toUpperCase()).setColor('#ffffff');
    panel.status.setText('LISTO').setColor('#5ee69a');
  }

  scaleToFit(sprite, maxAncho, maxAlto) {
    sprite.setCrop();
    sprite.setScale(1);
    const scale = Math.min(maxAncho / sprite.width, maxAlto / sprite.height);
    sprite.setScale(scale);
    sprite.setOrigin(0.5);
  }

  createActionButton(x, y, width, height, label, accent, onClick) {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: height > 45 ? '18px' : '13px',
      fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, text]);
    button.setSize(width, height);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.add(hitZone);
    button.setData('hitZone', hitZone);
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(hovered ? 0x263b5b : 0x131e31, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      bg.lineStyle(hovered ? 4 : 2, accent, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
      text.setColor(hovered ? '#ffd84d' : '#ffffff');
    };
    draw(false);
    hitZone.on('pointerover', () => {
      draw(true);
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, scale: 1.045, duration: 240, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hitZone.on('pointerout', () => {
      this.tweens.killTweensOf(button);
      button.setScale(1);
      draw(false);
    });
    hitZone.on('pointerdown', () => button.setScale(0.98));
    hitZone.on('pointerup', onClick);
    return button;
  }

  resetSelection() {
    this.scene.restart();
  }

  startBattle() {
    if (!this.player1 || !this.player2 || this.transitioning) return;
    this.unlockAudioContext();
    this.transitioning = true;
    this.stopMenuMusic();
    this.playOneShot('sfx_fight', 1);
    this.cameras.main.fadeOut(250, 3, 6, 13);
    this.time.delayedCall(260, () => {
      this.scene.start('BattleScene', {
        player1: { ...this.player1 },
        player2: { ...this.player2 }
      });
    });
  }

  goTo(sceneKey) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(210, 3, 6, 13);
    this.time.delayedCall(220, () => this.scene.start(sceneKey));
  }

  loadAudioIfMissing(key, path) {
    if (!this.cache.audio.exists(key)) this.load.audio(key, path);
  }

  unlockAudioContext() {
    if (this.sound.locked && typeof this.sound.unlock === 'function') this.sound.unlock();
    const context = this.sound.context;
    if (context?.state === 'suspended') {
      context.resume().catch(error => console.warn('No se pudo reanudar el AudioContext.', error));
    }
  }

  ensureMenuMusic() {
    if (!this.cache.audio.exists('bgm_menu')) return null;
    let music = this.registry.get('bgmMenuInstance');
    if (!music || !music.manager) {
      music = this.sound.add('bgm_menu', { loop: true, volume: 0.5 });
      this.registry.set('bgmMenuInstance', music);
    }
    if (!music.isPlaying) music.play({ loop: true, volume: 0.5 });
    return music;
  }

  stopMenuMusic() {
    const music = this.registry.get('bgmMenuInstance');
    if (music) {
      if (music.isPlaying || music.isPaused) music.stop();
      if (music.manager) music.destroy();
      this.registry.remove('bgmMenuInstance');
    }
  }

  playOneShot(key, volume = 1) {
    if (!this.cache.audio.exists(key)) return null;
    const sound = this.sound.add(key, { volume });
    sound.once('complete', () => sound.destroy());
    if (!sound.play()) sound.destroy();
    return sound;
  }
}
