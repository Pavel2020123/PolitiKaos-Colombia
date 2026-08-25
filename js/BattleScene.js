const HEAD_ASSETS = [
  ['abelardo_head', 'assets/images/abelardo_head.png'],
  ['cepeda_head', 'assets/images/cepeda_head.png'],
  ['duque_head', 'assets/images/duque_head.png'],
  ['petro_head', 'assets/images/petro_head.png'],
  ['polopolo_head', 'assets/images/polopolo_head.png'],
  ['uribe_head', 'assets/images/uribe_head.png']
];

const AUDIO_KEYS = {
  petro: 'petro_asustados',
  abelardo: 'abelardo_voz',
  uribe: 'uribe_voz',
  duque: 'duque_voz',
  cepeda: 'cepeda_voz',
  paloma: 'paloma_voz',
  polopolo: 'polopolo_voz',
  vice: 'vice_voz'
};

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    this.selectionData = {
      player1: data?.player1 || { id: 'p1', name: 'Jugador 1', texture: '', color: 0x2f80ed },
      player2: data?.player2 || { id: 'ia', name: 'Rival IA', texture: '', color: 0xeb3b5a }
    };
  }

  preload() {
    this.failedAssets = new Set();
    this.load.on('loaderror', file => this.failedAssets.add(file.key));

    HEAD_ASSETS.forEach(([key, path]) => {
      if (!this.textures.exists(key)) this.load.image(key, path);
    });

    if (!this.cache.audio.exists('petro_asustados')) {
      this.load.audio('petro_asustados', 'assets/audio/petro_asustados.mp3');
    }

    // Audios opcionales: descomenta al agregar los MP3 correspondientes.
    // this.load.audio('abelardo_voz', 'assets/audio/abelardo_voz.mp3');
    // this.load.audio('uribe_voz', 'assets/audio/uribe_voz.mp3');
    // this.load.audio('duque_voz', 'assets/audio/duque_voz.mp3');
    // this.load.audio('cepeda_voz', 'assets/audio/cepeda_voz.mp3');
    // this.load.audio('paloma_voz', 'assets/audio/paloma_voz.mp3');
    // this.load.audio('polopolo_voz', 'assets/audio/polopolo_voz.mp3');
    // this.load.audio('vice_voz', 'assets/audio/vice_voz.mp3');
  }

  create() {
    this.transitioning = false;
    this.gameEnded = false;
    this.actionInProgress = false;
    this.turn = 'player';
    this.rollUsed = false;

    this.player = {
      ...this.selectionData.player1,
      hp: 100,
      ego: 0,
      multiplier: 1
    };
    this.enemy = {
      ...this.selectionData.player2,
      hp: 100,
      ego: 0,
      multiplier: 1
    };

    this.ensureCombatFallbacks();
    this.drawArena();
    this.createBattleHud();

    // Las coordenadas del contenedor son exactamente las posiciones de combate.
    this.playerSprite = this.createChibiFighter(this.player, 200, 380, false);
    this.enemySprite = this.createChibiFighter(this.enemy, 600, 380, true);

    this.createActionPanel();
    this.audioManager = {
      play: (fighter, action) => this.playCharacterVoice(fighter, action)
    };

    this.logMessage(`Turno de ${this.player.name}. Elige una acción directa o arriesga con el dado.`);
    this.updateHud();
    this.updateControls();
    this.cameras.main.fadeIn(260, 4, 7, 15);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });
  }

  ensureCombatFallbacks() {
    if (!this.textures.exists('cuerpo_traje')) {
      const g = this.add.graphics();
      g.fillStyle(0x101827, 0);
      g.fillRect(0, 0, 220, 180);
      g.fillStyle(0x172c4d, 1);
      g.fillRoundedRect(30, 25, 160, 150, 34);
      g.fillRoundedRect(4, 46, 48, 112, 20);
      g.fillRoundedRect(168, 46, 48, 112, 20);
      g.fillStyle(0xf4efe6, 1);
      g.fillTriangle(70, 26, 150, 26, 110, 120);
      g.fillStyle(0xd9364f, 1);
      g.fillTriangle(101, 50, 119, 50, 110, 140);
      g.fillStyle(0x0d1728, 1);
      g.fillRect(31, 150, 158, 27);
      g.lineStyle(5, 0x4c6c9e, 1);
      g.strokeRoundedRect(30, 25, 160, 150, 34);
      g.generateTexture('cuerpo_traje', 220, 180);
      g.destroy();
    }

    [this.player, this.enemy].forEach(fighter => {
      const headKey = `${fighter.id}_head`;
      if (this.textures.exists(headKey) || (fighter.texture && this.textures.exists(fighter.texture))) return;
      const g = this.add.graphics();
      g.fillStyle(0x111827, 1);
      g.fillRect(0, 0, 300, 300);
      g.fillStyle(fighter.color || 0x66748d, 1);
      g.fillCircle(150, 135, 95);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(115, 120, 12);
      g.fillCircle(185, 120, 12);
      g.lineStyle(10, 0xffffff, 0.75);
      g.lineBetween(105, 182, 195, 182);
      g.generateTexture(headKey, 300, 300);
      g.destroy();
    });
  }

  drawArena() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x07101f, 0x07101f, 0x243c5d, 0x243c5d, 1);
    g.fillRect(0, 0, 800, 600);

    // Público pixelado.
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 24; column++) {
        const color = (row + column) % 3 === 0 ? 0xffd23f : (column % 2 ? 0x4c81c4 : 0xd84b62);
        g.fillStyle(color, 0.32);
        g.fillRect(10 + column * 34, 140 + row * 22, 8, 8);
      }
    }

    // Ring limpio en perspectiva.
    g.fillStyle(0x131e31, 1);
    g.fillTriangle(62, 438, 738, 438, 680, 500);
    g.fillTriangle(62, 438, 680, 500, 120, 500);
    g.lineStyle(5, 0xffd23f, 0.85);
    g.lineBetween(65, 428, 735, 428);
    g.lineStyle(3, 0x587198, 1);
    g.lineBetween(75, 362, 725, 362);
    g.lineBetween(70, 397, 730, 397);
    g.fillStyle(0x30415e, 1);
    g.fillRect(65, 345, 10, 100);
    g.fillRect(725, 345, 10, 100);

    // Focos del escenario.
    g.fillStyle(0xffefb0, 0.06);
    g.fillTriangle(80, 0, 145, 445, 330, 445);
    g.fillTriangle(720, 0, 655, 445, 470, 445);
  }

  createBattleHud() {
    this.playerHud = this.createStatusPanel(18, 18, this.player, this.player.color || 0x2f80ed, false);
    this.enemyHud = this.createStatusPanel(452, 18, this.enemy, this.enemy.color || 0xeb3b5a, true);

    this.turnBadgeBg = this.add.rectangle(400, 61, 88, 38, 0xffd23f, 1).setStrokeStyle(2, 0xffffff, 0.5);
    this.turnBadge = this.add.text(400, 61, 'P1', {
      fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#111827', align: 'center'
    }).setOrigin(0.5);

    this.dieBg = this.add.rectangle(400, 126, 48, 48, 0xf7f0dd, 1).setStrokeStyle(3, 0xffd23f, 1);
    this.dieText = this.add.text(400, 126, '?', {
      fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#111827'
    }).setOrigin(0.5);
    this.dieLabel = this.add.text(400, 156, 'DADO POLITICO', {
      fontFamily: 'Consolas, monospace', fontSize: '8px', fontStyle: 'bold', color: '#aebdd2'
    }).setOrigin(0.5);
  }

  createStatusPanel(x, y, fighter, accent, alignRight) {
    const width = 330;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b1322, 0.97);
    bg.fillRoundedRect(x, y, width, 90, 10);
    bg.lineStyle(3, accent, 1);
    bg.strokeRoundedRect(x, y, width, 90, 10);

    const name = this.add.text(alignRight ? x + width - 13 : x + 13, y + 9, fighter.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(alignRight ? 1 : 0, 0);

    this.add.text(x + 13, y + 37, 'HP', {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#ff8294'
    });
    this.add.text(x + 13, y + 62, 'EGO', {
      fontFamily: 'Arial', fontSize: '9px', fontStyle: 'bold', color: '#c79cff'
    });

    const barsBg = this.add.graphics();
    barsBg.fillStyle(0x03060c, 1);
    barsBg.fillRoundedRect(x + 52, y + 38, 225, 13, 4);
    barsBg.fillRoundedRect(x + 52, y + 64, 225, 9, 4);

    const hpBar = this.add.graphics();
    const egoBar = this.add.graphics();
    const hpText = this.add.text(x + 314, y + 35, '100', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(1, 0);
    const egoText = this.add.text(x + 314, y + 59, '0%', {
      fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(1, 0);
    const critical = this.add.text(alignRight ? x + 13 : x + width - 13, y + 10, '', {
      fontFamily: 'Consolas, monospace', fontSize: '9px', fontStyle: 'bold', color: '#ffd23f'
    }).setOrigin(alignRight ? 0 : 1, 0);

    return { x, y, fighter, hpBar, egoBar, hpText, egoText, name, critical };
  }

  createChibiFighter(fighter, x, y, flipX) {
    const shadow = this.add.ellipse(0, 92, 175, 28, 0x000000, 0.48);
    const torso = this.add.image(0, 25, 'cuerpo_traje').setDisplaySize(176, 144);
    const headKey = this.textures.exists(`${fighter.id}_head`) ? `${fighter.id}_head` : fighter.texture;
    const sprite = this.add.image(0, -78, headKey);
    this.cropToFill(sprite, 158, 158);

    if (flipX) {
      torso.setFlipX(true);
      sprite.setFlipX(true);
    }

    const outline = this.add.circle(0, -78, 83, 0x000000, 0).setStrokeStyle(5, fighter.color || 0x6b7d99, 0.9);
    const namePlate = this.add.text(0, 104, fighter.name.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#080d18', padding: { x: 10, y: 4 }, stroke: '#05070d', strokeThickness: 3
    }).setOrigin(0.5);

    // El contenedor conserva las coordenadas pedidas: P1 (200,380), IA (600,380).
    const container = this.add.container(x, y, [shadow, torso, outline, sprite, namePlate]);
    container.setData('baseX', x);
    container.setData('fighter', fighter);
    return container;
  }

  cropToFill(image, width, height) {
    const source = image.texture.getSourceImage();
    const sourceRatio = source.width / source.height;
    const targetRatio = width / height;
    let cropWidth = source.width;
    let cropHeight = source.height;
    let cropX = 0;
    let cropY = 0;
    if (sourceRatio > targetRatio) {
      cropWidth = source.height * targetRatio;
      cropX = (source.width - cropWidth) / 2;
    } else {
      cropHeight = source.width / targetRatio;
      cropY = (source.height - cropHeight) / 2;
    }
    image.setCrop(cropX, cropY, cropWidth, cropHeight);
    image.setDisplaySize(width, height);
  }

  createActionPanel() {
    const panel = this.add.graphics();
    panel.fillStyle(0x070c16, 0.98);
    panel.fillRect(0, 485, 800, 115);
    panel.lineStyle(3, 0x344b70, 1);
    panel.lineBetween(0, 485, 800, 485);

    this.logText = this.add.text(400, 467, '', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', fontStyle: 'bold', color: '#dbe7f7',
      backgroundColor: '#0a101d', padding: { x: 12, y: 6 }, align: 'center',
      wordWrap: { width: 730 }
    }).setOrigin(0.5);

    this.normalButton = this.createButton(106, 541, 164, 58, 'ATAQUE NORMAL\n15 DAÑO · +20 EGO', 0x2f80ed, () => this.handlePlayerAction('normal'));
    this.provokeButton = this.createButton(289, 541, 164, 58, 'PROVOCACION\n-15 EGO RIVAL', 0xa66cff, () => this.handlePlayerAction('provoke'));
    this.specialButton = this.createButton(478, 541, 178, 58, 'ATAQUE ESPECIAL\n35 DAÑO · 100% EGO', 0xeb3b5a, () => this.handlePlayerAction('special'));
    this.rollButton = this.createButton(695, 541, 190, 58, 'TIRAR DADO\nPOLITICO', 0xffd23f, () => this.rollPoliticalDie());
  }

  createButton(x, y, width, height, label, accent, onClick) {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#ffffff', align: 'center', lineSpacing: 3
    }).setOrigin(0.5);
    const container = this.add.container(x, y, [bg, text]);
    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

    const button = {
      container,
      text,
      enabled: true,
      hovered: false,
      setEnabled: value => {
        button.enabled = value;
        container.setScale(1);
        draw();
      }
    };

    const draw = () => {
      bg.clear();
      bg.fillStyle(button.enabled ? (button.hovered ? 0x263c5d : 0x121d30) : 0x0b101a, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      bg.lineStyle(2, button.enabled ? accent : 0x313a49, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
      text.setAlpha(button.enabled ? 1 : 0.34);
    };

    container.on('pointerover', () => {
      if (!button.enabled) return;
      button.hovered = true;
      container.setScale(1.025);
      draw();
    });
    container.on('pointerout', () => {
      button.hovered = false;
      container.setScale(1);
      draw();
    });
    container.on('pointerdown', () => {
      if (button.enabled) container.setScale(0.98);
    });
    container.on('pointerup', () => {
      if (!button.enabled) return;
      container.setScale(1.025);
      onClick();
    });
    draw();
    return button;
  }

  updateHud() {
    this.drawStatusBars(this.playerHud);
    this.drawStatusBars(this.enemyHud);
    const playerTurn = this.turn === 'player';
    this.turnBadgeBg.setFillStyle(playerTurn ? 0xffd23f : 0xeb3b5a, 1);
    this.turnBadge.setText(playerTurn ? 'TURNO P1' : 'TURNO IA');
    this.turnBadge.setColor(playerTurn ? '#111827' : '#ffffff');
  }

  drawStatusBars(hud) {
    const hp = Phaser.Math.Clamp(hud.fighter.hp, 0, 100);
    const ego = Phaser.Math.Clamp(hud.fighter.ego, 0, 100);
    hud.hpBar.clear();
    if (hp > 0) {
      hud.hpBar.fillStyle(hp > 50 ? 0x2ecc71 : hp > 25 ? 0xffd23f : 0xeb3b5a, 1);
      hud.hpBar.fillRoundedRect(hud.x + 52, hud.y + 38, 225 * hp / 100, 13, 4);
    }
    hud.egoBar.clear();
    if (ego > 0) {
      hud.egoBar.fillStyle(ego >= 100 ? 0xffd23f : 0xa66cff, 1);
      hud.egoBar.fillRoundedRect(hud.x + 52, hud.y + 64, 225 * ego / 100, 9, 4);
    }
    hud.hpText.setText(String(hp));
    hud.egoText.setText(`${ego}%`);
    hud.critical.setText(hud.fighter.multiplier > 1 ? 'CRITICO x2' : '');
  }

  updateControls() {
    const canAct = this.turn === 'player' && !this.actionInProgress && !this.gameEnded;
    this.normalButton.setEnabled(canAct);
    this.provokeButton.setEnabled(canAct);
    this.specialButton.setEnabled(canAct && this.player.ego >= 100);
    this.rollButton.setEnabled(canAct && !this.rollUsed);
  }

  async handlePlayerAction(action) {
    if (this.turn !== 'player' || this.actionInProgress || this.gameEnded) return;
    if (action === 'special' && this.player.ego < 100) return;

    this.actionInProgress = true;
    this.updateControls();
    await this.performAction(this.player, this.enemy, this.playerSprite, this.enemySprite, action);
    if (this.checkGameOver()) return;

    this.turn = 'ai';
    this.updateHud();
    this.logMessage(`${this.enemy.name} prepara su respuesta...`);
    await this.wait(1500);
    await this.runAiTurn();
  }

  async performAction(actor, target, actorSprite, targetSprite, action) {
    const animation = this.animateCombatAction(actorSprite, targetSprite, action);
    const audio = this.audioManager.play(actor, action);

    // La consecuencia se aplica únicamente cuando ambos procesos finalizaron.
    await Promise.all([animation, audio]);

    if (action === 'normal') {
      const damage = 15 * actor.multiplier;
      target.hp = Math.max(0, target.hp - damage);
      actor.ego = Math.min(100, actor.ego + 20);
      actor.multiplier = 1;
      this.logMessage(`${actor.name} causa ${damage} de daño y gana 20 de Ego.`);
      this.showFloatingValue(targetSprite, `-${damage}`, actor.color || 0xeb3b5a);
    } else if (action === 'provoke') {
      const removed = Math.min(15, target.ego);
      target.ego = Math.max(0, target.ego - 15);
      this.logMessage(`${actor.name} provoca a ${target.name}: -${removed} Ego.`);
      this.showFloatingValue(targetSprite, `-${removed} EGO`, 0xa66cff);
    } else if (action === 'special') {
      const damage = 35 * actor.multiplier;
      target.hp = Math.max(0, target.hp - damage);
      actor.ego = 0;
      actor.multiplier = 1;
      this.logMessage(`¡Especial de ${actor.name}! ${damage} de daño.`);
      this.showFloatingValue(targetSprite, `-${damage}`, 0xffd23f);
      this.cameras.main.flash(180, 255, 211, 63, false);
    }

    this.updateHud();
  }

  animateCombatAction(attackerSprite, targetSprite, action) {
    return new Promise(resolve => {
      const direction = targetSprite.x > attackerSprite.x ? 1 : -1;
      const startX = attackerSprite.getData('baseX');
      const destinationX = 400 - 70 * direction;

      if (action === 'provoke') {
        const bubble = this.add.text(400, 218, '¡BLA, BLA, BLA!', {
          fontFamily: 'Trebuchet MS, Arial', fontSize: '18px', fontStyle: 'bold', color: '#dabaff',
          backgroundColor: '#171022', padding: { x: 10, y: 6 }, stroke: '#05070d', strokeThickness: 4
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({ targets: bubble, y: 190, alpha: 0, duration: 700, onComplete: () => bubble.destroy() });
      }

      this.tweens.add({
        targets: attackerSprite,
        x: destinationX,
        scaleX: action === 'special' ? 1.18 : 1.1,
        scaleY: action === 'special' ? 1.18 : 1.1,
        duration: action === 'special' ? 250 : 205,
        hold: action === 'special' ? 150 : 90,
        yoyo: true,
        ease: 'Power2',
        onYoyo: () => {
          if (action !== 'provoke') {
            this.cameras.main.shake(action === 'special' ? 230 : 140, action === 'special' ? 0.012 : 0.006);
            this.tweens.add({ targets: targetSprite, alpha: 0.28, duration: 75, yoyo: true, repeat: 2 });
          }
        },
        onComplete: () => {
          attackerSprite.setX(startX).setScale(1);
          resolve();
        }
      });
    });
  }

  playCharacterVoice(fighter, action) {
    const key = AUDIO_KEYS[fighter.id];
    const phrase = this.getActionPhrase(fighter, action);

    if (key && this.cache.audio.exists(key)) {
      return new Promise(resolve => {
        let finished = false;
        let sound;
        const done = () => {
          if (finished) return;
          finished = true;
          timeout?.remove(false);
          if (sound) sound.destroy();
          resolve();
        };

        try {
          sound = this.sound.add(key);
          sound.once('complete', done);
          sound.once('stop', done);
          const started = sound.play();
          if (!started) {
            sound.destroy();
            return this.speakWithBrowser(phrase).then(resolve);
          }
        } catch (error) {
          console.warn(`No fue posible reproducir ${key}.`, error);
          return this.speakWithBrowser(phrase).then(resolve);
        }

        const timeout = this.time.delayedCall(9000, done);
      });
    }

    return this.speakWithBrowser(phrase);
  }

  getActionPhrase(fighter, action) {
    if (fighter.id === 'petro' && (action === 'provoke' || action === 'special')) {
      return 'Jajaja, los noto asustados';
    }
    if (action === 'provoke') return `¡${fighter.name} lanzó una provocación viral!`;
    if (action === 'special') return `¡Ataque especial de ${fighter.name}!`;
    return `¡${fighter.name} ataca!`;
  }

  speakWithBrowser(text) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CO';
      utterance.rate = 1.02;
      utterance.pitch = 0.94;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(voice => voice.lang.toLowerCase() === 'es-co')
        || voices.find(voice => voice.lang.toLowerCase() === 'es-es')
        || voices.find(voice => voice.lang.toLowerCase().startsWith('es'))
        || null;

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        timeout.remove(false);
        resolve();
      };
      utterance.onend = done;
      utterance.onerror = done;
      const timeout = this.time.delayedCall(Math.min(8000, Math.max(2500, text.length * 95)), done);
      window.speechSynthesis.speak(utterance);
    });
  }

  async rollPoliticalDie() {
    if (this.turn !== 'player' || this.actionInProgress || this.rollUsed || this.gameEnded) return;
    this.actionInProgress = true;
    this.rollUsed = true;
    this.updateControls();

    const roll = Phaser.Math.Between(1, 6);
    await this.animateDie(roll);

    if (roll === 1) {
      this.player.hp = Math.max(0, this.player.hp - 10);
      this.logMessage('¡Escándalo! P1 recibe 10 de daño y pierde el turno.');
      this.showFloatingValue(this.playerSprite, '-10', 0xeb3b5a);
      this.updateHud();
      if (this.checkGameOver()) return;
      this.turn = 'ai';
      this.updateHud();
      await this.wait(1500);
      await this.runAiTurn();
      return;
    }

    if (roll <= 3) {
      this.logMessage(`Dado ${roll}: sin beneficio. Todavía puedes ejecutar una acción.`);
    } else if (roll <= 5) {
      const healed = Math.min(15, 100 - this.player.hp);
      this.player.hp = Math.min(100, this.player.hp + 15);
      this.logMessage(`Dado ${roll}: ${this.player.name} recupera ${healed} HP.`);
      this.showFloatingValue(this.playerSprite, `+${healed}`, 0x2ecc71);
    } else {
      this.player.multiplier = 2;
      this.logMessage('¡Crítico político! El próximo ataque hará daño x2.');
    }

    this.actionInProgress = false;
    this.updateHud();
    this.updateControls();
  }

  animateDie(value) {
    return new Promise(resolve => {
      this.dieText.setText(String(value));
      this.dieBg.setScale(0.55).setAngle(-20);
      this.dieText.setScale(0.55).setAngle(-20);
      this.tweens.add({
        targets: [this.dieBg, this.dieText],
        scale: 1,
        angle: 0,
        duration: 460,
        ease: 'Back.easeOut',
        onComplete: resolve
      });
    });
  }

  async runAiTurn() {
    if (this.gameEnded) return;
    this.turn = 'ai';
    this.actionInProgress = true;
    this.updateHud();
    this.updateControls();

    let action = 'normal';
    if (this.enemy.ego >= 100) {
      action = 'special';
    } else if (this.player.ego >= 30 && Phaser.Math.Between(1, 100) <= 30) {
      action = 'provoke';
    }

    this.logMessage(`${this.enemy.name} eligió ${this.actionLabel(action)}.`);
    await this.performAction(this.enemy, this.player, this.enemySprite, this.playerSprite, action);
    if (this.checkGameOver()) return;

    await this.wait(550);
    this.beginPlayerTurn();
  }

  beginPlayerTurn() {
    this.turn = 'player';
    this.actionInProgress = false;
    this.rollUsed = false;
    this.dieText.setText('?');
    this.logMessage(`Turno de ${this.player.name}. Elige una acción.`);
    this.updateHud();
    this.updateControls();
  }

  actionLabel(action) {
    if (action === 'provoke') return 'Provocación';
    if (action === 'special') return 'Ataque Especial';
    return 'Ataque Normal';
  }

  showFloatingValue(targetSprite, value, color) {
    const label = this.add.text(targetSprite.x, targetSprite.y - 168, value, {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '25px', fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#05070d', strokeThickness: 6
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: label,
      y: label.y - 38,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  logMessage(message) {
    this.logText?.setText(`> ${message}`);
  }

  wait(milliseconds) {
    return new Promise(resolve => this.time.delayedCall(milliseconds, resolve));
  }

  checkGameOver() {
    if (this.player.hp > 0 && this.enemy.hp > 0) return false;
    this.gameEnded = true;
    this.actionInProgress = false;
    this.updateControls();
    this.showGameOver(this.enemy.hp <= 0);
    return true;
  }

  showGameOver(playerWon) {
    const winner = playerWon ? this.player : this.enemy;
    this.add.rectangle(400, 300, 800, 600, 0x03050a, 0.9).setDepth(50).setInteractive();
    const card = this.add.graphics().setDepth(51);
    card.fillStyle(0x101a2c, 1);
    card.fillRoundedRect(155, 155, 490, 300, 18);
    card.lineStyle(4, playerWon ? 0xffd23f : 0xeb3b5a, 1);
    card.strokeRoundedRect(155, 155, 490, 300, 18);

    this.add.text(400, 214, playerWon ? '¡VICTORIA!' : 'DERROTA', {
      fontFamily: 'Trebuchet MS, Arial', fontSize: '47px', fontStyle: 'bold',
      color: playerWon ? '#ffd23f' : '#ff526f', stroke: '#05070d', strokeThickness: 7
    }).setOrigin(0.5).setDepth(52);
    this.add.text(400, 276, `${winner.name} ganó el combate político.`, {
      fontFamily: 'Arial', fontSize: '19px', color: '#e9f0fb'
    }).setOrigin(0.5).setDepth(52);

    const rematch = this.createButton(280, 365, 190, 52, 'REVANCHA', 0xffd23f, () => {
      this.scene.restart(this.selectionData);
    });
    const select = this.createButton(510, 365, 220, 52, 'CAMBIAR LUCHADORES', 0x2f80ed, () => {
      this.scene.start('SelectScene');
    });
    rematch.container.setDepth(53);
    select.container.setDepth(53);
  }
}
