export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.85,
  muted: false
});

const BATTLE_AUDIO_SOURCES = Object.freeze([
  // BGM provisional: reemplaza la ruta cuando agregues assets/audio/bgm_battle.mp3.
  { key: 'battle_bgm', path: 'assets/audio/bgm_menu.mp3' },
  { key: 'battle_announcer_fight', path: 'assets/audio/sfx_fight.flac' }
]);

export default class BattleAudioManager {
  static preload(scene, musicTrack = null) {
    BATTLE_AUDIO_SOURCES.forEach(({ key, path }) => {
      if (!scene.cache.audio.exists(key)) scene.load.audio(key, path);
    });
    if (musicTrack?.key && musicTrack?.path && !scene.cache.audio.exists(musicTrack.key)) {
      scene.load.audio(musicTrack.key, musicTrack.path);
    }

    // SFX opcionales: se usa síntesis Web Audio mientras estos archivos no existan.
    // scene.load.audio('battle_hit_basic', 'assets/audio/hit_basic.mp3');
    // scene.load.audio('battle_hit_special', 'assets/audio/hit_special.mp3');
    // scene.load.audio('battle_ulti', 'assets/audio/ulti.mp3');
    // scene.load.audio('battle_timer_tick', 'assets/audio/timer_tick.mp3');
    // scene.load.audio('battle_announcer_ko', 'assets/audio/announcer_ko.mp3');
  }

  constructor(scene, musicTrack = null) {
    this.scene = scene;
    this.bgm = null;
    this.musicTrack = musicTrack;
    this.settings = {
      ...DEFAULT_AUDIO_SETTINGS,
      ...(scene.registry.get('audioSettings') || {})
    };
    this.applyGlobalSettings();
  }

  startBgm(musicTrack = this.musicTrack) {
    const requestedKey = musicTrack?.key;
    const bgmKey = requestedKey && this.scene.cache.audio.exists(requestedKey)
      ? requestedKey
      : 'battle_bgm';
    if (this.bgm?.isPlaying && this.currentBgmKey === bgmKey) return;
    if (!this.scene.cache.audio.exists(bgmKey)) return;
    this.stopBgm();
    this.musicTrack = musicTrack;
    this.currentBgmKey = bgmKey;
    this.bgm = this.scene.sound.add(bgmKey, {
      loop: true,
      volume: this.getBgmVolume(),
      rate: musicTrack?.rate ?? 1
    });
    this.bgm.play();
  }

  playSfx(type) {
    const cacheKeys = {
      basic: 'battle_hit_basic',
      special: 'battle_hit_special',
      ultimate: 'battle_ulti',
      timer: 'battle_timer_tick'
    };
    const cacheKey = cacheKeys[type];
    if (cacheKey && this.playCached(cacheKey, this.settings.sfxVolume)) return;
    this.playSynth(type);
  }

  announce(type) {
    if (type === 'fight' && this.playCached('battle_announcer_fight', this.settings.sfxVolume)) return;
    if (type === 'ko' && this.playCached('battle_announcer_ko', this.settings.sfxVolume)) return;
    this.speak(type === 'fight' ? 'Fight!' : '¡K.O.!');
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    this.persistSettings();
    this.applyGlobalSettings();
    return this.settings.muted;
  }

  changeMasterVolume(delta) {
    this.settings.masterVolume = Phaser.Math.Clamp(this.settings.masterVolume + delta, 0, 1);
    this.persistSettings();
    this.applyGlobalSettings();
    return this.settings.masterVolume;
  }

  updateSettings(changes) {
    this.settings = { ...this.settings, ...changes };
    this.settings.masterVolume = Phaser.Math.Clamp(this.settings.masterVolume, 0, 1);
    this.settings.musicVolume = Phaser.Math.Clamp(this.settings.musicVolume, 0, 1);
    this.settings.sfxVolume = Phaser.Math.Clamp(this.settings.sfxVolume, 0, 1);
    this.persistSettings();
    this.applyGlobalSettings();
    this.bgm?.setVolume(this.getBgmVolume());
    return { ...this.settings };
  }

  getStatusText() {
    if (this.settings.muted) return 'AUDIO: SILENCIADO';
    return `AUDIO: ${Math.round(this.settings.masterVolume * 100)}%`;
  }

  stopBgm() {
    if (!this.bgm) return;
    this.bgm.stop();
    this.bgm.destroy();
    this.bgm = null;
    this.currentBgmKey = null;
  }

  pauseBgm() {
    if (this.bgm?.isPlaying) this.bgm.pause();
  }

  resumeBgm() {
    if (this.bgm?.isPaused) this.bgm.resume();
  }

  destroy() {
    this.stopBgm();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  applyGlobalSettings() {
    this.scene.sound.mute = this.settings.muted;
    this.scene.sound.volume = this.settings.masterVolume;
  }

  persistSettings() {
    this.scene.registry.set('audioSettings', { ...this.settings });
  }

  getBgmVolume() {
    return Phaser.Math.Clamp(this.settings.musicVolume * (this.musicTrack?.volume ?? 1), 0, 1);
  }

  playCached(key, volume) {
    if (this.settings.muted || !this.scene.cache.audio.exists(key)) return false;
    const sound = this.scene.sound.add(key, { volume });
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      sound.destroy();
    };
    sound.once('complete', cleanup);
    sound.once('stop', cleanup);
    if (!sound.play()) {
      cleanup();
      return false;
    }
    return true;
  }

  playSynth(type) {
    if (this.settings.muted) return;
    const context = this.scene.sound.context;
    if (!context?.createOscillator) return;
    if (context.state === 'suspended') context.resume().catch(() => {});

    const tones = {
      basic: { start: 185, end: 90, duration: 0.09, wave: 'square', gain: 0.12 },
      special: { start: 360, end: 105, duration: 0.16, wave: 'sawtooth', gain: 0.15 },
      ultimate: { start: 105, end: 620, duration: 0.34, wave: 'sawtooth', gain: 0.18 },
      timer: { start: 880, end: 660, duration: 0.07, wave: 'square', gain: 0.08 }
    };
    const tone = tones[type] || tones.basic;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(tone.end, now + tone.duration);
    gain.gain.setValueAtTime(tone.gain * this.settings.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tone.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.duration);
  }

  speak(text) {
    if (this.settings.muted || !('speechSynthesis' in window)
      || typeof SpeechSynthesisUtterance === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 0.92;
    utterance.pitch = 0.8;
    utterance.volume = this.settings.sfxVolume * this.settings.masterVolume;
    window.speechSynthesis.speak(utterance);
  }
}
