const FORWARDED_EVENTS = [
  'roomCreated', 'roomJoined', 'roomReady', 'roomClosed', 'opponentDisconnected',
  'playerDisconnected', 'matchAbandoned',
  'characterSelected', 'selectionComplete', 'playerInput', 'gameStateSync',
  'playerAttack', 'playerHit', 'connect_error', 'disconnect'
];

class NetworkManager {
  constructor() {
    this.socket = null;
    this.isOnline = false;
    this.isHost = false;
    this.roomCode = null;
    this.playerNumber = null;
    this.listeners = new Map();
    this.remoteInput = this.emptyInput();
    this.remoteActions = { jump: false, basic: false, special: false, ulti: false };
    this.latestGameState = null;
    this.inputSequence = 0;
    this.lastInputSentAt = 0;
  }

  connect() {
    if (this.socket?.connected) return Promise.resolve(this.socket);
    if (typeof window === 'undefined' || typeof window.io !== 'function') {
      return Promise.reject(new Error('Socket.io no está disponible. Inicia el juego con npm start.'));
    }
    if (!this.socket) {
      this.socket = window.io({ transports: ['websocket', 'polling'], reconnection: true });
      FORWARDED_EVENTS.forEach(eventName => {
        this.socket.on(eventName, payload => this.handleSocketEvent(eventName, payload));
      });
    }
    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve(this.socket);
        return;
      }
      const timeout = window.setTimeout(() => reject(new Error('Tiempo de conexión agotado.')), 6000);
      this.socket.once('connect', () => {
        window.clearTimeout(timeout);
        resolve(this.socket);
      });
      this.socket.once('connect_error', error => {
        window.clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error('No se pudo conectar al servidor.'));
      });
      if (this.socket.disconnected) this.socket.connect();
    });
  }

  handleSocketEvent(eventName, payload) {
    if (eventName === 'roomCreated' || eventName === 'roomJoined') this.applyRoomIdentity(payload);
    if (eventName === 'playerInput') {
      this.remoteInput = { ...this.emptyInput(), ...payload, receivedAt: performance.now() };
      ['jump', 'basic', 'special', 'ulti'].forEach(action => {
        if (payload?.[action] === true) this.remoteActions[action] = true;
      });
    }
    if (eventName === 'gameStateSync') this.latestGameState = payload;
    if (['roomClosed', 'playerDisconnected', 'matchAbandoned', 'disconnect'].includes(eventName)) {
      this.resetRoomState();
    }
    this.listeners.get(eventName)?.forEach(handler => handler(payload));
  }

  applyRoomIdentity(payload) {
    this.isOnline = true;
    this.roomCode = payload.roomCode;
    this.playerNumber = payload.playerNumber;
    this.isHost = payload.playerNumber === 1;
  }

  createRoom() {
    return this.emitWithAck('createRoom', {});
  }

  joinRoom(roomCode) {
    return this.emitWithAck('joinRoom', { roomCode: String(roomCode || '').toUpperCase() });
  }

  emitWithAck(eventName, payload) {
    return this.connect().then(() => new Promise(resolve => {
      this.socket.emit(eventName, payload, response => {
        if (response?.ok) this.applyRoomIdentity(response);
        resolve(response || { ok: false, error: 'El servidor no respondió.' });
      });
    }));
  }

  sendCharacterSelection(characterId) {
    this.emit('characterSelect', { characterId });
  }

  sendInput(input) {
    if (!this.isOnline || !this.socket?.connected) return;
    const now = performance.now();
    const hasAction = input.jump || input.basic || input.special || input.ulti;
    if (!hasAction && now - this.lastInputSentAt < 33) return;
    this.lastInputSentAt = now;
    this.emit('playerInput', { ...input, sequence: ++this.inputSequence });
  }

  sendGameState(state) {
    if (this.isHost) this.emit('gameStateSync', state);
  }

  sendAttack(attack) {
    if (this.isHost) this.emit('playerAttack', attack);
  }

  sendHit(hit) {
    if (this.isHost) this.emit('playerHit', hit);
  }

  consumeRemoteInput() {
    const stale = performance.now() - (this.remoteInput.receivedAt || 0) > 350;
    const input = stale ? this.emptyInput() : { ...this.remoteInput, ...this.remoteActions };
    this.remoteInput.jump = false;
    this.remoteInput.basic = false;
    this.remoteInput.special = false;
    this.remoteInput.ulti = false;
    this.remoteActions = { jump: false, basic: false, special: false, ulti: false };
    return input;
  }

  consumeLatestGameState() {
    const state = this.latestGameState;
    this.latestGameState = null;
    return state;
  }

  on(eventName, handler) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    this.listeners.get(eventName)?.delete(handler);
  }

  emit(eventName, payload) {
    if (!this.socket?.connected || !this.roomCode) return;
    this.socket.emit(eventName, { ...payload, roomCode: this.roomCode });
  }

  leaveRoom() {
    if (this.socket?.connected && this.roomCode) this.socket.emit('leaveRoom');
    this.resetRoomState();
  }

  abandonMatch() {
    if (!this.socket?.connected || !this.roomCode) {
      this.resetRoomState();
      return Promise.resolve({ ok: false, error: 'La sala ya no está activa.' });
    }
    return new Promise(resolve => {
      let completed = false;
      const finish = response => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeout);
        this.resetRoomState();
        resolve(response || { ok: false, error: 'El servidor no respondió.' });
      };
      const timeout = window.setTimeout(() => finish({ ok: false, error: 'Tiempo de espera agotado.' }), 2500);
      this.socket.emit('abandonMatch', { roomCode: this.roomCode }, finish);
    });
  }

  disconnect() {
    this.leaveRoom();
    this.socket?.disconnect();
    this.socket = null;
  }

  resetRoomState() {
    this.isOnline = false;
    this.isHost = false;
    this.roomCode = null;
    this.playerNumber = null;
    this.remoteInput = this.emptyInput();
    this.remoteActions = { jump: false, basic: false, special: false, ulti: false };
    this.latestGameState = null;
  }

  emptyInput() {
    return { horizontal: 0, jump: false, guard: false, basic: false, special: false, ulti: false };
  }
}

export default new NetworkManager();
