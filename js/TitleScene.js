export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
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
    this.drawBackground();

    const glow = this.add.text(640, 230, 'POLITIKAOS', {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '68px',
      fontStyle: 'bold italic',
      color: '#ffe357',
      stroke: '#ff315f',
      strokeThickness: 10,
      shadow: { color: '#ff315f', blur: 22, fill: true }
    }).setOrigin(0.5).setAngle(-2);

    this.add.text(640, 300, 'COLOMBIA', {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '31px',
      fontStyle: 'bold',
      color: '#4bc6ff',
      stroke: '#07101e',
      strokeThickness: 6,
      letterSpacing: 12
    }).setOrigin(0.5);

    this.add.text(640, 350, 'EL DEBATE SE CONVIERTE EN COMBATE', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#b8c7df', letterSpacing: 3
    }).setOrigin(0.5);

    this.enterButton = this.createNeonButton(640, 470, 230, 66, 'ENTRAR', () => this.handleEnter());
    this.add.text(640, 530, 'ENTER · CLIC PARA CONTINUAR', {
      fontFamily: 'Consolas, monospace', fontSize: '10px', color: '#64748b'
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => this.handleEnter());
    this.cameras.main.fadeIn(350, 4, 7, 15);
    this.tweens.add({ targets: glow, scale: 1.025, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  loadAudioIfMissing(key, path) {
    if (!this.cache.audio.exists(key)) this.load.audio(key, path);
  }

  handleEnter() {
    if (this.transitioning) return;

    // La llamada ocurre dentro del gesto del usuario para respetar autoplay.
    this.unlockAudioContext();
    this.playOneShot('sfx_enter', 0.9);
    this.ensureMenuMusic();
    this.transitionTo('ModeScene');
  }

  unlockAudioContext() {
    if (this.sound.locked && typeof this.sound.unlock === 'function') {
      this.sound.unlock();
    }
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

  drawBackground() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const centerX = width / 2;
    const horizon = 450;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x16092f, 0x16092f, 0xf06b4e, 0xf06b4e, 1);
    sky.fillRect(0, 0, width, horizon);

    for (let i = 0; i < 38; i++) {
      const x = (i * 107) % width;
      const y = 24 + ((i * 59) % 310);
      sky.fillStyle(i % 3 === 0 ? 0xffd86b : 0x64c9ff, 0.62);
      sky.fillRect(x, y, i % 5 === 0 ? 3 : 2, 2);
    }

    const sun = this.add.circle(centerX, 337, 106, 0xffb347, 0.88);
    this.tweens.add({ targets: sun, alpha: 0.62, scale: 1.045, duration: 1250, yoyo: true, repeat: -1 });

    const city = this.add.graphics();
    city.fillStyle(0x100b25, 1);
    for (let x = 0; x < width; x += 32) {
      const buildingHeight = 45 + ((x * 7) % 105);
      const buildingWidth = Math.min(27, width - x);
      city.fillRect(x, horizon - buildingHeight, buildingWidth, buildingHeight);
      city.fillStyle(0xffcf58, 0.46);
      if (x + 11 <= width) city.fillRect(x + 7, horizon + 12 - buildingHeight, 4, 7);
      if (x + 21 <= width) city.fillRect(x + 17, horizon + 26 - buildingHeight, 4, 7);
      city.fillStyle(0x100b25, 1);
    }

    city.fillStyle(0x070817, 1);
    city.fillRect(0, horizon, width, height - horizon);
    city.lineStyle(2, 0xb84dff, 0.55);
    for (let y = horizon + 10; y <= height; y += 24) city.lineBetween(0, y, width, y);
    city.lineStyle(2, 0x3d8dff, 0.5);
    for (let x = 0; x <= width; x += 80) city.lineBetween(centerX, horizon, x, height);
    city.lineBetween(centerX, horizon, width, height);
    city.lineStyle(3, 0xff4fb8, 0.8);
    city.lineBetween(0, horizon, width, horizon);

    const scanline = this.add.rectangle(centerX, horizon + 5, width, 3, 0xff77c8, 0.28);
    this.tweens.add({ targets: scanline, y: height - 4, alpha: 0, duration: 2300, repeat: -1 });
  }

  createNeonButton(x, y, width, height, label, onClick) {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '25px', fontStyle: 'bold', color: '#ffffff', letterSpacing: 4
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [bg, text, hitZone]);
    button.setSize(width, height);
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(hovered ? 0x264b70 : 0x14253f, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 11);
      bg.lineStyle(hovered ? 4 : 2, hovered ? 0xffdf4d : 0x4bc6ff, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 11);
      text.setColor(hovered ? '#ffe357' : '#ffffff');
    };
    draw(false);
    hitZone.on('pointerover', () => {
      draw(true);
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, scale: 1.055, duration: 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hitZone.on('pointerout', () => {
      this.tweens.killTweensOf(button);
      button.setScale(1);
      draw(false);
    });
    hitZone.on('pointerdown', () => {
      this.tweens.killTweensOf(button);
      button.setScale(0.98);
    });
    hitZone.on('pointerup', () => { button.setScale(1.04); onClick(); });
    return button;
  }

  transitionTo(sceneKey) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(260, 4, 7, 15);
    this.time.delayedCall(270, () => this.scene.start(sceneKey));
  }
}
