export const STANDARD_ANIMATION_STATES = Object.freeze([
  'idle',
  'walk',
  'walk_back',
  'crouch',
  'jump',
  'attack_light',
  'attack_heavy',
  'light_kick',
  'heavy_kick',
  'special',
  'special2',
  'ultimate',
  'guard',
  'hurt',
  'ko'
]);

export const FIGHTER_STATES = Object.freeze({
  IDLE: 'IDLE', WALK: 'WALK', CROUCH: 'CROUCH', JUMP: 'JUMP', ATTACK: 'ATTACK',
  GUARD: 'GUARD', HITSTUN: 'HITSTUN', KNOCKDOWN: 'KNOCKDOWN'
});

const FSM_STATE_BY_ANIMATION = Object.freeze({
  idle: FIGHTER_STATES.IDLE,
  walk: FIGHTER_STATES.WALK,
  walk_back: FIGHTER_STATES.WALK,
  crouch: FIGHTER_STATES.CROUCH,
  jump: FIGHTER_STATES.JUMP,
  attack_light: FIGHTER_STATES.ATTACK,
  attack_heavy: FIGHTER_STATES.ATTACK,
  light_kick: FIGHTER_STATES.ATTACK,
  heavy_kick: FIGHTER_STATES.ATTACK,
  special: FIGHTER_STATES.ATTACK,
  special2: FIGHTER_STATES.ATTACK,
  ultimate: FIGHTER_STATES.ATTACK,
  guard: FIGHTER_STATES.GUARD,
  hurt: FIGHTER_STATES.HITSTUN,
  ko: FIGHTER_STATES.KNOCKDOWN
});

// Esquema esperado en characters.js:
// spriteSheet: { key, path, frameWidth, frameHeight }
// spriteSheets: [{ key, path, frameWidth, frameHeight }] para una textura por estado
// atlas: { key, image, json }
// animations: { idle: { start: 0, end: 5 }, special: { prefix: 'special_', start: 0, end: 7 } }

const DEFAULTS = Object.freeze({
  idle: Object.freeze({ frameRate: 8, repeat: -1 }),
  walk: Object.freeze({ frameRate: 12, repeat: -1 }),
  walk_back: Object.freeze({ frameRate: 10, repeat: -1 }),
  crouch: Object.freeze({ frameRate: 10, repeat: 0 }),
  jump: Object.freeze({ frameRate: 10, repeat: 0 }),
  attack_light: Object.freeze({ frameRate: 15, repeat: 0 }),
  attack_heavy: Object.freeze({ frameRate: 12, repeat: 0 }),
  light_kick: Object.freeze({ frameRate: 12, repeat: 0 }),
  heavy_kick: Object.freeze({ frameRate: 10, repeat: 0 }),
  special: Object.freeze({ frameRate: 12, repeat: 0 }),
  special2: Object.freeze({ frameRate: 12, repeat: 0 }),
  ultimate: Object.freeze({ frameRate: 12, repeat: 0 }),
  guard: Object.freeze({ frameRate: 8, repeat: -1 }),
  hurt: Object.freeze({ frameRate: 11, repeat: 0 }),
  ko: Object.freeze({ frameRate: 8, repeat: 0 })
});

const LOOPING_STATES = new Set(['idle', 'walk', 'walk_back']);
const LOCOMOTION_STATES = new Set(['idle', 'walk', 'walk_back', 'crouch', 'jump', 'guard']);
const MOVEMENT_LOCK_STATES = new Set([
  FIGHTER_STATES.ATTACK, FIGHTER_STATES.HITSTUN, FIGHTER_STATES.KNOCKDOWN
]);

export default class AnimationManager {
  static preloadCharacter(scene, character) {
    const legacySheet = character?.spriteSheet || character?.spritesheet;
    const sheets = [legacySheet, ...(character?.spriteSheets || [])].filter(Boolean);
    const queuedSheetKeys = new Set();
    sheets.forEach(sheet => {
      if (!sheet?.key || !(sheet.path || sheet.image)
        || queuedSheetKeys.has(sheet.key) || scene.textures.exists(sheet.key)) return;
      queuedSheetKeys.add(sheet.key);
      scene.load.spritesheet(sheet.key, sheet.path || sheet.image, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
        startFrame: sheet.startFrame,
        endFrame: sheet.endFrame,
        margin: sheet.margin || 0,
        spacing: sheet.spacing || 0
      });
    });

    const atlas = character?.atlas;
    if (atlas?.key && (atlas.texturePath || atlas.image) && (atlas.atlasPath || atlas.json)
      && !scene.textures.exists(atlas.key)) {
      scene.load.atlas(atlas.key, atlas.texturePath || atlas.image, atlas.atlasPath || atlas.json);
    }
  }

  constructor(scene, character) {
    this.scene = scene;
    this.character = character || {};
    this.sprite = null;
    this.currentState = null;
    this.fsmState = FIGHTER_STATES.IDLE;
    this.lockedUntil = 0;
    this.animationKeys = new Map();
    this.baseScaleX = 1;
    this.baseScaleY = 1;
    this.baseBodyWidth = null;
    this.baseBodyHeight = null;
    this.registerStandardAnimations();
  }

  registerStandardAnimations() {
    STANDARD_ANIMATION_STATES.forEach(state => this.registerAnimation(state));
    return this.animationKeys;
  }

  registerAnimation(state) {
    const definition = this.getDefinition(state);
    if (!definition || definition.enabled === false) return false;
    const textureKey = definition.texture
      || definition.textureKey
      || this.character.atlas?.key
      || this.character.spriteSheet?.key
      || this.character.spritesheet?.key
      || this.character.combatTexture;
    if (!textureKey || !this.scene.textures.exists(textureKey)) return false;

    const animationKey = this.getAnimationKey(state);
    if (this.scene.anims.exists(animationKey)) {
      this.animationKeys.set(state, animationKey);
      return true;
    }
    const frames = this.buildFrames(textureKey, definition);
    if (!frames.length) return false;
    const defaults = DEFAULTS[state];
    this.scene.anims.create({
      key: animationKey,
      frames,
      frameRate: definition.frameRate ?? defaults.frameRate,
      repeat: definition.repeat ?? defaults.repeat,
      delay: definition.delay ?? 0,
      repeatDelay: definition.repeatDelay ?? 0,
      yoyo: definition.yoyo === true,
      hideOnComplete: definition.hideOnComplete === true,
      showOnStart: definition.showOnStart !== false,
      skipMissedFrames: definition.skipMissedFrames !== false
    });
    this.animationKeys.set(state, animationKey);
    return true;
  }

  getDefinition(state) {
    const animationSets = [this.character.animations, this.character.animationStates];
    for (const animationSet of animationSets) {
      if (!animationSet || !Object.prototype.hasOwnProperty.call(animationSet, state)) continue;
      const configured = animationSet[state];
      if (configured === false) return { enabled: false };
      if (configured === true) return {};
      if (typeof configured === 'string') return { type: 'atlas', prefix: configured };
      if (Array.isArray(configured)) return { frames: configured };
      return configured;
    }

    const standardRanges = this.character.standardFrameRanges;
    if (standardRanges?.[state]) return standardRanges[state];
    return null;
  }

  buildFrames(textureKey, definition) {
    if (Array.isArray(definition.frames) && definition.frames.length) {
      return definition.frames.map(frame => (
        typeof frame === 'object' && frame.key ? frame : { key: textureKey, frame }
      ));
    }

    const usesAtlasNames = definition.type === 'atlas'
      || typeof definition.prefix === 'string'
      || Array.isArray(definition.frameNames);
    if (Array.isArray(definition.frameNames) && definition.frameNames.length) {
      return definition.frameNames.map(frame => ({ key: textureKey, frame }));
    }
    if (usesAtlasNames && typeof definition.prefix === 'string') {
      if (!Number.isInteger(definition.start) && !Number.isInteger(definition.end)) {
        const suffix = definition.suffix || '';
        return this.scene.textures.get(textureKey).getFrameNames()
          .filter(frameName => frameName.startsWith(definition.prefix) && frameName.endsWith(suffix))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
          .map(frame => ({ key: textureKey, frame }));
      }
      return this.scene.anims.generateFrameNames(textureKey, {
        prefix: definition.prefix,
        suffix: definition.suffix || '',
        start: definition.start ?? 0,
        end: definition.end ?? definition.start ?? 0,
        zeroPad: definition.zeroPad || 0
      });
    }
    if (Number.isInteger(definition.start) || Number.isInteger(definition.end)) {
      return this.scene.anims.generateFrameNumbers(textureKey, {
        start: definition.start ?? 0,
        end: definition.end ?? definition.start ?? 0,
        first: definition.first
      });
    }
    return [];
  }

  attach(sprite) {
    this.sprite = sprite;
    this.baseScaleX = Math.abs(sprite.scaleX) || 1;
    this.baseScaleY = Math.abs(sprite.scaleY) || 1;
    this.baseBodyWidth = sprite.body?.width || null;
    this.baseBodyHeight = sprite.body?.height || null;
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
      if (!animation?.key?.startsWith(`${this.character.id}:`)) return;
      const completedState = animation.key.slice(this.character.id.length + 1);
      if (completedState === 'ko') return;
      const definition = this.getDefinition(completedState) || {};
      if (definition.holdOnComplete === true) return;
      this.lockedUntil = 0;
      if (!LOOPING_STATES.has(completedState)) {
        this.fsmState = FIGHTER_STATES.IDLE;
        this.playAnimation('idle', { force: true });
      }
    });
    sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE || 'animationupdate', (animation, animationFrame) => {
      if (!animation?.key?.startsWith(`${this.character.id}:`)) return;
      const state = animation.key.slice(this.character.id.length + 1);
      this.applyFramePivot(state, animationFrame);
    });
    return this;
  }

  playAnimation(state, options = {}) {
    if (!this.sprite?.active || !STANDARD_ANIMATION_STATES.includes(state)) return false;
    const animationKey = this.animationKeys.get(state) || this.getAnimationKey(state);
    if (!this.scene.anims.exists(animationKey)) return false;
    const force = options.force === true;
    if (!force && LOCOMOTION_STATES.has(state) && this.scene.time.now < this.lockedUntil) return false;
    if (!force && this.currentState === state
      && (this.sprite.anims?.isPlaying || !LOOPING_STATES.has(state))) return true;
    if (options.lockMs > 0) this.lockedUntil = Math.max(this.lockedUntil, this.scene.time.now + options.lockMs);
    this.currentState = state;
    this.fsmState = FSM_STATE_BY_ANIMATION[state] || FIGHTER_STATES.IDLE;
    this.sprite.play(animationKey, options.ignoreIfPlaying !== false);
    this.applyPresentationScale(state);
    return true;
  }

  applyPresentationScale(state) {
    const definition = this.getDefinition(state) || {};
    const multiplier = Number.isFinite(definition.displayScale) ? definition.displayScale : 1;
    const defaultOrigin = this.character.combatOrigin || { x: 0.5, y: 0.5 };
    this.sprite.setOrigin(defaultOrigin.x, defaultOrigin.y);
    this.sprite.setScale(this.baseScaleX * multiplier, this.baseScaleY * multiplier);
    this.applyFramePivot(state, { index: 1 });

    if (this.sprite.body && this.baseBodyWidth && this.baseBodyHeight) {
      const scaleX = Math.max(0.0001, Math.abs(this.sprite.scaleX));
      const scaleY = Math.max(0.0001, Math.abs(this.sprite.scaleY));
      const bodyWidth = this.baseBodyWidth / scaleX;
      const bodyHeight = this.baseBodyHeight / scaleY;

      // Los sprites con pivote en los pies usan celdas de tamaños muy distintos.
      // Centrar la hurtbox dentro de una celda grande cambia su apoyo y hace que
      // Arcade Physics baje al personaje hasta volver a tocar el suelo.
      if (this.sprite.originY >= 0.9 && typeof this.sprite.body.setOffset === 'function') {
        const frameWidth = this.sprite.frame?.realWidth || this.sprite.frame?.width || this.sprite.width;
        const frameHeight = this.sprite.frame?.realHeight || this.sprite.frame?.height || this.sprite.height;
        this.sprite.body.setSize(bodyWidth, bodyHeight, false);
        this.sprite.body.setOffset(
          Math.max(0, (frameWidth - bodyWidth) / 2),
          Math.max(0, frameHeight - bodyHeight)
        );
      } else {
        this.sprite.body.setSize(bodyWidth, bodyHeight, true);
      }
    }
  }

  applyFramePivot(state, animationFrame) {
    // El pivote variable se aplica solo al sprite visual desacoplado. Cambiar el
    // origen de un sprite físico durante una animación volvería a mover su Body.
    if (!this.sprite || this.sprite.body) return;
    const pivots = this.getDefinition(state)?.framePivots;
    if (!Array.isArray(pivots) || !pivots.length) return;
    const frameIndex = Phaser.Math.Clamp((animationFrame?.index || 1) - 1, 0, pivots.length - 1);
    const pivot = pivots[frameIndex];
    this.sprite.setOrigin(pivot.x, pivot.y);
  }

  hasAnimation(state) {
    return this.scene.anims.exists(this.animationKeys.get(state) || this.getAnimationKey(state));
  }

  isMovementLocked(now = this.scene.time.now) {
    return MOVEMENT_LOCK_STATES.has(this.fsmState) && now < this.lockedUntil;
  }

  getState() {
    return this.fsmState;
  }

  getAnimationKey(state) {
    return `${this.character.id || 'fighter'}:${state}`;
  }
}
