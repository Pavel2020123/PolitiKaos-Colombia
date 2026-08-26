export const STANDARD_ANIMATION_STATES = Object.freeze([
  'idle',
  'walk',
  'jump',
  'attack_light',
  'attack_heavy',
  'special',
  'guard',
  'hurt',
  'ko'
]);

// Esquema esperado en characters.js:
// spriteSheet: { key, path, frameWidth, frameHeight }
// atlas: { key, image, json }
// animations: { idle: { start: 0, end: 5 }, special: { prefix: 'special_', start: 0, end: 7 } }

const DEFAULTS = Object.freeze({
  idle: Object.freeze({ frameRate: 8, repeat: -1 }),
  walk: Object.freeze({ frameRate: 12, repeat: -1 }),
  jump: Object.freeze({ frameRate: 10, repeat: 0 }),
  attack_light: Object.freeze({ frameRate: 15, repeat: 0 }),
  attack_heavy: Object.freeze({ frameRate: 12, repeat: 0 }),
  special: Object.freeze({ frameRate: 12, repeat: 0 }),
  guard: Object.freeze({ frameRate: 8, repeat: -1 }),
  hurt: Object.freeze({ frameRate: 11, repeat: 0 }),
  ko: Object.freeze({ frameRate: 8, repeat: 0 })
});

const LOOPING_STATES = new Set(['idle', 'walk', 'guard']);
const LOCOMOTION_STATES = new Set(['idle', 'walk', 'jump', 'guard']);

export default class AnimationManager {
  static preloadCharacter(scene, character) {
    const sheet = character?.spriteSheet || character?.spritesheet;
    if (sheet?.key && (sheet.path || sheet.image) && !scene.textures.exists(sheet.key)) {
      scene.load.spritesheet(sheet.key, sheet.path || sheet.image, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
        startFrame: sheet.startFrame,
        endFrame: sheet.endFrame,
        margin: sheet.margin || 0,
        spacing: sheet.spacing || 0
      });
    }

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
    this.lockedUntil = 0;
    this.animationKeys = new Map();
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
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
      if (!animation?.key?.startsWith(`${this.character.id}:`)) return;
      const completedState = animation.key.slice(this.character.id.length + 1);
      if (completedState === 'ko') return;
      this.lockedUntil = 0;
      if (!LOOPING_STATES.has(completedState)) this.playAnimation('idle', { force: true });
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
    this.sprite.play(animationKey, options.ignoreIfPlaying !== false);
    return true;
  }

  hasAnimation(state) {
    return this.scene.anims.exists(this.animationKeys.get(state) || this.getAnimationKey(state));
  }

  getAnimationKey(state) {
    return `${this.character.id || 'fighter'}:${state}`;
  }
}
