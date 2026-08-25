export default class ModeScene extends Phaser.Scene {
  constructor() {
    super('ModeScene');
  }

  preload() {
    this.loadAudioIfMissing('bgm_menu', 'assets/audio/bgm_menu.mp3');
    this.loadAudioIfMissing('sfx_enter', 'assets/audio/sfx_enter.mp3');
    this.loadAudioIfMissing('sfx_hover', 'assets/audio/sfx_hover.wav');
    this.loadAudioIfMissing('sfx_select', 'assets/audio/sfx_select.mp3');
    this.loadAudioIfMissing('sfx_fight', 'assets/audio/sfx_fight.flac');
  }

  create() {
    this.transitioning = false;
    this.ensureMenuMusic();
    this.drawBackground();
    this.add.text(640, 86, 'SELECCIONA EL MODO', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffd84d',
      stroke: '#0a0e19', strokeThickness: 7
    }).setOrigin(0.5);
    this.add.text(640, 128, '¿COMO QUIERES ARMAR EL KAOS?', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#9badc8', letterSpacing: 3
    }).setOrigin(0.5);

    this.createModeCard(445, 350, {
      title: 'MODO HISTORIA', description: 'Campaña, decisiones y escándalos por capítulos.',
      icon: 'H', enabled: false, accent: 0xa66cff
    });
    this.createModeCard(835, 350, {
      title: 'MODO COMBATE 1v1', description: 'Elige dos luchadores y resuelve el debate en el ring.',
      icon: 'VS', enabled: true, accent: 0xffd23f, onClick: () => this.transitionTo('SelectScene')
    });

    this.createBackButton();
    this.input.keyboard.once('keydown-ESC', () => this.transitionTo('TitleScene'));
    this.cameras.main.fadeIn(280, 5, 8, 16);
  }

  drawBackground() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerX = width / 2;
    const horizon = 430;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x14072d, 0x14072d, 0xe65d59, 0xe65d59, 1);
    sky.fillRect(0, 0, width, horizon);
    const sun = this.add.circle(centerX, 322, 92, 0xffb94a, 0.75);
    this.tweens.add({ targets: sun, alpha: 0.5, scale: 1.04, duration: 1400, yoyo: true, repeat: -1 });

    const g = this.add.graphics();
    g.fillStyle(0x100b24, 1);
    for (let x = 0; x < width; x += 38) {
      const buildingHeight = 35 + ((x * 11) % 92);
      g.fillRect(x, horizon - buildingHeight, Math.min(32, width - x), buildingHeight);
    }
    g.fillStyle(0x070817, 1);
    g.fillRect(0, horizon, width, height - horizon);
    g.lineStyle(2, 0xb84dff, 0.5);
    for (let y = horizon + 10; y <= height; y += 25) g.lineBetween(0, y, width, y);
    g.lineStyle(2, 0x3d8dff, 0.48);
    for (let x = 0; x <= width; x += 80) g.lineBetween(centerX, horizon, x, height);
    g.lineBetween(centerX, horizon, width, height);
    g.lineStyle(3, 0xff4fb8, 0.78);
    g.lineBetween(0, horizon, width, horizon);

    const scanline = this.add.rectangle(centerX, horizon + 5, width, 3, 0x9f73ff, 0.25);
    this.tweens.add({ targets: scanline, y: height - 4, alpha: 0, duration: 2500, repeat: -1 });
  }

  createModeCard(x, y, options) {
    const width = 260;
    const height = 275;
    const bg = this.add.graphics();
    const iconBg = this.add.circle(0, -68, 49, options.enabled ? 0x1b2e4e : 0x161b28, 1);
    const icon = this.add.text(0, -68, options.icon, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: options.icon === 'VS' ? '31px' : '39px',
      fontStyle: 'bold', color: options.enabled ? '#ffd84d' : '#657086'
    }).setOrigin(0.5);
    const title = this.add.text(0, 6, options.title, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '20px', fontStyle: 'bold',
      color: options.enabled ? '#ffffff' : '#7d879a', align: 'center'
    }).setOrigin(0.5);
    const description = this.add.text(0, 52, options.description, {
      fontFamily: 'Arial', fontSize: '13px', color: options.enabled ? '#b9c7dc' : '#616b7e',
      align: 'center', lineSpacing: 5, wordWrap: { width: 210 }
    }).setOrigin(0.5);
    const status = this.add.text(0, 108, options.enabled ? 'DISPONIBLE' : 'PROXIMAMENTE', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', fontStyle: 'bold',
      color: options.enabled ? '#5ee69a' : '#a66cff'
    }).setOrigin(0.5);
    const card = this.add.container(x, y, [bg, iconBg, icon, title, description, status]);
    card.setSize(width, height);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5);
    card.add(hitZone);
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(options.enabled ? (hovered ? 0x1c3152 : 0x111b2e) : 0x0d121e, 0.98);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
      bg.lineStyle(hovered && options.enabled ? 4 : 2, options.enabled ? options.accent : 0x343c4d, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);
    };
    draw(false);
    if (options.enabled) {
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => {
        draw(true);
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1.035, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: card, y: y - 7, duration: 130 });
      });
      hitZone.on('pointerout', () => {
        this.tweens.killTweensOf(card);
        card.setScale(1).setY(y);
        draw(false);
      });
      hitZone.on('pointerup', () => {
        this.unlockAudioContext();
        this.playOneShot('sfx_enter', 0.85);
        options.onClick();
      });
    }
  }

  createBackButton() {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, '‹  VOLVER', {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#c4d0e3'
    }).setOrigin(0.5);
    const button = this.add.container(100, 660, [bg, text]);
    button.setSize(130, 42);
    const hitZone = this.add.zone(0, 0, 130, 42).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.add(hitZone);
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(hovered ? 0x233653 : 0x121b2c, 1);
      bg.fillRoundedRect(-65, -21, 130, 42, 8);
      bg.lineStyle(2, hovered ? 0x6dbef2 : 0x40516c, 1);
      bg.strokeRoundedRect(-65, -21, 130, 42, 8);
    };
    draw(false);
    hitZone.on('pointerover', () => {
      draw(true);
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, scale: 1.04, duration: 240, yoyo: true, repeat: -1 });
    });
    hitZone.on('pointerout', () => {
      this.tweens.killTweensOf(button);
      button.setScale(1);
      draw(false);
    });
    hitZone.on('pointerup', () => {
      this.unlockAudioContext();
      this.playOneShot('sfx_enter', 0.75);
      this.transitionTo('TitleScene');
    });
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

  playOneShot(key, volume = 1) {
    if (!this.cache.audio.exists(key)) return null;
    const sound = this.sound.add(key, { volume });
    sound.once('complete', () => sound.destroy());
    if (!sound.play()) sound.destroy();
    return sound;
  }

  transitionTo(sceneKey) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(230, 4, 7, 15);
    this.time.delayedCall(240, () => this.scene.start(sceneKey));
  }
}
