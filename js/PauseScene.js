import NetworkManager from './network/NetworkManager.js';

const OFFLINE_MENU_OPTIONS = Object.freeze([
  { label: 'CONTINUAR', action: 'resume' },
  { label: 'REINICIAR PELEA', action: 'restart' },
  { label: 'OPCIONES DE AUDIO', action: 'audio' },
  { label: 'SALIR AL MENÚ PRINCIPAL', action: 'exit' }
]);

const ONLINE_MENU_OPTIONS = Object.freeze([
  { label: 'CONTINUAR', action: 'resume' },
  { label: 'ABANDONAR PARTIDA', action: 'abandon' },
  { label: 'OPCIONES DE AUDIO', action: 'audio' }
]);

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  init(data) {
    this.fightData = {
      player1Key: data?.player1Key || this.registry.get('selectedP1Key'),
      player2Key: data?.player2Key || this.registry.get('selectedP2Key'),
      stageId: data?.stageId || this.registry.get('activeStageId')
    };
  }

  create() {
    this.battleScene = this.scene.get('BattleScene');
    this.isOnline = this.registry.get('isOnline') === true || this.battleScene?.isOnline === true;
    this.menuOptions = this.isOnline ? ONLINE_MENU_OPTIONS : OFFLINE_MENU_OPTIONS;
    this.selectedIndex = 0;
    this.audioIndex = 0;
    this.audioMode = false;
    this.leaving = false;
    this.inputUnlockAt = this.time.now + 220;

    this.add.rectangle(640, 360, 1280, 720, 0x02040a, 0.78)
      .setInteractive({ useHandCursor: false });
    this.add.rectangle(640, 360, 560, 570, 0x0b1426, 0.98)
      .setStrokeStyle(4, 0x69bfff, 0.95);
    this.add.text(640, 112, this.isOnline ? 'PAUSA ONLINE' : 'PAUSA', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '58px', fontStyle: 'bold italic',
      color: '#ffd23f', stroke: '#e53163', strokeThickness: 9,
      shadow: { color: '#e53163', blur: 20, fill: true }
    }).setOrigin(0.5);

    this.menuLayer = this.add.container(0, 0);
    const menuStartY = this.menuOptions.length === 3 ? 255 : 225;
    this.menuButtons = this.menuOptions.map((option, index) => this.createMenuButton(
      640,
      menuStartY + index * 82,
      option.label,
      () => this.runAction(option.action),
      index
    ));
    this.menuLayer.add(this.menuButtons);
    this.menuHint = this.add.text(640, 595, '↑ ↓ ELEGIR   ·   ENTER / A CONFIRMAR   ·   ESC / START CONTINUAR', {
      fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#8fa5c3'
    }).setOrigin(0.5);
    this.menuLayer.add(this.menuHint);

    this.createAudioPanel();
    this.refreshMenuFocus();
    this.bindInputs();
    this.bindOnlineEvents();

    this.cameras.main.fadeIn(120, 0, 0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unbindInputs();
      this.onlineUnsubscribers?.forEach(unsubscribe => unsubscribe());
    });
  }

  bindOnlineEvents() {
    if (!this.isOnline) return;
    this.onlineUnsubscribers = [
      NetworkManager.on('playerDisconnected', payload => this.resumeForDisconnect(payload)),
      NetworkManager.on('matchAbandoned', payload => this.handleMatchAbandoned(payload)),
      NetworkManager.on('disconnect', () => this.resumeForConnectionLoss())
    ];
  }

  createMenuButton(x, y, label, onClick, index) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 410, 58, 0x152743, 0.98)
      .setStrokeStyle(2, 0x42658a, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 410, 58)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setData('index', index);
    hitZone.on('pointerover', () => {
      this.selectedIndex = index;
      this.refreshMenuFocus();
    });
    hitZone.on('pointerup', onClick);
    container.add([bg, text, hitZone]);
    container.setData({ bg, text });
    return container;
  }

  refreshMenuFocus() {
    this.menuButtons.forEach((button, index) => {
      const focused = index === this.selectedIndex;
      button.getData('bg')
        .setFillStyle(focused ? 0x294d78 : 0x152743, 0.98)
        .setStrokeStyle(focused ? 4 : 2, focused ? 0xffd23f : 0x42658a, 1);
      button.getData('text').setColor(focused ? '#ffd23f' : '#ffffff');
      button.setScale(focused ? 1.035 : 1);
    });
  }

  createAudioPanel() {
    this.audioPanel = this.add.container(0, 0).setVisible(false);
    const title = this.add.text(640, 215, 'AUDIO RÁPIDO', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '27px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    this.audioPanel.add(title);

    this.audioRows = [
      this.createAudioRow(295, 'BGM', 'musicVolume', 0),
      this.createAudioRow(385, 'SFX', 'sfxVolume', 1)
    ];
    this.audioPanel.add(this.audioRows);
    this.audioClose = this.createAudioCloseButton();
    this.audioPanel.add(this.audioClose);
    const hint = this.add.text(640, 585, '← → AJUSTAR   ·   ESC VOLVER', {
      fontFamily: 'Consolas, monospace', fontSize: '14px', color: '#8fa5c3'
    }).setOrigin(0.5);
    this.audioPanel.add(hint);
    this.refreshAudioPanel();
  }

  createAudioRow(y, label, settingKey, index) {
    const row = this.add.container(640, y);
    const bg = this.add.rectangle(0, 0, 410, 66, 0x101f37, 0.98)
      .setStrokeStyle(2, 0x42658a, 1);
    const labelText = this.add.text(-165, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '21px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0, 0.5);
    const valueText = this.add.text(95, 0, '0%', {
      fontFamily: 'Consolas, monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffd23f'
    }).setOrigin(0.5);
    const minus = this.createSmallButton(-45, 0, '−', () => this.changeAudio(settingKey, -0.1));
    const plus = this.createSmallButton(175, 0, '+', () => this.changeAudio(settingKey, 0.1));
    const focusZone = this.add.zone(0, 0, 410, 66)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    focusZone.on('pointerover', () => {
      this.audioIndex = index;
      this.refreshAudioPanel();
    });
    row.add([bg, labelText, valueText, focusZone, minus, plus]);
    row.setData({ bg, valueText, settingKey });
    return row;
  }

  createSmallButton(x, y, label, onClick) {
    const button = this.add.container(x, y).setDepth(3);
    const bg = this.add.rectangle(0, 0, 44, 42, 0x294d78, 1).setStrokeStyle(2, 0x69bfff, 1);
    const text = this.add.text(0, -1, label, {
      fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hit = this.add.zone(0, 0, 44, 42)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => bg.setFillStyle(0x3e70a6, 1));
    hit.on('pointerout', () => bg.setFillStyle(0x294d78, 1));
    hit.on('pointerup', onClick);
    button.add([bg, text, hit]);
    return button;
  }

  createAudioCloseButton() {
    const button = this.add.container(640, 490);
    const bg = this.add.rectangle(0, 0, 240, 56, 0x562342, 1).setStrokeStyle(2, 0xe75a87, 1);
    const text = this.add.text(0, 0, 'VOLVER', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '19px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hit = this.add.zone(0, 0, 240, 56)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      this.audioIndex = 2;
      this.refreshAudioPanel();
    });
    hit.on('pointerup', () => this.closeAudioPanel());
    button.add([bg, text, hit]);
    button.setData({ bg, text });
    return button;
  }

  refreshAudioPanel() {
    const settings = this.registry.get('audioSettings') || {};
    this.audioRows?.forEach((row, index) => {
      const focused = index === this.audioIndex;
      row.getData('bg').setStrokeStyle(focused ? 4 : 2, focused ? 0xffd23f : 0x42658a, 1);
      const value = Phaser.Math.Clamp(settings[row.getData('settingKey')] ?? 0, 0, 1);
      row.getData('valueText').setText(`${Math.round(value * 100)}%`);
    });
    if (this.audioClose) {
      const focused = this.audioIndex === 2;
      this.audioClose.getData('bg').setStrokeStyle(focused ? 4 : 2, focused ? 0xffd23f : 0xe75a87, 1);
      this.audioClose.getData('text').setColor(focused ? '#ffd23f' : '#ffffff');
    }
  }

  changeAudio(settingKey, delta) {
    const current = this.registry.get('audioSettings') || {};
    const nextValue = Phaser.Math.Clamp((current[settingKey] ?? 0) + delta, 0, 1);
    const settings = { ...current, [settingKey]: Number(nextValue.toFixed(2)) };
    this.registry.set('audioSettings', settings);
    this.battleScene?.audioManager?.updateSettings(settings);
    if (settingKey === 'sfxVolume') this.battleScene?.audioManager?.playSfx('timer');
    this.refreshAudioPanel();
  }

  bindInputs() {
    this.keyHandler = event => this.handleKey(event);
    this.gamepadHandler = (pad, button) => this.handleGamepad(button);
    this.input.keyboard.on('keydown', this.keyHandler);
    this.input.gamepad?.on('down', this.gamepadHandler);
  }

  unbindInputs() {
    this.input.keyboard.off('keydown', this.keyHandler);
    this.input.gamepad?.off('down', this.gamepadHandler);
  }

  handleKey(event) {
    if (this.time.now < this.inputUnlockAt) return;
    if (event.code === 'Escape') {
      if (this.audioMode) this.closeAudioPanel();
      else this.resumeBattle();
      return;
    }
    if (event.code === 'ArrowUp') this.moveFocus(-1);
    if (event.code === 'ArrowDown') this.moveFocus(1);
    if (event.code === 'ArrowLeft' && this.audioMode) this.adjustFocusedAudio(-0.1);
    if (event.code === 'ArrowRight' && this.audioMode) this.adjustFocusedAudio(0.1);
    if (event.code === 'Enter' || event.code === 'Space') this.confirmFocus();
  }

  handleGamepad(button) {
    if (this.time.now < this.inputUnlockAt || !button) return;
    if (button.index === 9) {
      if (this.audioMode) this.closeAudioPanel();
      else this.resumeBattle();
      return;
    }
    if (button.index === 12) this.moveFocus(-1);
    if (button.index === 13) this.moveFocus(1);
    if (this.audioMode && button.index === 14) this.adjustFocusedAudio(-0.1);
    if (this.audioMode && button.index === 15) this.adjustFocusedAudio(0.1);
    if (button.index === 0) this.confirmFocus();
  }

  moveFocus(direction) {
    if (this.audioMode) {
      this.audioIndex = Phaser.Math.Wrap(this.audioIndex + direction, 0, 3);
      this.refreshAudioPanel();
      return;
    }
    this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.menuOptions.length);
    this.refreshMenuFocus();
  }

  confirmFocus() {
    if (this.audioMode) {
      if (this.audioIndex === 2) this.closeAudioPanel();
      return;
    }
    this.runAction(this.menuOptions[this.selectedIndex].action);
  }

  adjustFocusedAudio(delta) {
    if (this.audioIndex > 1) return;
    this.changeAudio(this.audioIndex === 0 ? 'musicVolume' : 'sfxVolume', delta);
  }

  runAction(action) {
    if (action === 'resume') this.resumeBattle();
    if (action === 'restart') this.restartBattle();
    if (action === 'audio') this.openAudioPanel();
    if (action === 'exit') this.exitToMenu();
    if (action === 'abandon') this.abandonOnlineBattle();
  }

  openAudioPanel() {
    this.audioMode = true;
    this.audioIndex = 0;
    this.menuLayer.setVisible(false);
    this.audioPanel.setVisible(true);
    this.refreshAudioPanel();
  }

  closeAudioPanel() {
    this.audioMode = false;
    this.audioPanel.setVisible(false);
    this.menuLayer.setVisible(true);
    this.refreshMenuFocus();
  }

  resumeBattle() {
    if (!this.battleScene || this.leaving) return;
    this.leaving = true;
    this.battleScene.pauseRequested = false;
    this.battleScene.audioManager?.resumeBgm();
    this.scene.resume('BattleScene');
    this.scene.stop();
  }

  restartBattle() {
    if (this.leaving || this.isOnline) return;
    this.leaving = true;
    this.scene.stop('BattleScene');
    this.scene.start('BattleScene', this.fightData);
  }

  exitToMenu() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.stop('BattleScene');
    this.scene.start('MenuScene');
  }

  async abandonOnlineBattle() {
    if (this.leaving || !this.isOnline) return;
    this.leaving = true;
    this.menuHint.setText('CERRANDO SALA...');
    await NetworkManager.abandonMatch();
    this.goToOnlineLobby();
  }

  handleMatchAbandoned(payload) {
    if (!this.isOnline) return;
    const localPlayer = this.battleScene?.onlinePlayerNumber;
    const message = payload?.abandonedBy === localPlayer
      ? 'HAS ABANDONADO LA PARTIDA'
      : 'EL OPONENTE ABANDONÓ LA PARTIDA';
    this.menuHint.setText(message);
    this.goToOnlineLobby(650);
  }

  resumeForDisconnect(payload) {
    if (!this.battleScene) {
      this.goToOnlineLobby();
      return;
    }
    this.battleScene.pauseRequested = false;
    this.scene.resume('BattleScene');
    this.battleScene.handleOnlinePlayerDisconnected(payload);
    this.scene.stop();
  }

  resumeForConnectionLoss() {
    if (!this.battleScene) {
      this.goToOnlineLobby();
      return;
    }
    this.battleScene.pauseRequested = false;
    this.scene.resume('BattleScene');
    this.battleScene.handleOnlineConnectionLost();
    this.scene.stop();
  }

  goToOnlineLobby(delay = 0) {
    if (this.onlineLobbyTransitioned) return;
    this.onlineLobbyTransitioned = true;
    const navigate = () => {
      this.registry.set('isOnline', false);
      this.registry.set('gameMode', 'ONLINE');
      this.registry.remove('selectedStageId');
      this.scene.stop('BattleScene');
      this.scene.start('OnlineLobbyScene');
    };
    if (delay > 0) this.time.delayedCall(delay, navigate);
    else navigate();
  }
}
