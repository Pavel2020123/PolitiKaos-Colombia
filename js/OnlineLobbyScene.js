import NetworkManager from './network/NetworkManager.js';

export default class OnlineLobbyScene extends Phaser.Scene {
  constructor() {
    super('OnlineLobbyScene');
  }

  create() {
    this.transitioning = false;
    this.busy = false;
    this.codeInputActive = false;
    this.typedCode = '';
    this.unsubscribeNetwork = [];
    this.drawBackground();

    this.add.text(640, 80, 'GUACHAFITA STRIKE · ONLINE', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '45px', fontStyle: 'bold italic',
      color: '#ffd23f', stroke: '#e53163', strokeThickness: 9
    }).setOrigin(0.5);
    this.add.text(640, 130, 'SOCKET.IO · SALAS PRIVADAS DE 4 LETRAS', {
      fontFamily: 'Consolas, monospace', fontSize: '14px', color: '#8fcfff', letterSpacing: 3
    }).setOrigin(0.5);

    this.createLobbyButton(400, 245, 360, 88, 'CREAR SALA', 'SERÁS P1 · HOST', 0x69bfff, () => this.createRoom());
    this.createLobbyButton(880, 245, 360, 88, 'UNIRSE A SALA', 'SERÁS P2 · INVITADO', 0xff8294, () => this.activateCodeInput());

    this.add.text(640, 358, 'CÓDIGO DE SALA', {
      fontFamily: 'Consolas, monospace', fontSize: '13px', fontStyle: 'bold', color: '#aebdd2', letterSpacing: 3
    }).setOrigin(0.5);
    this.codePanel = this.add.rectangle(640, 410, 340, 72, 0x07101f, 1).setStrokeStyle(3, 0x536a89, 1)
      .setInteractive({ useHandCursor: true });
    this.codePanel.on('pointerup', () => this.activateCodeInput());
    this.codeText = this.add.text(640, 410, '____', {
      fontFamily: 'Consolas, monospace', fontSize: '42px', fontStyle: 'bold', color: '#ffffff', letterSpacing: 12
    }).setOrigin(0.5);
    this.joinButton = this.createSimpleButton(640, 495, 250, 54, 'CONECTAR', 0x5adf96, () => this.joinRoom());
    this.statusText = this.add.text(640, 570, 'CREA UNA SALA O ESCRIBE UN CÓDIGO PARA UNIRTE', {
      fontFamily: 'Consolas, monospace', fontSize: '14px', color: '#aebdd2', align: 'center',
      wordWrap: { width: 850, useAdvancedWrap: true }
    }).setOrigin(0.5);
    this.createSimpleButton(135, 660, 190, 52, '‹ VOLVER', 0x60708c, () => this.leaveLobby());
    this.add.text(640, 665, 'TECLADO: A-Z · BACKSPACE BORRAR · ENTER CONECTAR · ESC VOLVER', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#71839d'
    }).setOrigin(0.5);

    this.bindNetworkEvents();
    this.keyboardHandler = event => this.handleKeyboard(event);
    this.input.keyboard.on('keydown', this.keyboardHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyboardHandler);
      this.unsubscribeNetwork.forEach(unsubscribe => unsubscribe());
    });
    this.cameras.main.fadeIn(250, 4, 7, 15);
  }

  bindNetworkEvents() {
    this.unsubscribeNetwork.push(
      NetworkManager.on('roomCreated', data => this.showWaitingRoom(data)),
      NetworkManager.on('roomJoined', data => this.showJoinedRoom(data)),
      NetworkManager.on('roomReady', data => this.enterOnlineSelection(data)),
      NetworkManager.on('roomClosed', () => this.showError('El Host cerró la sala.')),
      NetworkManager.on('opponentDisconnected', () => this.showError('El otro jugador abandonó la sala.')),
      NetworkManager.on('connect_error', () => this.showError('No se pudo conectar con el servidor de Guachafita Strike.'))
    );
  }

  async createRoom() {
    if (this.busy || this.transitioning) return;
    this.busy = true;
    this.setStatus('CONECTANDO CON EL SERVIDOR...', '#ffd84d');
    try {
      const response = await NetworkManager.createRoom();
      if (!response?.ok) this.showError(response?.error || 'No fue posible crear la sala.');
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.busy = false;
    }
  }

  activateCodeInput() {
    if (this.transitioning) return;
    this.codeInputActive = true;
    this.codePanel.setStrokeStyle(4, 0xffd23f, 1);
    this.setStatus('ESCRIBE LAS 4 LETRAS Y PRESIONA ENTER', '#8fcfff');
  }

  async joinRoom() {
    if (this.busy || this.transitioning) return;
    if (this.typedCode.length !== 4) {
      this.showError('El código debe tener exactamente 4 letras.');
      return;
    }
    this.busy = true;
    this.setStatus('BUSCANDO SALA...', '#ffd84d');
    try {
      const response = await NetworkManager.joinRoom(this.typedCode);
      if (!response?.ok) this.showError(response?.error || 'No fue posible entrar a la sala.');
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.busy = false;
    }
  }

  showWaitingRoom(data) {
    this.typedCode = data.roomCode;
    this.refreshCodeText();
    this.codeInputActive = false;
    this.codePanel.setStrokeStyle(4, 0x69bfff, 1);
    this.setStatus(`SALA ${data.roomCode} CREADA · ESPERANDO AL JUGADOR 2...`, '#69bfff');
  }

  showJoinedRoom(data) {
    this.typedCode = data.roomCode;
    this.refreshCodeText();
    this.codeInputActive = false;
    this.codePanel.setStrokeStyle(4, 0xff8294, 1);
    this.setStatus(`CONECTADO A ${data.roomCode} · ESPERANDO SINCRONIZACIÓN...`, '#ff8294');
  }

  enterOnlineSelection(data) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.registry.set('gameMode', 'ONLINE');
    this.registry.set('isOnline', true);
    this.registry.set('isCpuMode', false);
    this.registry.set('onlineRoomCode', data.roomCode);
    this.registry.set('onlinePlayerNumber', NetworkManager.playerNumber);
    this.registry.set('selectedStageId', data.stageId);
    this.setStatus('¡DOS JUGADORES CONECTADOS! ABRIENDO SELECCIÓN...', '#5eff9d');
    this.cameras.main.fadeOut(320, 3, 6, 13);
    this.time.delayedCall(330, () => this.scene.start('SelectScene'));
  }

  handleKeyboard(event) {
    if (this.transitioning) return;
    if (event.code === 'Escape') {
      this.leaveLobby();
      return;
    }
    if (!this.codeInputActive) return;
    if (event.code === 'Backspace') {
      this.typedCode = this.typedCode.slice(0, -1);
      this.refreshCodeText();
      return;
    }
    if (event.code === 'Enter') {
      this.joinRoom();
      return;
    }
    if (/^Key[A-Z]$/.test(event.code) && this.typedCode.length < 4) {
      this.typedCode += event.code.slice(3);
      this.refreshCodeText();
    }
  }

  refreshCodeText() {
    this.codeText.setText(this.typedCode.padEnd(4, '_').split('').join(' '));
  }

  setStatus(message, color) {
    this.statusText.setText(message).setColor(color);
  }

  showError(message) {
    this.setStatus(message.toUpperCase(), '#ff7189');
    this.busy = false;
  }

  leaveLobby() {
    if (this.transitioning) return;
    this.transitioning = true;
    NetworkManager.leaveRoom();
    this.registry.set('isOnline', false);
    this.registry.remove('selectedStageId');
    this.cameras.main.fadeOut(200, 3, 6, 13);
    this.time.delayedCall(210, () => this.scene.start('MenuScene'));
  }

  createLobbyButton(x, y, width, height, titleLabel, subtitleLabel, accent, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, 0x10192b, 1).setStrokeStyle(3, accent, 1);
    const title = this.add.text(0, -13, titleLabel, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '22px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 20, subtitleLabel, {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#9fb0c8'
    }).setOrigin(0.5);
    const zone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => bg.setFillStyle(0x213753, 1).setStrokeStyle(5, 0xffd23f, 1));
    zone.on('pointerout', () => bg.setFillStyle(0x10192b, 1).setStrokeStyle(3, accent, 1));
    zone.on('pointerup', onClick);
    container.add([bg, title, subtitle, zone]);
    return container;
  }

  createSimpleButton(x, y, width, height, label, accent, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, 0x14233a, 1).setStrokeStyle(2, accent, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const zone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => bg.setStrokeStyle(4, 0xffd23f, 1));
    zone.on('pointerout', () => bg.setStrokeStyle(2, accent, 1));
    zone.on('pointerup', onClick);
    container.add([bg, text, zone]);
    return container;
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x050914, 0x23103d, 0x132c49, 0x070b16, 1);
    g.fillRect(0, 0, 1280, 720);
    g.lineStyle(2, 0x4c8dff, 0.22);
    for (let y = 0; y <= 720; y += 40) g.lineBetween(0, y, 1280, y);
    for (let x = 0; x <= 1280; x += 64) g.lineBetween(x, 0, x, 720);
  }
}
