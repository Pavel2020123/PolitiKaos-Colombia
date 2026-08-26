import { ACTIVE_CHARACTERS, ARCADE_BOSS, CHARACTER_BY_ID } from './data/characters.js';
import NetworkManager from './network/NetworkManager.js';

const ROSTER = ACTIVE_CHARACTERS;
const GRID_COLUMNS = 4;

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

    ROSTER.forEach(({ texture, selectionAsset, headTexture, headAsset }) => {
      if (!this.textures.exists(texture)) this.load.image(texture, selectionAsset);
      if (!this.textures.exists(headTexture)) this.load.image(headTexture, headAsset);
    });
  }

  create() {
    this.transitioning = false;
    this.gameMode = this.registry.get('gameMode') || 'VS_CPU';
    this.isOnline = this.gameMode === 'ONLINE' || this.registry.get('isOnline') === true;
    this.onlinePlayerNumber = NetworkManager.playerNumber || this.registry.get('onlinePlayerNumber');
    this.onlineSelectionComplete = false;
    this.ensureMenuMusic();
    this.player1 = null;
    this.player2 = null;
    this.cards = [];
    this.focusedIndex = 0;
    this.ensureFallbackTextures();
    this.drawBackground();

    const title = this.gameMode === 'ARCADE'
      ? 'ELIGE TU LUCHADOR · MODO ARCADE'
      : this.isOnline ? `SELECCIÓN ONLINE · SALA ${NetworkManager.roomCode || '----'}` : 'ELIGE A TUS LUCHADORES';
    this.add.text(640, 34, title, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffd84d',
      stroke: '#090d17', strokeThickness: 6
    }).setOrigin(0.5);
    const initialGuide = this.gameMode === 'ARCADE'
      ? 'ELIGE P1 · LOS RIVALES SERÁN ASIGNADOS POR LA CPU'
      : this.isOnline
        ? `ERES P${this.onlinePlayerNumber || '?'} · ELIGE TU LUCHADOR Y ESPERA AL RIVAL`
        : 'FLECHAS / STICK · ENTER / A: JUGADOR 1';
    this.guide = this.add.text(640, 76, initialGuide, {
      fontFamily: 'Consolas, monospace', fontSize: '14px', fontStyle: 'bold', color: '#69bfff', letterSpacing: 2
    }).setOrigin(0.5);

    this.leftPreview = this.createPreviewPanel(140, 360, 'JUGADOR 1', 0x2f80ed);
    const rivalLabel = this.gameMode === 'VERSUS_2P' || this.isOnline ? 'JUGADOR 2' : 'RIVAL · CPU';
    this.rightPreview = this.createPreviewPanel(1140, 360, rivalLabel, 0xeb3b5a);

    this.focusCursor = this.add.rectangle(0, 0, 136, 148, 0x000000, 0)
      .setStrokeStyle(4, 0xffdf58, 1)
      .setVisible(false);
    this.tweens.add({
      targets: this.focusCursor,
      alpha: 0.45,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    ROSTER.forEach((fighter, index) => this.createRosterCard(fighter, index));

    this.backButton = this.createActionButton(160, 650, 190, 58, '‹ MENÚ', 0x60708c, () => this.goTo('MenuScene'));
    this.resetButton = this.createActionButton(400, 650, 190, 58, 'REINICIAR', 0xa66cff, () => this.resetSelection());
    this.fightButton = this.createActionButton(820, 650, 330, 64, '¡A COMBATIR!', 0xffd23f, () => this.startBattle());
    this.fightButton.setVisible(false);
    this.fightButton.getData('hitZone').disableInteractive();
    if (this.isOnline) {
      this.resetButton.setVisible(false);
      this.resetButton.getData('hitZone').disableInteractive();
      this.setupOnlineSelection();
    }

    this.setupNavigation();
    this.focusCharacter(0, false);
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
      this.ensureFallbackTexture(fighter.texture, fighter.color);
      this.ensureFallbackTexture(fighter.headTexture, fighter.color);
    });
  }

  ensureFallbackTexture(textureKey, color) {
    if (this.textures.exists(textureKey)) return;
    const g = this.add.graphics();
    g.fillStyle(0x111827, 1);
    g.fillRect(0, 0, 300, 300);
    for (let y = 0; y < 300; y += 30) {
      g.fillStyle(y % 60 === 0 ? color : 0x243047, 0.32);
      g.fillRect(0, y, 300, 12);
    }
    g.fillStyle(color, 0.88);
    g.fillCircle(150, 105, 54);
    g.fillRoundedRect(70, 165, 160, 145, 50);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(130, 96, 7);
    g.fillCircle(170, 96, 7);
    g.lineStyle(8, 0xffffff, 0.75);
    g.lineBetween(128, 128, 172, 128);
    g.lineStyle(5, color, 1);
    g.strokeRect(5, 5, 290, 290);
    g.generateTexture(textureKey, 300, 300);
    g.destroy();
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
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const charactersInRow = Math.min(GRID_COLUMNS, ROSTER.length - row * GRID_COLUMNS);
    const x = 640 + (column - (charactersInRow - 1) / 2) * 140;
    const y = 195 + row * 145;
    const bg = this.add.graphics();
    const portrait = this.add.image(0, -14, fighter.headTexture);
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
    const view = { fighter, index, card, bg, badge, hitZone };
    this.cards.push(view);
    this.drawRosterCard(view, false);

    hitZone.on('pointerover', () => {
      this.focusCharacter(index, false);
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
      this.focusCharacter(index, false);
      this.unlockAudioContext();
      this.playOneShot('sfx_hover', 0.45);
    });
    hitZone.on('pointerup', () => this.selectFighter(fighter));
  }

  drawRosterCard(view, hovered) {
    const isP1 = this.player1?.id === view.fighter.id;
    const isP2 = this.player2?.id === view.fighter.id;
    const focused = this.focusedIndex === view.index;
    const border = isP1 ? 0x45a7ff : isP2 ? 0xff526f : hovered || focused ? view.fighter.color : 0x3f4d64;
    view.bg.clear();
    view.bg.fillStyle(isP1 ? 0x173356 : isP2 ? 0x451b28 : 0x111a2b, 1);
    view.bg.fillRoundedRect(-63, -69, 126, 138, 9);
    view.bg.lineStyle(isP1 || isP2 || focused ? 4 : 2, border, 1);
    view.bg.strokeRoundedRect(-63, -69, 126, 138, 9);
    view.badge.setText(isP1 && isP2 ? 'P1 · P2' : isP1 ? 'P1' : isP2 ? (this.isOnline || this.gameMode === 'VERSUS_2P' ? 'P2' : 'IA') : '');
    view.badge.setColor(isP1 ? '#69bfff' : '#ff8294');
  }

  setupNavigation() {
    this.keyboardNavigationHandler = event => this.handleKeyboardNavigation(event);
    this.gamepadNavigationHandler = (pad, button) => this.handleGamepadNavigation(button);
    this.input.keyboard.on('keydown', this.keyboardNavigationHandler);
    this.input.gamepad?.on('down', this.gamepadNavigationHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyboardNavigationHandler);
      this.input.gamepad?.off('down', this.gamepadNavigationHandler);
    });
  }

  handleKeyboardNavigation(event) {
    if (event.repeat || this.transitioning) return;
    const actions = {
      ArrowLeft: () => this.moveFocus(-1, 0),
      KeyA: () => this.moveFocus(-1, 0),
      ArrowRight: () => this.moveFocus(1, 0),
      KeyD: () => this.moveFocus(1, 0),
      ArrowUp: () => this.moveFocus(0, -1),
      KeyW: () => this.moveFocus(0, -1),
      ArrowDown: () => this.moveFocus(0, 1),
      KeyS: () => this.moveFocus(0, 1),
      Enter: () => this.confirmFocusedCharacter(),
      Space: () => this.confirmFocusedCharacter(),
      Escape: () => this.goTo('MenuScene')
    };
    const action = actions[event.code];
    if (!action) return;
    event.preventDefault();
    action();
  }

  handleGamepadNavigation(button) {
    if (this.transitioning || !button) return;
    const actions = {
      0: () => this.confirmFocusedCharacter(),
      1: () => this.goTo('MenuScene'),
      12: () => this.moveFocus(0, -1),
      13: () => this.moveFocus(0, 1),
      14: () => this.moveFocus(-1, 0),
      15: () => this.moveFocus(1, 0)
    };
    actions[button.index]?.();
  }

  moveFocus(horizontal, vertical) {
    if (!ROSTER.length) return;
    const currentRow = Math.floor(this.focusedIndex / GRID_COLUMNS);
    const currentColumn = this.focusedIndex % GRID_COLUMNS;
    let nextIndex = this.focusedIndex;

    if (horizontal !== 0) {
      const rowStart = currentRow * GRID_COLUMNS;
      const rowLength = Math.min(GRID_COLUMNS, ROSTER.length - rowStart);
      const nextColumn = Phaser.Math.Wrap(currentColumn + horizontal, 0, rowLength);
      nextIndex = rowStart + nextColumn;
    } else if (vertical !== 0) {
      nextIndex += vertical * GRID_COLUMNS;
      if (nextIndex >= ROSTER.length) nextIndex = currentColumn;
      if (nextIndex < 0) {
        const lastRow = Math.ceil(ROSTER.length / GRID_COLUMNS) - 1;
        nextIndex = lastRow * GRID_COLUMNS + currentColumn;
        if (nextIndex >= ROSTER.length) nextIndex -= GRID_COLUMNS;
      }
    }

    this.focusCharacter(nextIndex, true);
  }

  focusCharacter(index, playSound = true) {
    if (!ROSTER.length) return;
    this.focusedIndex = Phaser.Math.Wrap(index, 0, ROSTER.length);
    const view = this.cards[this.focusedIndex];
    this.focusCursor.setPosition(view.card.x, view.card.y).setVisible(true);

    if (this.isOnline && this.onlinePlayerNumber === 2 && !this.player2) {
      this.updatePreview(this.rightPreview, view.fighter, false);
    } else if (this.isOnline && this.onlinePlayerNumber === 1 && !this.player1) {
      this.updatePreview(this.leftPreview, view.fighter, false);
    } else if (!this.player1) {
      this.updatePreview(this.leftPreview, view.fighter, false);
    } else if (!this.player2) {
      this.updatePreview(this.rightPreview, view.fighter, false);
    }

    this.cards.forEach(cardView => this.drawRosterCard(cardView, false));
    if (playSound) {
      this.unlockAudioContext();
      this.playOneShot('sfx_hover', 0.38);
    }
  }

  confirmFocusedCharacter() {
    if (!ROSTER.length || this.transitioning) return;
    if (this.isOnline && this.onlineSelectionComplete) {
      this.startBattle();
      return;
    }
    if (this.isOnline) {
      this.selectOnlineFighter(ROSTER[this.focusedIndex]);
      return;
    }
    if (this.player1 && this.player2) {
      this.startBattle();
      return;
    }
    this.selectFighter(ROSTER[this.focusedIndex]);
  }

  selectFighter(fighter) {
    if (this.isOnline) {
      this.selectOnlineFighter(fighter);
      return;
    }
    if (this.gameMode === 'ARCADE') {
      this.selectArcadePlayer(fighter);
      return;
    }
    if (!this.player1) {
      this.player1 = fighter;
      this.playOneShot('sfx_select', 0.9);
      this.updatePreview(this.leftPreview, fighter, true);
      this.guide.setText('FLECHAS / STICK · ENTER / A: ELIGE AL RIVAL').setColor('#ff8294');
      const selectedIndex = ROSTER.findIndex(character => character.id === fighter.id);
      this.focusCharacter((selectedIndex + 1) % ROSTER.length, false);
    } else if (fighter.id === this.player1.id) {
      this.guide.setText('EL RIVAL DEBE SER OTRO PERSONAJE').setColor('#ffd84d');
    } else {
      this.player2 = fighter;
      this.playOneShot('sfx_select', 0.9);
      this.updatePreview(this.rightPreview, fighter, true);
      this.guide.setText('DUELO LISTO · ENTER / A PARA COMBATIR').setColor('#5ee69a');
      this.fightButton.setVisible(true);
      this.fightButton.getData('hitZone').setInteractive({ useHandCursor: true });
    }
    this.cards.forEach(view => this.drawRosterCard(view, false));
  }

  setupOnlineSelection() {
    this.onlineUnsubscribers = [
      NetworkManager.on('characterSelected', payload => this.applyOnlineCharacter(payload)),
      NetworkManager.on('selectionComplete', payload => this.completeOnlineSelection(payload)),
      NetworkManager.on('opponentDisconnected', () => this.handleOnlineDisconnect('EL RIVAL ABANDONÓ LA SALA.')),
      NetworkManager.on('roomClosed', () => this.handleOnlineDisconnect('EL HOST CERRÓ LA SALA.'))
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.onlineUnsubscribers?.forEach(unsubscribe => unsubscribe());
    });
    if (!NetworkManager.isOnline) {
      this.guide.setText('CONEXIÓN ONLINE PERDIDA · ESC PARA VOLVER').setColor('#ff7189');
    }
  }

  selectOnlineFighter(fighter) {
    if (!NetworkManager.isOnline || !this.onlinePlayerNumber || this.onlineSelectionComplete) return;
    const alreadySelected = this.onlinePlayerNumber === 1 ? this.player1 : this.player2;
    if (alreadySelected) {
      this.guide.setText('ELECCIÓN ENVIADA · ESPERANDO AL OTRO JUGADOR...').setColor('#ffd84d');
      return;
    }
    this.playOneShot('sfx_select', 0.9);
    this.applyOnlineCharacter({ playerNumber: this.onlinePlayerNumber, characterId: fighter.id });
    NetworkManager.sendCharacterSelection(fighter.id);
    this.guide.setText(`${fighter.name.toUpperCase()} CONFIRMADO · ESPERANDO AL RIVAL...`).setColor('#5eff9d');
  }

  applyOnlineCharacter(payload) {
    const fighter = CHARACTER_BY_ID[payload?.characterId];
    if (!fighter || ![1, 2].includes(payload?.playerNumber)) return;
    if (payload.playerNumber === 1) {
      this.player1 = fighter;
      this.updatePreview(this.leftPreview, fighter, true);
    } else {
      this.player2 = fighter;
      this.updatePreview(this.rightPreview, fighter, true);
    }
    this.cards.forEach(view => this.drawRosterCard(view, false));
  }

  completeOnlineSelection(payload) {
    if (this.transitioning) return;
    const player1 = CHARACTER_BY_ID[payload?.player1Key];
    const player2 = CHARACTER_BY_ID[payload?.player2Key];
    if (!player1 || !player2) return;
    this.player1 = player1;
    this.player2 = player2;
    this.onlineSelectionComplete = true;
    this.registry.set('selectedStageId', payload.stageId);
    this.updatePreview(this.leftPreview, player1, true);
    this.updatePreview(this.rightPreview, player2, true);
    this.cards.forEach(view => this.drawRosterCard(view, false));
    this.guide.setText('SELECCIÓN SINCRONIZADA · ¡COMBATE ONLINE LISTO!').setColor('#5eff9d');
    this.fightButton.setVisible(true);
    this.fightButton.getData('hitZone').setInteractive({ useHandCursor: true });
    this.time.delayedCall(850, () => this.startBattle());
  }

  handleOnlineDisconnect(message) {
    if (this.transitioning) return;
    this.guide.setText(message).setColor('#ff7189');
    this.time.delayedCall(1400, () => this.goTo('MenuScene'));
  }

  selectArcadePlayer(fighter) {
    if (this.player1) {
      this.guide.setText('P1 LISTO · ENTER / A PARA INICIAR EL ARCADE').setColor('#5ee69a');
      return;
    }

    this.player1 = fighter;
    this.playOneShot('sfx_select', 0.9);
    this.updatePreview(this.leftPreview, fighter, true);

    const cpuKeys = Phaser.Utils.Array.Shuffle(
      ROSTER.filter(character => character.id !== fighter.id).map(character => character.id)
    );
    const arcadeQueue = [...cpuKeys, ARCADE_BOSS.id];
    this.registry.set('arcadePlayerKey', fighter.id);
    this.registry.set('arcadeQueue', arcadeQueue);
    this.registry.set('arcadeFightIndex', 0);
    this.registry.set('arcadeBossKey', ARCADE_BOSS.id);

    this.player2 = CHARACTER_BY_ID[arcadeQueue[0]];
    this.updatePreview(this.rightPreview, this.player2, true);
    this.guide.setText(`RIVAL 1/${arcadeQueue.length}: ${this.player2.name.toUpperCase()} · ENTER / A PARA COMBATIR`)
      .setColor('#5ee69a');
    this.fightButton.setVisible(true);
    this.fightButton.getData('hitZone').setInteractive({ useHandCursor: true });
    this.cards.forEach(view => this.drawRosterCard(view, false));
  }

  updatePreview(panel, fighter, confirmed = false) {
    panel.portrait.setTexture(fighter.texture).setVisible(true);
    this.scaleToFit(panel.portrait, 188, 298);
    panel.prompt.setVisible(false);
    panel.name.setText(fighter.name.toUpperCase()).setColor('#ffffff');
    panel.status.setText(fighter.category.toUpperCase()).setColor(confirmed ? '#5ee69a' : '#ffd84d');
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
    if (this.isOnline) return;
    this.scene.restart();
  }

  startBattle() {
    if (!this.player1 || !this.player2 || this.transitioning) return;
    if (this.isOnline && !this.onlineSelectionComplete) return;
    this.unlockAudioContext();
    this.transitioning = true;
    this.registry.set('selectedP1Key', this.player1.id);
    this.registry.set('selectedP2Key', this.player2.id);
    this.registry.set('isCpuMode', this.gameMode !== 'VERSUS_2P' && !this.isOnline);
    const requiresStageSelection = !this.isOnline
      && (this.gameMode === 'VS_CPU' || this.gameMode === 'VERSUS_2P');
    if (!requiresStageSelection) this.stopMenuMusic();
    this.cameras.main.fadeOut(250, 3, 6, 13);
    this.time.delayedCall(260, () => {
      this.scene.start(requiresStageSelection ? 'StageSelectScene' : 'VersusScene', {
        player1Key: this.player1.id,
        player2Key: this.player2.id,
        player1: { ...this.player1 },
        player2: { ...this.player2 }
      });
    });
  }

  goTo(sceneKey) {
    if (this.transitioning) return;
    if (this.isOnline && sceneKey === 'MenuScene') {
      NetworkManager.leaveRoom();
      this.registry.set('isOnline', false);
      this.registry.remove('selectedStageId');
    }
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
