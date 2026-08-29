import { ACTIVE_CHARACTERS, CHARACTER_BY_ID, preloadCharacterAssets } from './data/characters.js';
import BattleAudioManager from './audio/BattleAudioManager.js';
import { STAGES, STAGE_BY_ID, getRandomStage } from '../src/data/stages.js';
import { formatArcadeTime, saveArcadeRecord } from './data/arcadeRecords.js';
import NetworkManager from './network/NetworkManager.js';
import AnimationManager from './managers/AnimationManager.js';

const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;
const MOVE_SPEED = 310;
const JUMP_SPEED = 650;
const CPU_REACTION_CHANCE = 0.25;

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    const selectedP1Key = this.registry.get('selectedP1Key') || data?.player1Key;
    const selectedP2Key = this.registry.get('selectedP2Key') || data?.player2Key;
    const fallbackP1 = ACTIVE_CHARACTERS[0];
    const fallbackP2 = ACTIVE_CHARACTERS.find(character => character.id !== fallbackP1?.id) || fallbackP1;

    this.selectionData = {
      player1: CHARACTER_BY_ID[selectedP1Key] || data?.player1 || fallbackP1,
      player2: CHARACTER_BY_ID[selectedP2Key] || data?.player2 || fallbackP2
    };
    this.gameMode = this.registry.get('gameMode') || 'VS_CPU';
    this.isOnline = this.gameMode === 'ONLINE' || this.registry.get('isOnline') === true;
    this.isHost = this.isOnline && NetworkManager.isHost;
    this.onlinePlayerNumber = NetworkManager.playerNumber;
    this.lastOnlineStateSentAt = 0;
    const selectedStage = this.registry.get('selectedStage');
    const requestedStageId = data?.stageId
      || this.registry.get('selectedStageId')
      || (typeof selectedStage === 'string' ? selectedStage : selectedStage?.id);
    this.stage = STAGE_BY_ID[requestedStageId]
      || (this.gameMode === 'ARCADE' || this.gameMode === 'VS_CPU'
        ? getRandomStage(this.registry.get('activeStageId'))
        : STAGES[0]);
    this.stageLayerConfigs = this.getStageLayerConfigs(this.stage);
    this.registry.set('activeStageId', this.stage.id);
  }

  preload() {
    this.failedTextureKeys = new Set();
    this.load.on('loaderror', file => this.failedTextureKeys.add(file.key));

    const battleCharacters = [...ACTIVE_CHARACTERS, this.selectionData.player1, this.selectionData.player2]
      .filter((character, index, list) => character
        && list.findIndex(item => item?.id === character.id) === index);
    preloadCharacterAssets(this, battleCharacters);
    battleCharacters.forEach(character => AnimationManager.preloadCharacter(this, character));
    this.stageLayerConfigs.forEach(layerConfig => {
      if (layerConfig.image && !this.textures.exists(layerConfig.texture)) {
        this.load.image(layerConfig.texture, layerConfig.image);
      }
    });
    BattleAudioManager.preload(this, this.stage.musicTrack);
  }

  create() {
    this.transitioning = false;
    this.pauseRequested = false;
    this.roundIntroStarted = false;
    this.countdownAudioPlayed = false;
    this.gameMode = this.registry.get('gameMode') || 'VS_CPU';
    this.roundActive = true;
    this.controlsLocked = true;
    this.koSequenceActive = false;
    this.roundStartedAt = null;
    this.roundFinishedAt = null;
    this.roundTimeRecorded = false;
    this.roundElapsedMs = 0;
    this.roundTime = 99;
    this.gamepadButtonState = [{}, {}];

    this.ensureFallbackTextures();
    this.groundTop = this.stage.floor.y;
    this.physics.world.setBounds(this.stage.floor.x, 0, this.stage.floor.width, ARENA_HEIGHT);
    this.cameras.main.setBounds(
      this.stage.cameraBounds.x,
      this.stage.cameraBounds.y,
      this.stage.cameraBounds.width,
      this.stage.cameraBounds.height
    );
    this.drawArena();
    this.createGround();

    this.player1 = this.spawnFighter(this.selectionData.player1, 300, false, 'P1');
    this.player2 = this.spawnFighter(this.selectionData.player2, 980, true, 'P2');
    this.isCpuMode = this.resolveCpuMode();
    this.cpuState = {
      nextDecisionAt: 0,
      guardUntil: 0,
      retreatUntil: 0
    };

    this.physics.add.collider(this.player1.sprite, this.ground);
    this.physics.add.collider(this.player2.sprite, this.ground);
    this.physics.add.collider(this.player1.sprite, this.player2.sprite);

    this.createDebugOverlay();
    this.createHud();
    this.setupControls();
    if (this.isOnline) this.setupOnlineBattle();
    this.audioManager = new BattleAudioManager(this, this.stage.musicTrack);
    this.audioManager.startBgm();
    this.refreshAudioStatus();
    this.playRoundIntro();

    this.pauseKeyboardHandler = () => this.openPause();
    this.pauseGamepadHandler = (pad, button) => {
      if (button?.index === 9) this.openPause();
    };
    this.input.keyboard.on('keydown-ESC', this.pauseKeyboardHandler);
    this.input.gamepad?.on('down', this.pauseGamepadHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ESC', this.pauseKeyboardHandler);
      this.input.gamepad?.off('down', this.pauseGamepadHandler);
      this.audioManager?.destroy();
    });

    this.cameras.main.fadeIn(220, 4, 7, 15);
  }

  update(time, delta) {
    this.updateDebugControls();
    this.updateParallax();
    this.updateDebugOverlay();
    this.updateAudioControls();
    if (this.roundActive && !this.controlsLocked && !this.koSequenceActive) {
      this.roundElapsedMs += delta;
    }
    if (this.isOnline) {
      this.updateOnlineBattle(time);
      return;
    }
    if (!this.roundActive) return;

    const pad1State = this.readGamepadState(this.input.gamepad?.getPad(0), 0);
    const pad2State = this.readGamepadState(this.input.gamepad?.getPad(1), 1);

    if (this.controlsLocked) {
      this.player1.sprite.setVelocityX(0);
      this.player2.sprite.setVelocityX(0);
      this.syncNamePlate(this.player1);
      this.syncNamePlate(this.player2);
      return;
    }

    this.updateMovement(this.player1, this.controls.p1, pad1State);
    if (this.isCpuMode) {
      this.updateCpuController();
    } else {
      this.updateMovement(this.player2, this.controls.p2, pad2State);
    }
    this.updateFacingDirections();
    this.updateKeyboardAttacks();
    this.updateGamepadAttacks(this.player1, this.player2, pad1State);
    if (!this.isCpuMode) this.updateGamepadAttacks(this.player2, this.player1, pad2State);
  }

  setupOnlineBattle() {
    this.onlineUnsubscribers = [
      NetworkManager.on('playerAttack', payload => {
        if (!this.isHost) this.showNetworkAttackEvent(payload);
      }),
      NetworkManager.on('playerHit', payload => {
        if (!this.isHost) this.showNetworkHitEvent(payload);
      }),
      NetworkManager.on('playerDisconnected', payload => this.handleOnlinePlayerDisconnected(payload)),
      NetworkManager.on('matchAbandoned', payload => this.handleOnlineMatchAbandoned(payload)),
      NetworkManager.on('opponentDisconnected', () => this.handleOnlineMatchAbandoned()),
      NetworkManager.on('roomClosed', () => this.handleOnlineMatchAbandoned()),
      NetworkManager.on('disconnect', () => this.handleOnlineConnectionLost())
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.onlineUnsubscribers?.forEach(unsubscribe => unsubscribe());
    });
    if (!this.isHost) {
      this.player1.sprite.body.setAllowGravity(false);
      this.player2.sprite.body.setAllowGravity(false);
    }
  }

  updateOnlineBattle(time) {
    if (!NetworkManager.isOnline) return;
    if (this.isHost) {
      if (!this.roundActive) return;
      const localPadState = this.readGamepadState(this.input.gamepad?.getPad(0), 0);
      const localInput = this.buildOnlineLocalInput(this.controls.p1, localPadState);
      NetworkManager.sendInput(localInput);

      if (this.controlsLocked) {
        this.player1.sprite.setVelocityX(0);
        this.player2.sprite.setVelocityX(0);
      } else {
        const remoteInput = NetworkManager.consumeRemoteInput();
        this.applyOnlineMovement(this.player1, localInput);
        this.applyOnlineMovement(this.player2, remoteInput);
        this.processOnlineAttacks(this.player1, this.player2, localInput);
        this.processOnlineAttacks(this.player2, this.player1, remoteInput);
        this.updateFacingDirections();
      }
      this.syncNamePlate(this.player1);
      this.syncNamePlate(this.player2);
      this.broadcastOnlineState(time);
      return;
    }

    const localPadState = this.readGamepadState(this.input.gamepad?.getPad(0), 0);
    const localInput = this.controlsLocked
      ? NetworkManager.emptyInput()
      : this.buildOnlineLocalInput(this.controls.p1, localPadState);
    NetworkManager.sendInput(localInput);
    const snapshot = NetworkManager.consumeLatestGameState();
    if (snapshot) this.applyOnlineSnapshot(snapshot);
  }

  buildOnlineLocalInput(controls, padState) {
    const keyboardDirection = (controls.left.isDown ? -1 : 0) + (controls.right.isDown ? 1 : 0);
    return {
      horizontal: keyboardDirection || padState.horizontal,
      jump: Phaser.Input.Keyboard.JustDown(controls.jump) || padState.jump,
      guard: controls.guard.isDown || padState.guard,
      basic: Phaser.Input.Keyboard.JustDown(controls.basic) || padState.basic,
      special: Phaser.Input.Keyboard.JustDown(controls.special) || padState.special,
      ulti: Phaser.Input.Keyboard.JustDown(controls.ulti) || padState.ulti
    };
  }

  applyOnlineMovement(combatant, input) {
    if (this.time.now < combatant.frozenUntil) {
      this.setGuardState(combatant, false);
      combatant.sprite.setVelocity(0, 0);
      return;
    }
    this.setGuardState(combatant, input.guard);
    if (input.guard) {
      combatant.sprite.setVelocityX(0);
      return;
    }
    combatant.sprite.setVelocityX(Phaser.Math.Clamp(input.horizontal || 0, -1, 1) * MOVE_SPEED);
    const canJump = combatant.sprite.body.blocked.down || combatant.sprite.body.touching.down;
    if (canJump && input.jump) combatant.sprite.setVelocityY(-JUMP_SPEED);
  }

  processOnlineAttacks(attacker, target, input) {
    if (input.basic) this.performBasicAttack(attacker, target);
    if (input.special) this.performSpecialAttack(attacker, target);
    if (input.ulti) this.performUltimateAttack(attacker, target);
  }

  broadcastOnlineState(time = this.time.now, extra = {}) {
    if (!this.isHost || (!extra.roundEnded && time - this.lastOnlineStateSentAt < 50)) return;
    this.lastOnlineStateSentAt = time;
    NetworkManager.sendGameState({
      sequenceTime: time,
      roundTime: this.roundTime,
      controlsLocked: this.controlsLocked,
      player1: this.serializeOnlineFighter(this.player1),
      player2: this.serializeOnlineFighter(this.player2),
      ...extra
    });
  }

  serializeOnlineFighter(combatant) {
    return {
      x: Number(combatant.sprite.x.toFixed(2)),
      y: Number(combatant.sprite.y.toFixed(2)),
      velocityX: Number((combatant.sprite.body?.velocity.x || 0).toFixed(2)),
      velocityY: Number((combatant.sprite.body?.velocity.y || 0).toFixed(2)),
      flipX: combatant.sprite.flipX,
      health: combatant.health,
      super: combatant.super,
      comboCount: combatant.comboCount,
      isGuarding: combatant.isGuarding
    };
  }

  applyOnlineSnapshot(snapshot) {
    const shouldEndRound = snapshot.roundEnded && this.roundActive;
    this.controlsLocked = Boolean(snapshot.controlsLocked);
    this.roundTime = Number.isFinite(snapshot.roundTime) ? snapshot.roundTime : this.roundTime;
    this.timerText.setText(String(this.roundTime).padStart(2, '0'));
    this.applyOnlineFighterState(this.player1, snapshot.player1);
    this.applyOnlineFighterState(this.player2, snapshot.player2);
    this.updateHud();
    if (shouldEndRound) {
      const winner = snapshot.winnerSide === 'P1' ? this.player1
        : snapshot.winnerSide === 'P2' ? this.player2 : null;
      this.endRound(winner, snapshot.reason || 'ko');
    }
  }

  applyOnlineFighterState(combatant, state) {
    if (!state) return;
    combatant.sprite.setPosition(
      Phaser.Math.Linear(combatant.sprite.x, state.x, 0.72),
      Phaser.Math.Linear(combatant.sprite.y, state.y, 0.72)
    );
    combatant.sprite.setVelocity(state.velocityX || 0, state.velocityY || 0);
    combatant.sprite.setFlipX(Boolean(state.flipX));
    combatant.health = Phaser.Math.Clamp(state.health ?? combatant.health, 0, 100);
    combatant.super = Phaser.Math.Clamp(state.super ?? combatant.super, 0, 100);
    const previousCombo = combatant.comboCount;
    combatant.comboCount = Math.max(0, Number(state.comboCount) || 0);
    if (combatant.comboCount >= 2 && combatant.comboCount > previousCombo) this.showComboCounter(combatant);
    this.setGuardState(combatant, state.isGuarding);
    this.syncNamePlate(combatant);
  }

  showNetworkAttackEvent(payload) {
    const attacker = payload?.attackerSide === 'P2' ? this.player2 : this.player1;
    if (!attacker?.sprite) return;
    const animationState = payload?.animationState
      || (payload?.attackType === 'basic' ? 'attack_light' : 'special');
    attacker.playAnimation(animationState, { force: true, lockMs: 320 });
    const direction = attacker.sprite.flipX ? -1 : 1;
    const effect = this.add.rectangle(
      attacker.sprite.x + direction * 85,
      attacker.sprite.y,
      125,
      72,
      payload.hit ? 0xffd23f : 0x6e86ab,
      0.3
    ).setDepth(20);
    this.tweens.add({ targets: effect, scaleX: 1.35, alpha: 0, duration: 170, onComplete: () => effect.destroy() });
  }

  showNetworkHitEvent(payload) {
    const target = payload?.targetSide === 'P2' ? this.player2 : this.player1;
    if (!target) return;
    target.health = Phaser.Math.Clamp(payload.health ?? target.health, 0, 100);
    target.playAnimation(target.health <= 0 ? 'ko' : payload.blocked ? 'guard' : 'hurt', {
      force: true,
      lockMs: target.health <= 0 ? Number.MAX_SAFE_INTEGER : 220
    });
    this.flashDamage(target, false);
    this.showFloatingDamage(target, payload.damage || 0, payload.blocked);
    this.updateHud();
  }

  lockOnlineBattle(message, color = '#ff7189') {
    this.controlsLocked = true;
    this.roundActive = false;
    this.roundTimerEvent?.remove(false);
    this.roundTimerEvent = null;
    this.player1?.sprite?.setVelocity(0, 0);
    this.player2?.sprite?.setVelocity(0, 0);
    this.physics.world.pause();
    this.audioManager?.stopBgm();
    this.combatLog?.setText(message).setColor(color);
    return this.add.text(640, 350, message, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '38px', fontStyle: 'bold',
      color, stroke: '#080b12', strokeThickness: 8, align: 'center'
    }).setOrigin(0.5).setDepth(90);
  }

  handleOnlinePlayerDisconnected(payload = {}) {
    if (this.transitioning || this.onlineDisconnectHandled) return;
    this.onlineDisconnectHandled = true;
    const notice = this.lockOnlineBattle('OPONENTE DESCONECTADO');
    const countdown = this.add.text(640, 420, 'VICTORIA POR ABANDONO EN 3', {
      fontFamily: 'Consolas, monospace', fontSize: '24px', fontStyle: 'bold',
      color: '#ffd23f', stroke: '#080b12', strokeThickness: 5
    }).setOrigin(0.5).setDepth(90);
    let seconds = 3;
    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        seconds -= 1;
        if (seconds > 0) countdown.setText(`VICTORIA POR ABANDONO EN ${seconds}`);
      }
    });
    this.time.delayedCall(3000, () => {
      notice.setText('¡VICTORIA POR ABANDONO!').setColor('#69ffb2');
      countdown.setText('REGRESANDO AL LOBBY...');
      this.registry.set('lastOnlineResult', {
        result: 'win_by_forfeit',
        winnerPlayerNumber: payload.winnerPlayerNumber || this.onlinePlayerNumber
      });
      this.cameras.main.flash(220, 105, 255, 178);
      this.time.delayedCall(700, () => this.returnToOnlineLobby());
    });
  }

  handleOnlineMatchAbandoned(payload = {}) {
    if (this.transitioning || this.onlineDisconnectHandled) return;
    this.onlineDisconnectHandled = true;
    const abandonedByLocalPlayer = payload.abandonedBy === this.onlinePlayerNumber;
    this.lockOnlineBattle(
      abandonedByLocalPlayer ? 'HAS ABANDONADO LA PARTIDA' : 'EL OPONENTE ABANDONÓ LA PARTIDA'
    );
    this.time.delayedCall(1200, () => this.returnToOnlineLobby());
  }

  handleOnlineConnectionLost() {
    if (this.transitioning || this.onlineDisconnectHandled) return;
    this.onlineDisconnectHandled = true;
    this.lockOnlineBattle('CONEXIÓN CON EL SERVIDOR PERDIDA');
    this.time.delayedCall(1800, () => this.returnToOnlineLobby());
  }

  returnToOnlineLobby() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.registry.set('isOnline', false);
    this.registry.set('gameMode', 'ONLINE');
    this.registry.remove('selectedStageId');
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => this.scene.start('OnlineLobbyScene'));
  }

  resolveCpuMode() {
    if (this.isOnline) return false;
    const configuredMode = this.registry.get('isCpuMode');
    const secondGamepadConnected = Boolean(this.input.gamepad?.getPad(1)?.connected);
    if (configuredMode === true) return true;
    if (configuredMode === false) return false;
    return !secondGamepadConnected;
  }

  ensureFallbackTextures() {
    const characters = [...ACTIVE_CHARACTERS, this.selectionData.player1, this.selectionData.player2]
      .filter((character, index, list) => character
        && list.findIndex(item => item?.id === character.id) === index);
    characters.forEach(character => {
      this.ensureFallbackTexture(character.portrait, character.color);
      this.ensureFallbackTexture(character.headSprite, character.color);
    });
  }

  ensureFallbackTexture(textureKey, color) {
    if (this.textures.exists(textureKey)) return;
    const g = this.add.graphics();
    g.fillStyle(0x101827, 1);
    g.fillRect(0, 0, 300, 300);
    g.fillStyle(color || 0x60708c, 0.9);
    g.fillCircle(150, 112, 72);
    g.fillRoundedRect(62, 178, 176, 130, 48);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(124, 104, 9);
    g.fillCircle(176, 104, 9);
    g.lineStyle(8, 0xffffff, 0.78);
    g.lineBetween(115, 148, 185, 148);
    g.lineStyle(5, color || 0x60708c, 1);
    g.strokeRect(5, 5, 290, 290);
    g.generateTexture(textureKey, 300, 300);
    g.destroy();
  }

  getStageLayerConfigs(stage) {
    const normalize = (value, slot, defaults) => {
      if (!value) return null;
      const config = typeof value === 'string' ? { image: value } : value;
      return {
        slot,
        texture: config.texture || `${stage.id}_${slot}`,
        image: config.image || config.path,
        parallax: config.parallax ?? defaults.parallax,
        depth: config.depth ?? defaults.depth,
        align: config.align || 'ground',
        overscan: config.overscan ?? 150,
        offsetY: config.offsetY ?? 0,
        alpha: config.alpha ?? 1,
        tint: config.tint ?? null
      };
    };
    const layers = [
      normalize(stage.bgFar, 'bgFar', { parallax: 0.15, depth: -30 }),
      normalize(stage.bgMid, 'bgMid', { parallax: 0.5, depth: -20 }),
      normalize(stage.fgFront, 'fgFront', { parallax: 1.1, depth: 18 })
    ].filter(Boolean);

    if (layers.length) {
      const isRealImagePath = typeof stage.bgImage === 'string' && !stage.bgImage.startsWith('data:');
      const farLayer = layers.find(layerConfig => layerConfig.slot === 'bgFar');
      if (isRealImagePath && farLayer) {
        farLayer.image = stage.bgImage;
        farLayer.texture = stage.bgTexture || `${stage.id}_photo_bg`;
      }
      return layers;
    }
    return [normalize({
      texture: stage.bgTexture || `${stage.id}_legacy_bg`,
      image: stage.bgImage,
      parallax: 0.42,
      depth: -20,
      overscan: 180
    }, 'bgImage', { parallax: 0.42, depth: -20 })].filter(Boolean);
  }

  ensureStageLayerTextures() {
    this.stageLayerConfigs.forEach((layerConfig, index) => {
      if (this.textures.exists(layerConfig.texture)) return;
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      const color = index === 0 ? 0x16203c : this.stage.floorColor;
      graphics.fillGradientStyle(color, color, this.stage.accentColor, this.stage.accentColor, 1, 1, 0.65, 0.65);
      graphics.fillRect(0, 0, 1400, 620);
      graphics.lineStyle(6, this.stage.accentColor, 0.5);
      for (let x = 0; x <= 1400; x += 140) graphics.lineBetween(x, 420, x + 70, 620);
      graphics.generateTexture(layerConfig.texture, 1400, 620);
      graphics.destroy();
    });
  }

  drawArena() {
    this.add.rectangle(640, 360, ARENA_WIDTH, ARENA_HEIGHT, 0x10172a, 1).setDepth(-40);
    this.ensureStageLayerTextures();
    this.parallaxLayers = this.stageLayerConfigs.map(layerConfig => {
      const layerImage = this.add.image(640, 0, layerConfig.texture)
        .setOrigin(0.5, 1)
        .setDepth(layerConfig.depth)
        .setAlpha(layerConfig.alpha);
      const targetWidth = ARENA_WIDTH + layerConfig.overscan * 2;
      const proportionalScale = targetWidth / Math.max(1, layerImage.width);
      layerImage.setScale(proportionalScale);
      layerImage.y = (layerConfig.align === 'arenaBottom' ? ARENA_HEIGHT : this.groundTop) + layerConfig.offsetY;
      if (layerConfig.tint !== null) layerImage.setTint(layerConfig.tint);
      return { object: layerImage, baseX: 640, factor: layerConfig.parallax, slot: layerConfig.slot };
    });
    this.stageBackdrop = this.parallaxLayers.find(layer => layer.slot === 'bgFar')?.object
      || this.parallaxLayers[0]?.object;

    this.createArenaAmbience();

    const floor = this.add.graphics().setDepth(-5);
    floor.fillStyle(this.stage.floorColor, 1);
    floor.fillRect(0, this.groundTop, ARENA_WIDTH, ARENA_HEIGHT - this.groundTop);
    floor.lineStyle(5, this.stage.accentColor, 0.92);
    floor.lineBetween(0, this.groundTop, ARENA_WIDTH, this.groundTop);
    floor.lineStyle(2, this.stage.accentColor, 0.24);
    for (let x = 0; x <= ARENA_WIDTH; x += 80) floor.lineBetween(x, this.groundTop, x, ARENA_HEIGHT);
    for (let y = this.groundTop + 28; y <= ARENA_HEIGHT; y += 28) floor.lineBetween(0, y, ARENA_WIDTH, y);

    this.add.text(640, this.groundTop - 28, this.stage.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '22px',
      fontStyle: 'bold italic',
      color: '#ffffff',
      stroke: '#090d17',
      strokeThickness: 6,
      letterSpacing: 3
    }).setOrigin(0.5).setDepth(2);
  }

  updateParallax() {
    if (!this.parallaxLayers?.length || !this.player1?.sprite || !this.player2?.sprite) return;
    const fightersCenter = (this.player1.sprite.x + this.player2.sprite.x) / 2;
    const cameraCenter = this.cameras.main.worldView.centerX;
    const trackingCenter = Phaser.Math.Linear(fightersCenter, cameraCenter, 0.25);
    const normalizedPosition = Phaser.Math.Clamp((trackingCenter - ARENA_WIDTH / 2) / 520, -1, 1);
    const offset = -normalizedPosition * this.stage.parallaxStrength;
    this.parallaxLayers.forEach(layer => {
      layer.object.x = Phaser.Math.Linear(layer.object.x, layer.baseX + offset * layer.factor, 0.08);
    });
  }

  createArenaAmbience() {
    const settings = this.stage.ambience || {};
    this.ambientLayer = this.add.container(640, 0).setDepth(-14);
    const lights = Math.max(4, settings.lights || 6);
    for (let index = 0; index < lights; index += 1) {
      const x = -520 + index * (1040 / Math.max(1, lights - 1));
      const y = this.groundTop - 150 - (index % 3) * 24;
      const light = this.add.circle(x, y, 7 + (index % 2) * 3, this.stage.accentColor, 0.2);
      const silhouette = this.add.rectangle(x, this.groundTop - 48, 24, 82, 0x090d18, 0.72)
        .setOrigin(0.5, 1);
      this.ambientLayer.add([silhouette, light]);
      this.tweens.add({
        targets: light,
        alpha: { from: 0.12, to: 0.85 },
        scale: { from: 0.8, to: 1.45 },
        duration: 420 + (index % 4) * 170,
        delay: index * 95,
        yoyo: true,
        repeat: -1
      });
      this.tweens.add({
        targets: silhouette,
        angle: { from: -2, to: 2 },
        duration: 900 + (index % 3) * 240,
        yoyo: true,
        repeat: -1
      });
    }
    this.parallaxLayers.push({ object: this.ambientLayer, baseX: 640, factor: 0.7, slot: 'ambience' });

    if (settings.type === 'transit') this.createTransitLoop(settings.transitInterval || 9000);
  }

  createTransitLoop(interval) {
    this.time.delayedCall(2600, () => this.runTransitPass());
    this.transitLoopEvent = this.time.addEvent({
      delay: Math.max(5500, interval),
      loop: true,
      callback: () => this.runTransitPass()
    });
  }

  runTransitPass() {
    if (!this.sys.isActive() || this.transitVehicle?.active) return;
    const train = this.add.container(-420, this.groundTop - 115).setDepth(-12);
    const glow = this.add.rectangle(0, 0, 520, 142, 0xff334f, 0.15);
    const body = this.add.rectangle(0, 0, 500, 116, 0xc91f38, 1)
      .setStrokeStyle(6, 0x821126, 1);
    const windows = [];
    for (let x = -205; x <= 205; x += 82) {
      windows.push(this.add.rectangle(x, -15, 58, 42, 0xa9e6ef, 0.9));
    }
    const wheels = [
      this.add.circle(-165, 59, 20, 0x121722, 1),
      this.add.circle(165, 59, 20, 0x121722, 1)
    ];
    const streaks = [0, 1, 2].map(index => this.add.rectangle(-330 - index * 90, -35 + index * 35, 150, 5, 0xffd6dd, 0.45));
    train.add([glow, body, ...windows, ...wheels, ...streaks]);
    this.transitVehicle = train;

    const platformFlash = this.add.rectangle(640, this.groundTop - 70, ARENA_WIDTH, 150, 0xff4761, 0)
      .setDepth(-11);
    this.tweens.add({ targets: platformFlash, alpha: 0.18, duration: 120, yoyo: true, repeat: 2, onComplete: () => platformFlash.destroy() });
    this.time.delayedCall(220, () => this.cameras.main.shake(240, 0.0028));
    this.tweens.add({
      targets: train,
      x: ARENA_WIDTH + 430,
      duration: 1150,
      ease: 'Linear',
      onComplete: () => {
        train.destroy(true);
        this.transitVehicle = null;
      }
    });
  }

  createDebugOverlay() {
    this.debugEnabled = false;
    this.activeHitboxes = [];
    this.debugGraphics = this.add.graphics().setDepth(80).setVisible(false);
    this.debugLabel = this.add.text(1260, 174, 'F3 DEBUG · AZUL HURTBOX · ROJO HITBOX · VERDE LÍMITES', {
      fontFamily: 'Consolas, monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#7dff9c', backgroundColor: '#06110bcc', padding: { x: 9, y: 5 }
    }).setOrigin(1, 0).setDepth(81).setVisible(false).setScrollFactor(0);
  }

  updateDebugControls() {
    if (!this.controls?.debug || !Phaser.Input.Keyboard.JustDown(this.controls.debug)) return;
    this.debugEnabled = !this.debugEnabled;
    this.debugGraphics.setVisible(this.debugEnabled);
    this.debugLabel.setVisible(this.debugEnabled);
    if (!this.debugEnabled) this.debugGraphics.clear();
  }

  updateDebugOverlay() {
    if (!this.activeHitboxes) return;
    this.activeHitboxes = this.activeHitboxes.filter(hitbox => hitbox.expiresAt > this.time.now);
    if (!this.debugEnabled) return;

    const graphics = this.debugGraphics;
    graphics.clear();
    graphics.lineStyle(2, 0x43ff78, 0.45);
    graphics.strokeRect(1, 1, ARENA_WIDTH - 2, ARENA_HEIGHT - 2);
    graphics.lineStyle(3, 0x43ff78, 0.95);
    graphics.strokeRect(this.stage.floor.x, 0, this.stage.floor.width, ARENA_HEIGHT);
    graphics.lineBetween(
      this.stage.floor.x,
      this.stage.floor.y,
      this.stage.floor.x + this.stage.floor.width,
      this.stage.floor.y
    );

    [this.player1, this.player2].forEach(combatant => {
      const body = combatant?.sprite?.body;
      if (!body?.enable) return;
      graphics.fillStyle(0x2488ff, 0.22);
      graphics.fillRect(body.x, body.y, body.width, body.height);
      graphics.lineStyle(2, 0x62b4ff, 1);
      graphics.strokeRect(body.x, body.y, body.width, body.height);
    });

    this.activeHitboxes.forEach(({ rect }) => {
      graphics.fillStyle(0xff294d, 0.32);
      graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      graphics.lineStyle(3, 0xff5571, 1);
      graphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
    });
  }

  createGround() {
    if (!this.textures.exists('battle_ground_pixel')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 8);
      g.generateTexture('battle_ground_pixel', 8, 8);
      g.destroy();
    }

    this.ground = this.physics.add.staticGroup();
    this.ground.create(
      this.stage.floor.x + this.stage.floor.width / 2,
      this.stage.floor.y + this.stage.floor.height / 2,
      'battle_ground_pixel'
    )
      .setDisplaySize(this.stage.floor.width, this.stage.floor.height)
      .setVisible(false)
      .refreshBody();
  }

  spawnFighter(character, x, flipX, side) {
    const idleTexture = character.animations?.idle?.texture || character.combatTexture;
    const textureKey = idleTexture && this.textures.exists(idleTexture)
      ? idleTexture
      : this.textures.exists(character.headSprite) ? character.headSprite : character.portrait;
    const sprite = this.physics.add.sprite(x, 330, textureKey);
    this.scaleToFit(sprite, 190, 250);
    sprite.setFlipX(flipX);
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0);
    sprite.setDepth(10);
    sprite.body.setAllowGravity(true);
    sprite.body.setMaxVelocity(MOVE_SPEED, 950);
    sprite.body.setSize(sprite.width * 0.68, sprite.height * 0.9, true);

    const namePlate = this.add.text(x, 0, character.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#080d18',
      padding: { x: 10, y: 4 },
      stroke: '#05070d',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(12);
    const guardShield = this.add.ellipse(
      x,
      sprite.y,
      sprite.displayWidth + 34,
      sprite.displayHeight + 24,
      0x4da3ff,
      0.12
    ).setStrokeStyle(5, 0x78c6ff, 0.92).setVisible(false).setDepth(11);

    const animationManager = new AnimationManager(this, character).attach(sprite);
    const combatant = {
      side,
      character,
      sprite,
      namePlate,
      guardShield,
      health: 100,
      super: 0,
      comboCount: 0,
      lastComboHitAt: Number.NEGATIVE_INFINITY,
      comboText: null,
      isGuarding: false,
      frozenUntil: 0,
      nextAttackAt: 0,
      animationManager,
      playAnimation: (state, options = {}) => animationManager.playAnimation(state, options)
    };
    combatant.playAnimation('idle');
    return combatant;
  }

  createHud() {
    this.add.rectangle(640, 61, 1280, 122, 0x050914, 0.94).setDepth(30);
    this.hudGraphics = this.add.graphics().setDepth(32);

    this.createHudPortrait(this.player1, 66, 62, false);
    this.createHudPortrait(this.player2, 1214, 62, true);

    this.p1NameText = this.add.text(118, 20, this.player1.character.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '19px', fontStyle: 'bold', color: '#ffffff'
    }).setDepth(33);
    const player2Label = `${this.player2.character.name.toUpperCase()}${this.isCpuMode ? ' · CPU' : ''}`;
    this.p2NameText = this.add.text(1162, 20, player2Label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '19px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(1, 0).setDepth(33);
    this.p1SuperText = this.add.text(118, 106, 'SÚPER 0%', {
      fontFamily: 'Consolas, monospace', fontSize: '10px', fontStyle: 'bold', color: '#c79cff'
    }).setDepth(33);
    this.p2SuperText = this.add.text(1162, 106, 'SÚPER 0%', {
      fontFamily: 'Consolas, monospace', fontSize: '10px', fontStyle: 'bold', color: '#c79cff'
    }).setOrigin(1, 0).setDepth(33);

    this.timerText = this.add.text(640, 55, '99', {
      fontFamily: 'Consolas, monospace', fontSize: '52px', fontStyle: 'bold', color: '#ffd84d',
      stroke: '#080b12', strokeThickness: 7
    }).setOrigin(0.5).setDepth(34);
    this.add.text(640, 93, 'ROUND 1', {
      fontFamily: 'Consolas, monospace', fontSize: '10px', fontStyle: 'bold', color: '#9eb0c9', letterSpacing: 3
    }).setOrigin(0.5).setDepth(34);
    this.add.text(640, 113, this.isOnline ? `ONLINE · ${this.isHost ? 'HOST P1' : 'GUEST P2'}` : this.isCpuMode ? 'VS CPU' : '2 JUGADORES', {
      fontFamily: 'Consolas, monospace', fontSize: '9px', fontStyle: 'bold',
      color: this.isOnline ? '#5eff9d' : this.isCpuMode ? '#ff8294' : '#69bfff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(34);

    this.combatLog = this.add.text(640, 142, '¡COMBATE!', {
      fontFamily: 'Consolas, monospace', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#080d18cc', padding: { x: 13, y: 6 }
    }).setOrigin(0.5).setDepth(35);

    this.add.text(20, 694, 'P1  A/D · W SALTO · S GUARDIA · J/K/L ATAQUES', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#78bfff'
    }).setOrigin(0, 1).setDepth(30);
    this.add.text(1260, 694, 'P2  ←/→ · ↑ SALTO · ↓ GUARDIA · NUM 1/2/3 O I/O/P', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#ff8294'
    }).setOrigin(1, 1).setDepth(30);
    this.audioStatusText = this.add.text(640, 694, 'M: SILENCIAR · +/-: VOLUMEN', {
      fontFamily: 'Consolas, monospace', fontSize: '10px', fontStyle: 'bold', color: '#b8c7df'
    }).setOrigin(0.5, 1).setDepth(30);

    this.updateHud();
  }

  createHudPortrait(combatant, x, y, flipX) {
    this.add.circle(x, y, 46, 0x111a2b, 1)
      .setStrokeStyle(4, combatant.character.color || 0x60708c, 1)
      .setDepth(31);
    const iconTexture = this.textures.exists(combatant.character.headSprite)
      ? combatant.character.headSprite
      : combatant.character.portrait;
    const icon = this.add.image(x, y, iconTexture).setFlipX(flipX).setDepth(32);
    this.scaleToFit(icon, 78, 78);
  }

  updateHud() {
    const p1Width = 420 * Phaser.Math.Clamp(this.player1.health, 0, 100) / 100;
    const p2Width = 420 * Phaser.Math.Clamp(this.player2.health, 0, 100) / 100;
    const p1SuperWidth = 420 * Phaser.Math.Clamp(this.player1.super, 0, 100) / 100;
    const p2SuperWidth = 420 * Phaser.Math.Clamp(this.player2.super, 0, 100) / 100;
    this.hudGraphics.clear();

    this.hudGraphics.fillStyle(0x151c2a, 1);
    this.hudGraphics.fillRoundedRect(118, 52, 420, 30, 8);
    this.hudGraphics.fillRoundedRect(742, 52, 420, 30, 8);
    this.hudGraphics.fillRoundedRect(118, 89, 420, 13, 5);
    this.hudGraphics.fillRoundedRect(742, 89, 420, 13, 5);
    this.hudGraphics.lineStyle(3, 0xffffff, 0.22);
    this.hudGraphics.strokeRoundedRect(118, 52, 420, 30, 8);
    this.hudGraphics.strokeRoundedRect(742, 52, 420, 30, 8);

    if (p1Width > 0) {
      this.hudGraphics.fillStyle(this.healthColor(this.player1.health), 1);
      this.hudGraphics.fillRoundedRect(118, 52, p1Width, 30, 8);
    }
    if (p2Width > 0) {
      this.hudGraphics.fillStyle(this.healthColor(this.player2.health), 1);
      this.hudGraphics.fillRoundedRect(1162 - p2Width, 52, p2Width, 30, 8);
    }
    if (p1SuperWidth > 0) {
      this.hudGraphics.fillStyle(this.player1.super >= 100 ? 0xffd23f : 0xa66cff, 1);
      this.hudGraphics.fillRoundedRect(118, 89, p1SuperWidth, 13, 5);
    }
    if (p2SuperWidth > 0) {
      this.hudGraphics.fillStyle(this.player2.super >= 100 ? 0xffd23f : 0xa66cff, 1);
      this.hudGraphics.fillRoundedRect(1162 - p2SuperWidth, 89, p2SuperWidth, 13, 5);
    }
    this.p1SuperText.setText(`SÚPER ${Math.round(this.player1.super)}%`)
      .setColor(this.player1.super >= 100 ? '#ffd23f' : '#c79cff');
    this.p2SuperText.setText(`SÚPER ${Math.round(this.player2.super)}%`)
      .setColor(this.player2.super >= 100 ? '#ffd23f' : '#c79cff');
  }

  healthColor(health) {
    if (health > 55) return 0x36d276;
    if (health > 25) return 0xffd23f;
    return 0xeb3b5a;
  }

  playRoundIntro() {
    // Esta escena puede reanudarse o recibir varias señales de inicio. La guarda
    // evita crear timers/tweens duplicados para una misma ronda.
    if (this.roundIntroStarted) return;
    this.roundIntroStarted = true;

    const roundText = this.add.text(640, 335, 'ROUND 1', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '78px', fontStyle: 'bold italic',
      color: '#ffffff', stroke: '#141022', strokeThickness: 11
    }).setOrigin(0.5).setScale(0.2).setAlpha(0).setDepth(45);

    this.tweens.add({
      targets: roundText,
      scale: 1.15,
      alpha: 1,
      duration: 320,
      ease: 'Back.easeOut'
    });
    this.time.delayedCall(560, () => {
      this.tweens.add({
        targets: roundText,
        scale: 1.5,
        alpha: 0,
        duration: 300,
        onComplete: () => roundText.destroy()
      });
    });

    this.time.delayedCall(900, () => {
      const fightText = this.add.text(640, 335, 'FIGHT!', {
        fontFamily: 'Trebuchet MS, Arial', fontSize: '104px', fontStyle: 'bold italic',
        color: '#ffd23f', stroke: '#eb315b', strokeThickness: 12
      }).setOrigin(0.5).setScale(0.15).setAlpha(0).setDepth(45);
      this.playCountdownAudioOnce();
      this.tweens.add({
        targets: fightText,
        scale: 1.2,
        alpha: 1,
        duration: 300,
        ease: 'Back.easeOut'
      });
      this.time.delayedCall(500, () => {
        this.tweens.add({
          targets: fightText,
          scale: 1.75,
          alpha: 0,
          duration: 520,
          onComplete: () => fightText.destroy()
        });
      });
    });

    this.time.delayedCall(2000, () => {
      if (!this.roundActive) return;
      this.controlsLocked = false;
      this.roundStartedAt = this.time.now;
      this.combatLog.setText('¡PELEEN!');
      if (!this.isOnline || this.isHost) this.startRoundTimer();
    });
  }

  playCountdownAudioOnce() {
    if (this.countdownAudioPlayed || !this.roundActive) return false;
    this.countdownAudioPlayed = true;
    this.audioManager?.announce('fight');
    return true;
  }

  updateAudioControls() {
    if (!this.controls?.audio || !this.audioManager) return;
    const audio = this.controls.audio;
    if (Phaser.Input.Keyboard.JustDown(audio.mute)) {
      this.audioManager.toggleMute();
      this.refreshAudioStatus();
    }
    if (Phaser.Input.Keyboard.JustDown(audio.volumeUp)
      || Phaser.Input.Keyboard.JustDown(audio.volumeUpNumpad)) {
      this.audioManager.changeMasterVolume(0.1);
      this.refreshAudioStatus();
    }
    if (Phaser.Input.Keyboard.JustDown(audio.volumeDown)
      || Phaser.Input.Keyboard.JustDown(audio.volumeDownNumpad)) {
      this.audioManager.changeMasterVolume(-0.1);
      this.refreshAudioStatus();
    }
  }

  refreshAudioStatus() {
    this.audioStatusText.setText(`${this.audioManager.getStatusText()} · M MUTE · +/- VOLUMEN · F3 DEBUG`);
  }

  setupControls() {
    const keyCodes = Phaser.Input.Keyboard.KeyCodes;
    const addKey = code => this.input.keyboard.addKey(code);
    this.controls = {
      p1: {
        left: addKey(keyCodes.A),
        right: addKey(keyCodes.D),
        jump: addKey(keyCodes.W),
        guard: addKey(keyCodes.S),
        basic: addKey(keyCodes.J),
        special: addKey(keyCodes.K),
        ulti: addKey(keyCodes.L)
      },
      p2: {
        left: addKey(keyCodes.LEFT),
        right: addKey(keyCodes.RIGHT),
        jump: addKey(keyCodes.UP),
        guard: addKey(keyCodes.DOWN),
        basic: addKey(keyCodes.I),
        special: addKey(keyCodes.O),
        ulti: addKey(keyCodes.P),
        basicNumpad: addKey(keyCodes.NUMPAD_ONE ?? 97),
        specialNumpad: addKey(keyCodes.NUMPAD_TWO ?? 98),
        ultiNumpad: addKey(keyCodes.NUMPAD_THREE ?? 99)
      },
      audio: {
        mute: addKey(keyCodes.M),
        volumeUp: addKey(keyCodes.PLUS ?? 187),
        volumeDown: addKey(keyCodes.MINUS ?? 189),
        volumeUpNumpad: addKey(keyCodes.NUMPAD_ADD ?? 107),
        volumeDownNumpad: addKey(keyCodes.NUMPAD_SUBTRACT ?? 109)
      },
      debug: addKey(keyCodes.F3)
    };
  }

  updateMovement(combatant, controls, padState) {
    if (this.time.now < combatant.frozenUntil) {
      this.setGuardState(combatant, false);
      combatant.sprite.setVelocity(0, 0);
      this.syncNamePlate(combatant);
      return;
    }
    const guarding = controls.guard.isDown || padState.guard;
    this.setGuardState(combatant, guarding);
    if (guarding) {
      combatant.sprite.setVelocityX(0);
      this.syncNamePlate(combatant);
      return;
    }
    const keyboardDirection = (controls.left.isDown ? -1 : 0) + (controls.right.isDown ? 1 : 0);
    const direction = keyboardDirection || padState.horizontal;
    combatant.sprite.setVelocityX(direction * MOVE_SPEED);

    const canJump = combatant.sprite.body.blocked.down || combatant.sprite.body.touching.down;
    const keyboardJump = Phaser.Input.Keyboard.JustDown(controls.jump);
    if (canJump && (keyboardJump || padState.jump)) {
      combatant.sprite.setVelocityY(-JUMP_SPEED);
    }

    this.syncNamePlate(combatant);
  }

  syncNamePlate(combatant) {
    combatant.namePlate.setPosition(
      combatant.sprite.x,
      combatant.sprite.y - combatant.sprite.displayHeight / 2 - 24
    );
    combatant.guardShield.setPosition(combatant.sprite.x, combatant.sprite.y);
    this.updateFighterAnimation(combatant);
  }

  updateFighterAnimation(combatant) {
    const body = combatant?.sprite?.body;
    if (!body?.enable) return;
    if (combatant.health <= 0) {
      combatant.playAnimation('ko');
      return;
    }
    if (combatant.isGuarding) {
      combatant.playAnimation('guard');
      return;
    }
    const grounded = body.blocked.down || body.touching.down;
    if (!grounded) {
      combatant.playAnimation('jump');
    } else if (Math.abs(body.velocity.x) > 12
      && (!combatant.character.walkForwardOnly || this.isMovingTowardOpponent(combatant))) {
      combatant.playAnimation('walk');
    } else {
      combatant.playAnimation('idle');
    }
  }

  isMovingTowardOpponent(combatant) {
    const opponent = combatant === this.player1 ? this.player2
      : combatant === this.player2 ? this.player1 : null;
    if (!opponent?.sprite || !combatant?.sprite?.body) return false;
    const directionToOpponent = Math.sign(opponent.sprite.x - combatant.sprite.x);
    const movementDirection = Math.sign(combatant.sprite.body.velocity.x);
    return directionToOpponent !== 0 && movementDirection === directionToOpponent;
  }

  setGuardState(combatant, guarding) {
    const nextState = Boolean(guarding && this.roundActive && !this.controlsLocked
      && this.time.now >= combatant.frozenUntil);
    if (combatant.isGuarding === nextState) return;
    combatant.isGuarding = nextState;
    combatant.guardShield.setVisible(nextState).setScale(1).setAlpha(nextState ? 0.9 : 0);
    if (nextState) combatant.playAnimation('guard', { force: true });
    else this.updateFighterAnimation(combatant);
  }

  updateFacingDirections() {
    this.player1.sprite.setFlipX(this.player2.sprite.x < this.player1.sprite.x);
    this.player2.sprite.setFlipX(this.player1.sprite.x < this.player2.sprite.x);
  }

  updateCpuController() {
    const cpu = this.player2;
    const target = this.player1;
    const now = this.time.now;

    if (now < cpu.frozenUntil) {
      this.setGuardState(cpu, false);
      cpu.sprite.setVelocity(0, 0);
      this.syncNamePlate(cpu);
      return;
    }
    if (now < this.cpuState.guardUntil) {
      this.setGuardState(cpu, true);
      cpu.sprite.setVelocityX(0);
      this.syncNamePlate(cpu);
      return;
    }

    this.setGuardState(cpu, false);
    const directionToTarget = Math.sign(target.sprite.x - cpu.sprite.x) || -1;
    if (now < this.cpuState.retreatUntil) {
      cpu.sprite.setVelocityX(-directionToTarget * MOVE_SPEED * 0.78);
      this.syncNamePlate(cpu);
      return;
    }

    const distance = Math.abs(target.sprite.x - cpu.sprite.x);
    if (distance > 215) {
      cpu.sprite.setVelocityX(directionToTarget * MOVE_SPEED * 0.74);
    } else {
      cpu.sprite.setVelocityX(0);
      if (now >= this.cpuState.nextDecisionAt) {
        this.cpuState.nextDecisionAt = now + Phaser.Math.Between(480, 820);
        const choice = Math.random();
        if (cpu.super >= 100 && choice < 0.42) {
          this.performUltimateAttack(cpu, target);
        } else if (cpu.super >= 30 && choice < 0.72) {
          this.performSpecialAttack(cpu, target);
        } else {
          this.performBasicAttack(cpu, target);
        }
      }
    }
    this.syncNamePlate(cpu);
  }

  reactCpuToIncomingAttack(attacker, target) {
    if (!this.isCpuMode || target !== this.player2 || attacker !== this.player1
      || this.time.now < target.frozenUntil || Math.random() >= CPU_REACTION_CHANCE) return;

    if (Math.random() < 0.62) {
      this.cpuState.guardUntil = this.time.now + Phaser.Math.Between(260, 430);
      this.setGuardState(target, true);
      target.sprite.setVelocityX(0);
    } else {
      this.cpuState.retreatUntil = this.time.now + Phaser.Math.Between(320, 520);
      const awayDirection = Math.sign(target.sprite.x - attacker.sprite.x) || 1;
      target.sprite.setVelocityX(awayDirection * MOVE_SPEED * 0.9);
    }
  }

  updateKeyboardAttacks() {
    if (Phaser.Input.Keyboard.JustDown(this.controls.p1.basic)) {
      this.performBasicAttack(this.player1, this.player2);
    }
    if (Phaser.Input.Keyboard.JustDown(this.controls.p1.special)) {
      this.performSpecialAttack(this.player1, this.player2);
    }
    if (Phaser.Input.Keyboard.JustDown(this.controls.p1.ulti)) {
      this.performUltimateAttack(this.player1, this.player2);
    }

    if (!this.isCpuMode && (Phaser.Input.Keyboard.JustDown(this.controls.p2.basic)
      || Phaser.Input.Keyboard.JustDown(this.controls.p2.basicNumpad))) {
      this.performBasicAttack(this.player2, this.player1);
    }
    if (!this.isCpuMode && (Phaser.Input.Keyboard.JustDown(this.controls.p2.special)
      || Phaser.Input.Keyboard.JustDown(this.controls.p2.specialNumpad))) {
      this.performSpecialAttack(this.player2, this.player1);
    }
    if (!this.isCpuMode && (Phaser.Input.Keyboard.JustDown(this.controls.p2.ulti)
      || Phaser.Input.Keyboard.JustDown(this.controls.p2.ultiNumpad))) {
      this.performUltimateAttack(this.player2, this.player1);
    }
  }

  updateGamepadAttacks(attacker, target, padState) {
    if (padState.basic) {
      this.performBasicAttack(attacker, target);
    }
    if (padState.special) {
      this.performSpecialAttack(attacker, target);
    }
    if (padState.ulti) {
      this.performUltimateAttack(attacker, target);
    }
  }

  readGamepadState(pad, slot) {
    if (!pad) return { horizontal: 0, jump: false, guard: false, basic: false, special: false, ulti: false };
    const previous = this.gamepadButtonState[slot] || {};
    const pressed = index => Boolean(pad.buttons?.[index]?.pressed);
    const current = {
      basic: pressed(0),
      special: pressed(1),
      ulti: pressed(2),
      jump: pressed(3) || pressed(12),
      guard: pressed(4),
      left: pressed(14),
      right: pressed(15)
    };
    const axis = pad.axes?.[0]?.getValue?.() || 0;
    const horizontal = current.left ? -1 : current.right ? 1 : Math.abs(axis) >= 0.28 ? Math.sign(axis) : 0;
    const state = {
      horizontal,
      jump: current.jump && !previous.jump,
      guard: current.guard,
      basic: current.basic && !previous.basic,
      special: current.special && !previous.special,
      ulti: current.ulti && !previous.ulti
    };
    this.gamepadButtonState[slot] = current;
    return state;
  }

  performBasicAttack(attacker, target) {
    return this.performAttack(attacker, target, {
      name: 'Golpe básico',
      damage: 10,
      range: 185,
      knockback: 225,
      cooldown: 360,
      type: 'basic',
      animationState: 'attack_light',
      superOnHit: 18
    });
  }

  performSpecialAttack(attacker, target) {
    const special = attacker.character.special;
    if (!special) {
      return this.performAttack(attacker, target, {
        name: 'Patada fuerte',
        damage: 13,
        range: 205,
        knockback: 330,
        cooldown: 540,
        type: 'special',
        animationState: 'attack_heavy'
      });
    }
    if (attacker.super < 30) {
      this.combatLog.setText(`${attacker.character.name} necesita 30% de Súper para ${special.name}.`);
      return false;
    }

    const activated = this.performAttack(attacker, target, {
      ...special,
      type: 'special',
      animationState: special.animationState || 'special'
    });
    if (activated) {
      attacker.super = Phaser.Math.Clamp(attacker.super - 30, 0, 100);
      this.updateHud();
    }
    return activated;
  }

  performUltimateAttack(attacker, target) {
    const ultimate = attacker.character.ultimate;
    if (!ultimate) {
      this.combatLog.setText(`${attacker.character.name} no tiene una Ulti configurada.`);
      return false;
    }
    if (attacker.super < 100) {
      this.combatLog.setText(`${attacker.character.name} necesita 100% de Súper para ${ultimate.name}.`);
      return false;
    }

    const activated = this.performAttack(attacker, target, {
      ...ultimate,
      type: 'ultimate',
      animationState: ultimate.animationState || 'special'
    });
    if (activated) {
      attacker.super = 0;
      this.updateHud();
    }
    return activated;
  }

  performAttack(attacker, target, attack) {
    if (!this.roundActive || attacker.isGuarding || this.time.now < attacker.nextAttackAt
      || this.time.now < attacker.frozenUntil) {
      return false;
    }
    attacker.nextAttackAt = this.time.now + attack.cooldown;
    attacker.playAnimation(attack.animationState || 'attack_light', {
      force: true,
      lockMs: Math.max(180, attack.cooldown * 0.78)
    });
    if (attack.type === 'ultimate') this.audioManager.playSfx('ultimate');
    this.reactCpuToIncomingAttack(attacker, target);

    const direction = attacker.sprite.flipX ? -1 : 1;
    const targetBody = target.sprite.body;
    const hitboxWidth = Math.max(40, attack.range - targetBody.halfWidth);
    const hitboxHeight = Math.max(60, 300 - targetBody.height);
    const attackHitbox = new Phaser.Geom.Rectangle(
      direction > 0 ? attacker.sprite.x : attacker.sprite.x - hitboxWidth,
      attacker.sprite.y - hitboxHeight / 2,
      hitboxWidth,
      hitboxHeight
    );
    this.activeHitboxes.push({
      rect: attackHitbox,
      attacker,
      type: attack.type,
      expiresAt: this.time.now + 150
    });
    const targetHurtbox = new Phaser.Geom.Rectangle(targetBody.x, targetBody.y, targetBody.width, targetBody.height);
    const targetIsInFront = (target.sprite.x - attacker.sprite.x) * direction >= 0;
    const hit = targetIsInFront && Phaser.Geom.Intersects.RectangleToRectangle(attackHitbox, targetHurtbox);
    const blocked = hit && target.isGuarding;
    if (this.isOnline && this.isHost) {
      NetworkManager.sendAttack({
        attackerSide: attacker.side,
        attackType: attack.type,
        attackName: attack.name,
        animationState: attack.animationState,
        hit
      });
    }

    const effectX = attacker.sprite.x + direction * Math.min(attack.range * 0.55, 110);
    const effect = this.add.rectangle(effectX, attacker.sprite.y, attack.range * 0.7, 72,
      hit ? 0xffd23f : 0x6e86ab, 0.28).setDepth(20);
    this.tweens.add({
      targets: effect,
      scaleX: 1.3,
      alpha: 0,
      duration: 170,
      onComplete: () => effect.destroy()
    });

    attacker.sprite.setVelocityX(direction * 135);
    if (!hit) {
      this.combatLog.setText(`${attacker.character.name}: ${attack.name} fuera de rango.`);
      return true;
    }

    const appliedDamage = blocked ? Number((attack.damage * 0.25).toFixed(2)) : attack.damage;
    target.health = Phaser.Math.Clamp(target.health - appliedDamage, 0, 100);
    const targetAnimation = target.health <= 0 ? 'ko' : blocked ? 'guard' : 'hurt';
    target.playAnimation(targetAnimation, {
      force: true,
      lockMs: target.health <= 0 ? Number.MAX_SAFE_INTEGER : 220
    });
    this.registerComboHit(attacker, target);
    attacker.super = Phaser.Math.Clamp(attacker.super + (attack.superOnHit || 0), 0, 100);
    target.super = Phaser.Math.Clamp(target.super + 12, 0, 100);
    if (this.isOnline && this.isHost) {
      NetworkManager.sendHit({
        attackerSide: attacker.side,
        targetSide: target.side,
        damage: appliedDamage,
        health: target.health,
        blocked
      });
    }

    const knockback = attack.knockback || 225;
    if (attack.freezeMs) {
      this.freezeCombatant(target, attack.freezeMs, blocked ? 0 : direction * knockback, blocked ? 0 : -125);
      this.cameras.main.flash(170, 175, 110, 255, false);
    } else if (!blocked) {
      target.sprite.setVelocity(direction * knockback, -105);
    } else {
      target.sprite.setVelocityX(0);
    }
    this.flashDamage(target, Boolean(attack.freezeMs));
    this.showFloatingDamage(target, appliedDamage, blocked);
    if (blocked) this.showBlockEffect(target);
    if (attack.type !== 'ultimate') this.audioManager.playSfx(attack.type || 'basic');

    const shake = attack.type === 'ultimate'
      ? { duration: 270, intensity: 0.014 }
      : attack.type === 'special'
        ? { duration: 135, intensity: 0.006 }
        : { duration: 70, intensity: 0.0025 };
    this.cameras.main.shake(shake.duration, shake.intensity);
    if (attack.type === 'special' || attack.type === 'ultimate') this.applyHitstop(50);

    this.combatLog.setText(blocked
      ? `${target.character.name} bloquea: solo recibe -${appliedDamage}%.`
      : `${attacker.character.name} conecta ${attack.name}: -${appliedDamage}%`);
    this.updateHud();

    if (target.health <= 0) this.startSlowMotionKo(attacker);
    return true;
  }

  registerComboHit(attacker, target) {
    target.comboCount = 0;
    target.lastComboHitAt = Number.NEGATIVE_INFINITY;

    const elapsedSincePreviousHit = this.time.now - attacker.lastComboHitAt;
    attacker.comboCount = elapsedSincePreviousHit <= 1200 ? attacker.comboCount + 1 : 1;
    attacker.lastComboHitAt = this.time.now;
    if (attacker.comboCount >= 2) this.showComboCounter(attacker);
  }

  showComboCounter(attacker) {
    if (attacker.comboText?.active) {
      this.tweens.killTweensOf(attacker.comboText);
      attacker.comboText.destroy();
    }
    const isBigCombo = attacker.comboCount >= 4;
    const horizontalOffset = attacker.sprite.x < ARENA_WIDTH / 2 ? 155 : -155;
    const label = `${attacker.comboCount} HITS!${isBigCombo ? '\nCOMBO!' : ''}`;
    attacker.comboText = this.add.text(
      Phaser.Math.Clamp(attacker.sprite.x + horizontalOffset, 120, ARENA_WIDTH - 120),
      Math.max(205, attacker.sprite.y - attacker.sprite.displayHeight / 2),
      label,
      {
        fontFamily: 'Trebuchet MS, Arial', fontSize: isBigCombo ? '38px' : '31px',
        fontStyle: 'bold italic', color: isBigCombo ? '#ff5f78' : '#ffd23f', align: 'center',
        stroke: '#080b12', strokeThickness: 8,
        shadow: { color: isBigCombo ? '#ff315f' : '#ffb52e', blur: 16, fill: true }
      }
    ).setOrigin(0.5).setScale(0.35).setDepth(46);

    this.tweens.add({
      targets: attacker.comboText,
      scale: 1.12,
      duration: 170,
      ease: 'Back.easeOut',
      onComplete: () => {
        const comboText = attacker.comboText;
        if (!comboText?.active) return;
        this.tweens.add({
          targets: comboText,
          y: comboText.y - 42,
          alpha: 0,
          scale: 0.92,
          delay: 260,
          duration: 420,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            if (attacker.comboText === comboText) attacker.comboText = null;
            comboText.destroy();
          }
        });
      }
    });
  }

  startSlowMotionKo(winner) {
    if (this.koSequenceActive) return;
    this.koSequenceActive = true;
    this.controlsLocked = true;
    this.roundFinishedAt = this.time.now;
    this.roundTimerEvent?.remove(false);
    this.roundTimerEvent = null;
    this.player1.sprite.setVelocity(0, 0);
    this.player2.sprite.setVelocity(0, 0);
    this.physics.world.pause();
    this.time.timeScale = 0.2;

    const finishText = this.add.text(640, 205, '¡REMATE FINAL!', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '42px', fontStyle: 'bold italic',
      color: '#ffffff', stroke: '#ff315f', strokeThickness: 9
    }).setOrigin(0.5).setScale(0.2).setAlpha(0).setDepth(48);
    this.tweens.add({ targets: finishText, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.cameras.main.zoomTo(1.2, 500, 'Sine.easeInOut', true);
    this.cameras.main.pan(winner.sprite.x, winner.sprite.y, 500, 'Sine.easeInOut', true);

    // Con timeScale 0.2, 300 ms del reloj de escena equivalen a 1.5 s reales.
    this.time.delayedCall(300, () => {
      this.time.timeScale = 1;
      finishText.destroy();
      this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut', true);
      this.cameras.main.pan(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 300, 'Sine.easeInOut', true);
      this.time.delayedCall(320, () => {
        this.physics.world.resume();
        this.endRound(winner, 'ko');
      });
    });
  }

  freezeCombatant(combatant, duration, releaseVelocityX, releaseVelocityY) {
    combatant.frozenUntil = Math.max(combatant.frozenUntil, this.time.now + duration);
    combatant.sprite.setVelocity(0, 0);
    combatant.sprite.body.setAllowGravity(false);
    this.time.delayedCall(duration, () => {
      if (!this.roundActive || this.time.now < combatant.frozenUntil) return;
      combatant.sprite.body.setAllowGravity(true);
      combatant.sprite.clearTint();
      combatant.sprite.setVelocity(releaseVelocityX, releaseVelocityY);
    });
  }

  flashDamage(combatant, returnToFrozenTint) {
    combatant.sprite.setTintFill(0xff334d);
    this.time.delayedCall(38, () => {
      if (combatant.sprite.active) combatant.sprite.setTintFill(0xffffff);
    });
    this.time.delayedCall(92, () => {
      if (!combatant.sprite.active) return;
      if (returnToFrozenTint && this.time.now < combatant.frozenUntil) {
        combatant.sprite.setTint(0xa96bff);
      } else {
        combatant.sprite.clearTint();
      }
    });
  }

  showFloatingDamage(combatant, damage, blocked = false) {
    const label = this.add.text(
      combatant.sprite.x,
      combatant.sprite.y - combatant.sprite.displayHeight / 2 - 18,
      blocked ? `BLOQUEO  -${damage}` : `-${damage}`,
      {
        fontFamily: 'Trebuchet MS, Arial', fontSize: '30px', fontStyle: 'bold',
        color: blocked ? '#78c6ff' : '#ff526f', stroke: '#080b12', strokeThickness: 7
      }
    ).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: label,
      y: label.y - 58,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  showBlockEffect(combatant) {
    combatant.guardShield.setVisible(true).setScale(0.82).setAlpha(1);
    this.tweens.add({
      targets: combatant.guardShield,
      scale: 1.18,
      alpha: 0.45,
      duration: 130,
      yoyo: true,
      onComplete: () => {
        combatant.guardShield.setScale(1).setAlpha(combatant.isGuarding ? 0.9 : 0)
          .setVisible(combatant.isGuarding);
      }
    });
  }

  applyHitstop(duration) {
    this.hitstopEndsAt = Math.max(this.hitstopEndsAt || 0, this.time.now + duration);
    this.physics.world.pause();
    this.time.delayedCall(duration + 5, () => {
      if (this.time.now >= this.hitstopEndsAt && !this.koSequenceActive) this.physics.world.resume();
    });
  }

  startRoundTimer() {
    this.roundTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.roundActive) return;
        this.roundTime = Math.max(0, this.roundTime - 1);
        this.timerText.setText(String(this.roundTime).padStart(2, '0'));
        if (this.roundTime > 0 && this.roundTime <= 10) this.audioManager.playSfx('timer');
        if (this.roundTime === 0) {
          const winner = this.player1.health === this.player2.health
            ? null
            : this.player1.health > this.player2.health ? this.player1 : this.player2;
          this.endRound(winner, 'time');
        }
      }
    });
  }

  recordArcadeRoundTime() {
    if (this.gameMode !== 'ARCADE' || this.roundTimeRecorded || this.roundStartedAt === null) return;
    this.roundTimeRecorded = true;
    const roundDuration = Math.max(0, this.roundElapsedMs);
    const accumulated = Math.max(0, Number(this.registry.get('arcadeElapsedMs')) || 0) + roundDuration;
    this.registry.set('arcadeElapsedMs', accumulated);
  }

  endRound(winner, reason) {
    if (!this.roundActive) return;
    this.recordArcadeRoundTime();
    this.roundActive = false;
    this.controlsLocked = true;
    this.time.timeScale = 1;
    this.physics.world.resume();
    this.setGuardState(this.player1, false);
    this.setGuardState(this.player2, false);
    this.player1.sprite.setVelocity(0, 0);
    this.player2.sprite.setVelocity(0, 0);
    this.player1.sprite.body.enable = false;
    this.player2.sprite.body.enable = false;
    if (winner) winner.playAnimation('idle', { force: true });
    const defeated = winner === this.player1 ? this.player2 : winner === this.player2 ? this.player1 : null;
    if (reason === 'ko' && defeated) defeated.playAnimation('ko', { force: true });
    this.roundTimerEvent?.remove(false);
    this.audioManager.stopBgm();
    if (reason === 'ko') this.audioManager.announce('ko');
    if (this.isOnline && this.isHost) {
      this.broadcastOnlineState(this.time.now, {
        roundEnded: true,
        winnerSide: winner?.side || null,
        reason
      });
    }

    this.add.rectangle(640, 360, 1280, 720, 0x02040a, 0.76).setDepth(50);
    const panel = this.add.graphics().setDepth(51);
    panel.fillStyle(0x10192a, 0.98);
    panel.fillRoundedRect(260, 110, 760, 510, 20);
    panel.lineStyle(4, reason === 'ko' ? 0xffd23f : 0x69bfff, 1);
    panel.strokeRoundedRect(260, 110, 760, 510, 20);

    this.add.text(640, 166, reason === 'ko' ? '¡K.O.!' : '¡TIEMPO!', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '76px', fontStyle: 'bold italic',
      color: reason === 'ko' ? '#ffd23f' : '#69bfff', stroke: '#080b12', strokeThickness: 10
    }).setOrigin(0.5).setDepth(52);

    const winnerMessage = winner ? `¡GANA JUGADOR ${winner.side === 'P1' ? '1' : '2'}!` : '¡EMPATE!';
    this.add.text(640, 242, winnerMessage, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '31px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(52);
    if (winner) {
      this.createWinnerPresentation(winner);
    } else {
      this.add.text(640, 355, 'MISMA VIDA AL FINAL DEL ROUND', {
        fontFamily: 'Consolas, monospace', fontSize: '16px', fontStyle: 'bold', color: '#aebdd2'
      }).setOrigin(0.5).setDepth(52);
    }

    if (this.isOnline) {
      this.createResultButton(640, 545, 390, 62, 'VOLVER AL MENÚ PRINCIPAL', 0x5eff9d, () => this.returnToMenu());
    } else if (this.gameMode === 'ARCADE') {
      const queue = this.registry.get('arcadeQueue') || [];
      const fightIndex = this.registry.get('arcadeFightIndex') || 0;
      const playerWon = winner === this.player1;
      const defeatedFinalBoss = playerWon && this.player2.character.isBoss === true;
      const hasNextFight = playerWon && fightIndex < queue.length - 1;
      if (hasNextFight) {
        this.createResultButton(640, 505, 360, 54, 'SIGUIENTE COMBATE', 0xffd23f, () => this.advanceArcade());
        this.createResultButton(640, 570, 360, 54, 'MENÚ PRINCIPAL', 0x69bfff, () => this.returnToMenu());
      } else if (defeatedFinalBoss) {
        const totalTime = Math.max(1, Number(this.registry.get('arcadeElapsedMs')) || 1);
        const recordResult = saveArcadeRecord(totalTime, this.player1.character);
        this.registry.set('arcadeLastTimeMs', totalTime);
        this.registry.set('arcadeLastRecordWasBest', recordResult.isNewRecord);
        this.add.text(640, 462,
          `${recordResult.isNewRecord ? '¡NUEVO RÉCORD!  ' : 'TIEMPO ARCADE  '}${formatArcadeTime(totalTime)}`, {
            fontFamily: 'Consolas, monospace', fontSize: '17px', fontStyle: 'bold',
            color: recordResult.isNewRecord ? '#5eff9d' : '#9fb4d0',
            stroke: '#080b12', strokeThickness: 4
          }).setOrigin(0.5).setDepth(54);
        this.createResultButton(640, 545, 390, 62, 'VER FINAL ARCADE', 0xffd23f, () => this.goToEnding());
        this.endingAutoEvent = this.time.delayedCall(5500, () => this.goToEnding());
      } else if (playerWon) {
        this.createResultButton(640, 545, 390, 62, 'ARCADE COMPLETADO · MENÚ', 0xffd23f, () => this.returnToMenu());
      } else {
        this.createResultButton(640, 505, 330, 54, 'REINTENTAR', 0xffd23f, () => this.restartBattle());
        this.createResultButton(640, 570, 330, 54, 'MENÚ PRINCIPAL', 0x69bfff, () => this.returnToMenu());
      }
    } else {
      this.createResultButton(640, 505, 330, 54, 'REVANCHA', 0xffd23f, () => this.restartBattle());
      this.createResultButton(640, 570, 330, 54, 'SELECCIÓN DE PERSONAJES', 0x69bfff, () => this.returnToSelection());
    }
  }

  createWinnerPresentation(winner) {
    const character = winner.character;
    const portraitTexture = this.textures.exists(character.headSprite)
      ? character.headSprite
      : character.portrait;
    this.add.circle(430, 360, 92, 0x08101f, 1)
      .setStrokeStyle(5, character.color || 0xffd23f, 1)
      .setDepth(52);
    const portrait = this.add.image(430, 360, portraitTexture).setDepth(53);
    this.scaleToFit(portrait, 166, 166);
    if (winner.side === 'P2') portrait.setFlipX(true);

    this.add.text(705, 305, character.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '25px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#080b12', strokeThickness: 5
    }).setOrigin(0.5).setDepth(53);
    const quotes = character.victoryQuotes || [];
    const quote = quotes[Math.floor(Math.random() * quotes.length)] || 'El caos tiene un nuevo campeón.';
    this.add.text(705, 375, `“${quote}”`, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '19px', fontStyle: 'italic',
      color: '#ffd97a', align: 'center', wordWrap: { width: 420, useAdvancedWrap: true },
      stroke: '#080b12', strokeThickness: 4
    }).setOrigin(0.5).setDepth(53);
  }

  createResultButton(x, y, width, height, label, accent, onClick) {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [bg, text, hitZone]).setDepth(53);
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(hovered ? 0x263b5b : 0x131e31, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 9);
      bg.lineStyle(hovered ? 4 : 2, accent, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 9);
      text.setColor(hovered ? '#ffd84d' : '#ffffff');
    };
    draw(false);
    hitZone.on('pointerover', () => draw(true));
    hitZone.on('pointerout', () => draw(false));
    hitZone.on('pointerup', onClick);
    return button;
  }

  restartBattle() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => {
      this.scene.restart({
        player1Key: this.player1.character.id,
        player2Key: this.player2.character.id,
        stageId: this.stage.id
      });
    });
  }

  advanceArcade() {
    if (this.transitioning) return;
    const queue = this.registry.get('arcadeQueue') || [];
    const nextIndex = (this.registry.get('arcadeFightIndex') || 0) + 1;
    const nextOpponentKey = queue[nextIndex];
    if (!nextOpponentKey || !CHARACTER_BY_ID[nextOpponentKey]) {
      this.returnToMenu();
      return;
    }

    this.transitioning = true;
    this.registry.set('arcadeFightIndex', nextIndex);
    this.registry.set('selectedP2Key', nextOpponentKey);
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => {
      this.scene.start('VersusScene', {
        player1Key: this.player1.character.id,
        player2Key: nextOpponentKey
      });
    });
  }

  goToEnding() {
    if (this.transitioning) return;
    this.transitioning = true;
    const playerKey = this.player1.character.id;
    this.registry.set('arcadeWinnerKey', playerKey);
    this.cameras.main.fadeOut(260, 3, 6, 13);
    this.time.delayedCall(270, () => this.scene.start('EndingScene', { playerKey }));
  }

  openPause() {
    if (this.pauseRequested || this.transitioning || !this.roundActive || this.koSequenceActive) return;
    this.pauseRequested = true;
    this.audioManager?.pauseBgm();
    this.scene.launch('PauseScene', {
      player1Key: this.player1.character.id,
      player2Key: this.player2.character.id,
      stageId: this.stage.id
    });
    this.scene.pause();
  }

  returnToMenu() {
    if (this.transitioning) return;
    this.transitioning = true;
    if (this.isOnline) {
      NetworkManager.leaveRoom();
      this.registry.set('isOnline', false);
      this.registry.remove('selectedStageId');
    }
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => this.scene.start('MenuScene'));
  }

  returnToSelection() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(180, 3, 6, 13);
    this.time.delayedCall(190, () => this.scene.start('SelectScene'));
  }

  scaleToFit(sprite, maxWidth, maxHeight) {
    sprite.setScale(1);
    const scale = Math.min(maxWidth / sprite.width, maxHeight / sprite.height);
    sprite.setScale(scale);
  }
}
