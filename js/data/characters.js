export const CHARACTER_CATEGORIES = Object.freeze({
  ACTUALIDAD: 'Actualidad y Opinión',
  FITNESS: 'Fitness y Salud'
});

const actualidad = CHARACTER_CATEGORIES.ACTUALIDAD;
const fitness = CHARACTER_CATEGORIES.FITNESS;

export const ARCADE_BOSS = Object.freeze({
  id: 'amparo_grisales',
  name: 'Amparo Grisales',
  category: 'Boss Arcade',
  active: false,
  isBoss: true,
  texture: 'amparo_grisales_eleccion',
  selectionAsset: null,
  headTexture: 'amparo_grisales_head',
  headAsset: null,
  color: 0xc96cff,
  challengeQuotes: ['Llegaste a la final; ahora convénceme con estilo.', 'Aquí no basta pelear: hay que deslumbrar.'],
  victoryQuotes: ['Te faltó actitud, presencia y un poquito de brillo.', 'La experiencia no se cuenta: se nota en el marcador.'],
  arcadeEnding: 'Amparo convirtió el país en un casting eterno: cada decreto recibió puntuación, luces y una pausa dramática antes del veredicto.',
  special: { name: 'Crítica Implacable', damage: 19, range: 250, knockback: 420, cooldown: 620 },
  ultimate: { name: 'Yo Me Llamo Boss', damage: 35, range: 350, knockback: 590, freezeMs: 780, cooldown: 1200 }
});

export const CHARACTERS = Object.freeze([
  {
    id: 'abelardo',
    name: 'Abelardo',
    category: actualidad,
    texture: 'abelardo_eleccion',
    selectionAsset: 'assets/images/abelardo_eleccion.png',
    headTexture: 'abelardo_head',
    headAsset: 'assets/images/abelardo_head.png',
    color: 0x2f80ed,
    challengeQuotes: ['Hoy la tarima se convierte en selva.', 'Que suene la campana: el tigre ya despertó.'],
    victoryQuotes: ['El tigre no pidió segunda vuelta: resolvió en el primer round.', 'Mucho discurso, pero el zarpazo quedó en el marcador.'],
    arcadeEnding: 'Abelardo declaró a Colombia reserva natural del buen humor. Cada debate comenzó con rugido reglamentario y terminó antes de que alguien sacara otra encuesta.',
    special: { name: 'Zarpazo del Tigre', damage: 16, range: 230, knockback: 340, cooldown: 620 },
    ultimate: { name: 'Mordida del Tigre', damage: 30, range: 320, knockback: 520, freezeMs: 650, cooldown: 1100 }
  },
  {
    id: 'petro',
    name: 'Petro',
    category: actualidad,
    texture: 'petro_eleccion',
    selectionAsset: 'assets/images/petro_eleccion.png',
    headTexture: 'petro_head',
    headAsset: 'assets/images/petro_head.png',
    color: 0xeb3b5a,
    challengeQuotes: ['Esta pelea también necesita un cambio.', 'Prepárate: hoy el marcador cambia de rumbo.'],
    victoryQuotes: ['El cambio llegó hasta tu barra de vida.', 'La remontada estaba escrita en el programa de combate.'],
    arcadeEnding: 'Petro transformó la Casa de Nariño en una enorme asamblea arcade. Los discursos duraban tres combos y toda reforma debía superar primero una pelea de jefe.',
    special: { name: 'Primera Línea', damage: 15, range: 245, knockback: 365, cooldown: 640 },
    ultimate: { name: 'Chorreo Populista', damage: 29, range: 330, knockback: 500, freezeMs: 700, cooldown: 1150 }
  },
  {
    id: 'uribe',
    name: 'Uribe',
    category: actualidad,
    texture: 'uribe_eleccion',
    selectionAsset: 'assets/images/uribe_eleccion.png',
    headTexture: 'uribe_head',
    headAsset: 'assets/images/uribe_head.png',
    color: 0x5aa9e6,
    challengeQuotes: ['Este combate se gana con mano firme y combo corto.', 'Venga pues, que aquí no se pelea por Twitter.'],
    victoryQuotes: ['Le di en la jugada, muchacho.', 'Este round fue democrático: ganó mi combo.'],
    arcadeEnding: 'Uribe administró el país como una finca de entrenamiento: madrugón, vuelta por el escenario y reunión de seguridad antes del desayuno pixelado.',
    special: { name: 'Defensa del Ubérrimo', damage: 14, range: 220, knockback: 410, cooldown: 650 },
    ultimate: { name: 'Estado de Opinión', damage: 28, range: 315, knockback: 540, freezeMs: 680, cooldown: 1180 }
  },
  {
    id: 'santos',
    name: 'Santos',
    category: actualidad,
    texture: 'santos_eleccion',
    selectionAsset: 'assets/images/JuanManuelSantos.png',
    headTexture: 'santos_head',
    headAsset: 'assets/images/JuanManuelSantos.png',
    color: 0x8da0cb,
    challengeQuotes: ['Podemos acordar la pelea, pero no el resultado.', 'Primero el saludo; después, el combo diplomático.'],
    victoryQuotes: ['Firmamos la paz… con el marcador.', 'La palomita aterrizó justo sobre tu barra de vida.'],
    arcadeEnding: 'Santos fundó el Ministerio del Apretón de Manos. Toda disputa nacional se resolvía con una mesa, tres cámaras y un último round cuidadosamente negociado.',
    special: { name: 'Palomita de la Paz', damage: 14, range: 240, knockback: 350, cooldown: 600 },
    ultimate: { name: 'Acuerdo Final', damage: 27, range: 340, knockback: 490, freezeMs: 720, cooldown: 1120 }
  },
  {
    id: 'cabal',
    name: 'Cabal',
    category: actualidad,
    texture: 'cabal_eleccion',
    selectionAsset: 'assets/images/MariaFernandaCabal.png',
    headTexture: 'cabal_head',
    headAsset: 'assets/images/MariaFernandaCabal.png',
    color: 0xd46fbd,
    challengeQuotes: ['El debate empieza cuando yo lanzo el primer golpe.', 'Traje argumentos; vienen con knockback.'],
    victoryQuotes: ['El debate quedó cerrado por nocaut.', 'Te faltó réplica y te sobró barra vacía.'],
    arcadeEnding: 'Cabal convirtió cada sesión del Congreso en combate estelar. Las proposiciones llegaban con guantes y nadie se atrevía a pedir una moción sin barra de Súper.',
    special: { name: 'Furia del Senado', damage: 17, range: 225, knockback: 380, cooldown: 670 },
    ultimate: { name: 'Debate Incendiario', damage: 31, range: 310, knockback: 510, freezeMs: 640, cooldown: 1160 }
  },
  {
    id: 'polopolo',
    name: 'Polo Polo',
    category: actualidad,
    texture: 'polopolo_eleccion',
    selectionAsset: 'assets/images/polopolo_eleccion.png',
    headTexture: 'polopolo_head',
    headAsset: 'assets/images/polopolo_head.png',
    color: 0xff9f43,
    challengeQuotes: ['Este duelo ya tiene tendencia y todavía no empieza.', 'Sonríe: el próximo combo será contenido viral.'],
    victoryQuotes: ['Esta victoria ya es tendencia nacional.', 'Te funó el marcador antes que las redes.'],
    arcadeEnding: 'Polo Polo instaló un contador de tendencias en cada plaza. Los decretos solo entraban en vigor después de alcanzar diez mil reacciones y sobrevivir al chat del país.',
    special: { name: 'Funada Masiva', damage: 16, range: 250, knockback: 330, cooldown: 610 },
    ultimate: { name: 'Tendencia Nacional', damage: 29, range: 345, knockback: 475, freezeMs: 700, cooldown: 1140 }
  },
  {
    id: 'epa_colombia',
    name: 'Epa Colombia',
    category: actualidad,
    texture: 'epa_colombia_eleccion',
    selectionAsset: 'assets/images/EpaColombia.png',
    headTexture: 'epa_colombia_head',
    headAsset: 'assets/images/EpaColombia.png',
    color: 0xff5fa2,
    challengeQuotes: ['Amiga, hoy sales del ring con keratina y aprendizaje.', 'Esta pelea va a quedar divina, pero no para ti.'],
    victoryQuotes: ['Amiga, te dejé el ego divino y la vida en cero.', 'La keratina quedó firme; tu defensa, no tanto.'],
    arcadeEnding: 'Epa Colombia abrió una keratinería en cada ministerio. El país quedó brillante, emprendedor y obligado a confirmar cada cita antes del consejo de ministros.',
    special: { name: 'Keratina Letal', damage: 16, range: 235, knockback: 360, cooldown: 620 },
    ultimate: { name: 'Imperio de la Keratina', damage: 30, range: 325, knockback: 505, freezeMs: 720, cooldown: 1130 }
  },
  {
    id: 'pechi_player',
    name: 'Pechi Player',
    category: fitness,
    texture: 'pechi_player_eleccion',
    selectionAsset: 'assets/images/PechyPlayer.png',
    headTexture: 'pechi_player_head',
    headAsset: 'assets/images/PechyPlayer.png',
    color: 0x35d07f,
    challengeQuotes: ['Calienta bien: este round va hasta el fallo.', 'Hoy toca pierna, cardio y esquivar mis combos.'],
    victoryQuotes: ['No fue suerte: fueron repeticiones.', 'Llegaste al fallo… pero del lado equivocado.'],
    arcadeEnding: 'Pechi Player transformó Colombia en un gimnasio continental. El presupuesto se midió en repeticiones y cada lunes fue oficialmente día de pierna.',
    special: { name: 'Rutina al Fallo', damage: 18, range: 215, knockback: 395, cooldown: 680 },
    ultimate: { name: 'Modo Bestia', damage: 32, range: 300, knockback: 550, freezeMs: 620, cooldown: 1200 }
  },
  {
    id: 'dr_bayter',
    name: 'Dr. Bayter',
    category: fitness,
    texture: 'dr_bayter_eleccion',
    selectionAsset: 'assets/images/DocBayter.png',
    headTexture: 'dr_bayter_head',
    headAsset: 'assets/images/DocBayter.png',
    color: 0x55b7ff,
    challengeQuotes: ['Ese combo tiene demasiados carbohidratos.', 'Tu estrategia necesita disciplina metabólica.'],
    victoryQuotes: ['Cero azúcar, cero excusas y cien por ciento victoria.', 'Tu barra de vida salió de cetosis.'],
    arcadeEnding: 'Dr. Bayter puso al país en modo keto. El pan pasó a la clandestinidad, los aguacates cotizaron en bolsa y cada consejo comunitario empezó leyendo etiquetas.',
    special: { name: 'Dieta Keto', damage: 15, range: 250, knockback: 345, cooldown: 600 },
    ultimate: { name: 'Código Bayter', damage: 29, range: 335, knockback: 500, freezeMs: 710, cooldown: 1150 }
  },
  {
    id: 'chico_gel',
    name: 'Chico Gel',
    category: fitness,
    texture: 'chico_gel_eleccion',
    selectionAsset: 'assets/images/ChicoGel.png',
    headTexture: 'chico_gel_head',
    headAsset: 'assets/images/ChicoGel.png',
    color: 0xf6c445,
    challengeQuotes: ['Mi peinado aguanta más golpes que tu defensa.', 'Hoy vas a conocer la fijación de combate.'],
    victoryQuotes: ['La victoria quedó fija todo el día.', 'Ni el knockback pudo despeinarme.'],
    arcadeEnding: 'Chico Gel decretó peinado resistente como política de Estado. Ni la inflación, ni la lluvia, ni una Ulti lograron mover un solo cabello nacional.',
    special: { name: 'Golpe Fijador', damage: 17, range: 225, knockback: 375, cooldown: 650 },
    ultimate: { name: 'Fijación Extrema', damage: 31, range: 315, knockback: 525, freezeMs: 680, cooldown: 1180 }
  },
  ARCADE_BOSS
]);

export const ACTIVE_CHARACTERS = Object.freeze(
  CHARACTERS.filter(character => character.active !== false)
);

export const CHARACTER_BY_ID = Object.freeze(
  Object.fromEntries(CHARACTERS.map(character => [character.id, character]))
);
