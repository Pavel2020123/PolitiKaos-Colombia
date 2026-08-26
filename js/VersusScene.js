import { ACTIVE_CHARACTERS, CHARACTER_BY_ID } from './data/characters.js';

export default class VersusScene extends Phaser.Scene {
  constructor() {
    super('VersusScene');
  }

  init(data) {
    const player1Key = data?.player1Key || this.registry.get('selectedP1Key');
    const player2Key = data?.player2Key || this.registry.get('selectedP2Key');
    this.player1 = data?.player1 || CHARACTER_BY_ID[player1Key] || ACTIVE_CHARACTERS[0];
    this.player2 = data?.player2 || CHARACTER_BY_ID[player2Key] || ACTIVE_CHARACTERS[1];
    this.stageId = data?.stageId || this.registry.get('selectedStageId');
  }

  preload() {
    [this.player1, this.player2].forEach(character => {
      if (character.selectionAsset && !this.textures.exists(character.texture)) {
        this.load.image(character.texture, character.selectionAsset);
      }
      if (character.headAsset && !this.textures.exists(character.headTexture)) {
        this.load.image(character.headTexture, character.headAsset);
      }
    });
  }

  create() {
    this.transitioning = false;
    this.ensureFallbackTexture(this.player1);
    this.ensureFallbackTexture(this.player2);
    this.drawBackground();

    const leftPanel = this.add.rectangle(-240, 360, 490, 520, 0x10294b, 0.96)
      .setStrokeStyle(5, this.player1.color || 0x69bfff, 1);
    const rightPanel = this.add.rectangle(1520, 360, 490, 520, 0x421527, 0.96)
      .setStrokeStyle(5, this.player2.color || 0xff526f, 1);
    const leftPortrait = this.add.image(-240, 305, this.player1.texture);
    const rightPortrait = this.add.image(1520, 305, this.player2.texture).setFlipX(true);
    this.scaleToFit(leftPortrait, 410, 320);
    this.scaleToFit(rightPortrait, 410, 320);

    const leftQuote = this.add.text(-240, 500, `“${this.getChallengeQuote(this.player1)}”`, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '17px', fontStyle: 'italic', color: '#bfe2ff',
      align: 'center', wordWrap: { width: 400, useAdvancedWrap: true },
      stroke: '#05070d', strokeThickness: 4
    }).setOrigin(0.5);
    const rightQuote = this.add.text(1520, 500, `“${this.getChallengeQuote(this.player2)}”`, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '17px', fontStyle: 'italic', color: '#ffc2ce',
      align: 'center', wordWrap: { width: 400, useAdvancedWrap: true },
      stroke: '#05070d', strokeThickness: 4
    }).setOrigin(0.5);

    const leftName = this.add.text(-240, 575, this.player1.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '29px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#05070d', strokeThickness: 6
    }).setOrigin(0.5);
    const rightName = this.add.text(1520, 575, this.player2.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '29px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#05070d', strokeThickness: 6
    }).setOrigin(0.5);

    const vs = this.add.text(640, 340, 'VS', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '112px', fontStyle: 'bold italic',
      color: '#ffd23f', stroke: '#eb315b', strokeThickness: 13,
      shadow: { color: '#ff315f', blur: 26, fill: true }
    }).setOrigin(0.5).setScale(0.15).setAlpha(0).setDepth(20);
    this.add.text(640, 75, this.getRoundLabel(), {
      fontFamily: 'Consolas, monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#070b16', strokeThickness: 6, letterSpacing: 2
    }).setOrigin(0.5).setDepth(20);
    this.add.text(640, 675, 'PRESIONA CUALQUIER TECLA PARA CONTINUAR', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#92a3ba', letterSpacing: 2
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({ targets: [leftPanel, leftPortrait, leftName, leftQuote], x: 330, duration: 620, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [rightPanel, rightPortrait, rightName, rightQuote], x: 950, duration: 620, ease: 'Back.easeOut' });
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 560, delay: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: vs, scale: 1.08, duration: 460, delay: 980, yoyo: true, repeat: -1 });

    this.autoStartEvent = this.time.delayedCall(2500, () => this.startBattle());
    this.keyboardHandler = () => this.startBattle();
    this.gamepadHandler = () => this.startBattle();
    this.input.keyboard.once('keydown', this.keyboardHandler);
    this.input.gamepad?.once('down', this.gamepadHandler);
    this.input.once('pointerdown', this.keyboardHandler);
    this.cameras.main.fadeIn(180, 4, 7, 15);
  }

  getRoundLabel() {
    if (this.registry.get('gameMode') !== 'ARCADE') {
      return `${this.player1.name.toUpperCase()}  VS  ${this.player2.name.toUpperCase()}`;
    }
    const queue = this.registry.get('arcadeQueue') || [];
    const index = this.registry.get('arcadeFightIndex') || 0;
    const finalRound = this.player2.isBoss || index === queue.length - 1;
    return finalRound
      ? `FINAL ROUND: VS ${this.player2.name.toUpperCase()}`
      : `ROUND ${index + 1}: VS ${this.player2.name.toUpperCase()}`;
  }

  getChallengeQuote(character) {
    const quotes = character.challengeQuotes?.length ? character.challengeQuotes : character.victoryQuotes;
    if (!quotes?.length) return 'Que empiece el caos.';
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  startBattle() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.autoStartEvent?.remove(false);
    this.registry.set('selectedP1Key', this.player1.id);
    this.registry.set('selectedP2Key', this.player2.id);
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => {
      this.scene.start('BattleScene', {
        player1Key: this.player1.id,
        player2Key: this.player2.id,
        stageId: this.stageId,
        player1: { ...this.player1 },
        player2: { ...this.player2 }
      });
    });
  }

  ensureFallbackTexture(character) {
    [character.texture, character.headTexture].forEach(textureKey => {
      if (this.textures.exists(textureKey)) return;
      const g = this.add.graphics();
      g.fillStyle(0x101827, 1);
      g.fillRect(0, 0, 420, 420);
      g.fillStyle(character.color || 0x8a6cff, 0.9);
      g.fillCircle(210, 145, 96);
      g.fillRoundedRect(92, 245, 236, 190, 62);
      g.fillStyle(0xffffff, 0.86);
      g.fillCircle(174, 132, 12);
      g.fillCircle(246, 132, 12);
      g.lineStyle(11, 0xffffff, 0.8);
      g.lineBetween(160, 194, 260, 194);
      g.lineStyle(6, character.color || 0x8a6cff, 1);
      g.strokeRect(6, 6, 408, 408);
      g.generateTexture(textureKey, 420, 420);
      g.destroy();
    });
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x07152b, 0x3c1025, 0x111827, 0x111827, 1);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0xffffff, 0.035);
    for (let x = -720; x < 1280; x += 70) {
      g.fillTriangle(x, 0, x + 34, 0, x + 120, 720);
      g.fillTriangle(x, 0, x + 120, 720, x + 86, 720);
    }
    g.lineStyle(5, 0xffd23f, 0.28);
    g.lineBetween(640, 0, 640, 720);
  }

  scaleToFit(sprite, maxWidth, maxHeight) {
    sprite.setScale(1);
    sprite.setScale(Math.min(maxWidth / sprite.width, maxHeight / sprite.height));
  }
}
