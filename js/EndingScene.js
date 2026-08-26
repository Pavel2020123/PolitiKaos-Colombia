import { ACTIVE_CHARACTERS, CHARACTER_BY_ID } from './data/characters.js';

export default class EndingScene extends Phaser.Scene {
  constructor() {
    super('EndingScene');
  }

  init(data) {
    const playerKey = data?.playerKey || this.registry.get('arcadeWinnerKey')
      || this.registry.get('selectedP1Key');
    this.champion = CHARACTER_BY_ID[playerKey] || ACTIVE_CHARACTERS[0];
  }

  preload() {
    if (this.champion.selectionAsset && !this.textures.exists(this.champion.texture)) {
      this.load.image(this.champion.texture, this.champion.selectionAsset);
    }
    if (this.champion.headAsset && !this.textures.exists(this.champion.headTexture)) {
      this.load.image(this.champion.headTexture, this.champion.headAsset);
    }
  }

  create() {
    this.returning = false;
    this.canSkipAt = this.time.now + 550;
    this.ensureFallbackTexture();
    this.drawBackground();

    this.add.text(640, 52, '¡ARCADE COMPLETADO!', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '48px', fontStyle: 'bold italic',
      color: '#ffd23f', stroke: '#e72f60', strokeThickness: 9,
      shadow: { color: '#e72f60', blur: 22, fill: true }
    }).setOrigin(0.5).setDepth(10);

    const portraitPanel = this.add.rectangle(285, 357, 430, 510, 0x0b1426, 0.94)
      .setStrokeStyle(5, this.champion.color || 0xffd23f, 1)
      .setDepth(5);
    const portraitTexture = this.textures.exists(this.champion.texture)
      ? this.champion.texture
      : this.champion.headTexture;
    const portrait = this.add.image(285, 330, portraitTexture).setDepth(6);
    this.scaleToFit(portrait, 370, 390);
    this.add.text(285, 565, this.champion.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#05070d', strokeThickness: 6
    }).setOrigin(0.5).setDepth(7);

    this.add.text(795, 180, 'EL NUEVO DESTINO DE COLOMBIA', {
      fontFamily: 'Consolas, monospace', fontSize: '19px', fontStyle: 'bold',
      color: '#79c6ff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(7);
    this.add.text(795, 345, this.champion.arcadeEnding || 'El país sobrevivió al caos y ganó una nueva leyenda.', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '27px', color: '#ffffff', align: 'center',
      lineSpacing: 10, wordWrap: { width: 560, useAdvancedWrap: true },
      stroke: '#05070d', strokeThickness: 4
    }).setOrigin(0.5).setDepth(7);
    this.add.text(795, 520, 'AMPARO HA SIDO DERROTADA', {
      fontFamily: 'Consolas, monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#ff8cab', letterSpacing: 3
    }).setOrigin(0.5).setDepth(7);

    this.createScrollingCredits();
    this.skipHint = this.add.text(640, 692, 'PRESIONA CUALQUIER TECLA, BOTÓN O CLIC PARA VOLVER AL MENÚ', {
      fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#aebdd2', letterSpacing: 2,
      backgroundColor: '#050914dd', padding: { x: 12, y: 7 }
    }).setOrigin(0.5, 1).setDepth(50);
    this.tweens.add({ targets: this.skipHint, alpha: 0.42, duration: 650, yoyo: true, repeat: -1 });

    this.keyboardHandler = () => this.tryReturnToMenu();
    this.gamepadHandler = () => this.tryReturnToMenu();
    this.pointerHandler = () => this.tryReturnToMenu();
    this.input.keyboard.on('keydown', this.keyboardHandler);
    this.input.gamepad?.on('down', this.gamepadHandler);
    this.input.on('pointerdown', this.pointerHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyboardHandler);
      this.input.gamepad?.off('down', this.gamepadHandler);
      this.input.off('pointerdown', this.pointerHandler);
    });
    this.cameras.main.fadeIn(350, 4, 7, 15);
  }

  createScrollingCredits() {
    const rosterNames = ACTIVE_CHARACTERS.map(character => character.name.toUpperCase()).join('  ·  ');
    const credits = [
      'GUACHAFITA STRIKE',
      '',
      'UNA PARODIA ARCADE COLOMBIANA',
      '',
      'CAMPEÓN DEL MODO ARCADE',
      this.champion.name.toUpperCase(),
      '',
      'BOSS FINAL',
      'AMPARO GRISALES',
      '',
      'ELENCO',
      rosterNames,
      '',
      'DISEÑO Y PROGRAMACIÓN',
      'EQUIPO GUACHAFITA STRIKE',
      '',
      'VOCES, GOLPES Y CAOS',
      'LA REPÚBLICA DEL PIXEL',
      '',
      'ESTA OBRA ES UNA PARODIA FICTICIA.',
      'NINGÚN EGO REAL RESULTÓ HERIDO.',
      '',
      'GRACIAS POR JUGAR',
      '',
      'FIN'
    ].join('\n');

    this.creditsShade = this.add.rectangle(640, 360, 1280, 720, 0x030711, 0)
      .setDepth(20);
    this.creditsText = this.add.text(640, 760, credits, {
      fontFamily: 'Consolas, monospace', fontSize: '22px', fontStyle: 'bold',
      color: '#ffffff', align: 'center', lineSpacing: 14,
      wordWrap: { width: 1020, useAdvancedWrap: true },
      stroke: '#05070d', strokeThickness: 4
    }).setOrigin(0.5, 0).setDepth(22);

    this.tweens.add({ targets: this.creditsShade, alpha: 0.91, delay: 3000, duration: 850 });
    this.tweens.add({
      targets: this.creditsText,
      y: -this.creditsText.height - 80,
      delay: 3000,
      duration: 19000,
      ease: 'Linear',
      onComplete: () => this.time.delayedCall(1800, () => this.goToMenu())
    });
  }

  tryReturnToMenu() {
    if (this.time.now < this.canSkipAt) return;
    this.goToMenu();
  }

  goToMenu() {
    if (this.returning) return;
    this.returning = true;
    this.cameras.main.fadeOut(260, 3, 6, 13);
    this.time.delayedCall(270, () => this.scene.start('MenuScene'));
  }

  ensureFallbackTexture() {
    [this.champion.texture, this.champion.headTexture].forEach(textureKey => {
      if (this.textures.exists(textureKey)) return;
      const g = this.add.graphics();
      g.fillStyle(0x101827, 1);
      g.fillRect(0, 0, 420, 420);
      g.fillStyle(this.champion.color || 0x8a6cff, 0.92);
      g.fillCircle(210, 145, 96);
      g.fillRoundedRect(92, 245, 236, 190, 62);
      g.fillStyle(0xffffff, 0.86);
      g.fillCircle(174, 132, 12);
      g.fillCircle(246, 132, 12);
      g.lineStyle(11, 0xffffff, 0.8);
      g.lineBetween(160, 194, 260, 194);
      g.generateTexture(textureKey, 420, 420);
      g.destroy();
    });
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x050914, 0x26123d, 0x112a42, 0x090d18, 1);
    g.fillRect(0, 0, 1280, 720);
    g.lineStyle(2, 0xffd23f, 0.15);
    for (let y = 0; y <= 720; y += 40) g.lineBetween(0, y, 1280, y);
    for (let x = 0; x <= 1280; x += 64) g.lineBetween(x, 0, x, 720);
    for (let index = 0; index < 42; index += 1) {
      const x = (index * 173) % 1280;
      const y = 90 + ((index * 97) % 540);
      this.add.rectangle(x, y, 4, 4, index % 3 === 0 ? 0xffd23f : 0x69bfff, 0.72)
        .setAngle(45);
    }
  }

  scaleToFit(sprite, maxWidth, maxHeight) {
    sprite.setScale(1);
    sprite.setScale(Math.min(maxWidth / sprite.width, maxHeight / sprite.height));
  }
}
