export const CHARACTER_CATEGORIES = Object.freeze({
  ACTUALIDAD: 'Actualidad y Opinión',
  FITNESS: 'Fitness y Salud',
  ENTRETENIMIENTO: 'Cultura y Entretenimiento',
  COTIDIANIDAD: 'Calle y Cotidianidad'
});

const { ACTUALIDAD, FITNESS, ENTRETENIMIENTO, COTIDIANIDAD } = CHARACTER_CATEGORIES;
const imagePath = fileName => `assets/images/${fileName}`;

function createCharacter(config) {
  const portrait = config.portraitKey || `${config.id}_portrait`;
  const headSprite = config.headKey || (config.headFile ? `${config.id}_head` : portrait);
  const portraitAsset = imagePath(config.portraitFile);
  const headSpriteAsset = imagePath(config.headFile || config.portraitFile);
  return Object.freeze({
    id: config.id,
    name: config.name,
    category: config.category,
    active: config.active !== false,
    isBoss: config.isBoss === true,
    portrait,
    headSprite,
    portraitAsset,
    headSpriteAsset,
    // Alias legacy: permiten que escenas antiguas sigan funcionando durante la migración.
    texture: portrait,
    selectionAsset: portraitAsset,
    headTexture: headSprite,
    headAsset: headSpriteAsset,
    color: config.color,
    challengeQuotes: config.challengeQuotes || [`${config.name} llegó listo para armar la guachafita.`],
    victoryQuotes: config.victoryQuotes || [`${config.name} se queda con el round y con la última palabra.`],
    arcadeEnding: config.arcadeEnding || `${config.name} ganó Guachafita Strike y convirtió el país en su propia arena arcade.`,
    special: config.special || { name: 'Golpe de Opinión', damage: 16, range: 235, knockback: 365, cooldown: 630 },
    ultimate: config.ultimate || { name: 'Guachafita Total', damage: 30, range: 325, knockback: 510, freezeMs: 690, cooldown: 1140 }
  });
}

export const ARCADE_BOSS = createCharacter({
  id: 'amparo_grisales', name: 'Amparo Grisales', category: 'Boss Arcade', active: false, isBoss: true,
  portraitFile: 'AmparoGrisales.png', color: 0xc96cff,
  challengeQuotes: ['Llegaste a la final; ahora convénceme con estilo.', 'Aquí no basta pelear: hay que deslumbrar.'],
  victoryQuotes: ['Te faltó actitud, presencia y un poquito de brillo.', 'La experiencia no se cuenta: se nota en el marcador.'],
  arcadeEnding: 'Amparo convirtió el país en un casting eterno: cada decreto recibió puntuación, luces y una pausa dramática antes del veredicto.',
  special: { name: 'Crítica Implacable', damage: 19, range: 250, knockback: 420, cooldown: 620 },
  ultimate: { name: 'Yo Me Llamo Boss', damage: 35, range: 350, knockback: 590, freezeMs: 780, cooldown: 1200 }
});

export const CHARACTERS = Object.freeze([
  createCharacter({
    id: 'abelardo', name: 'Abelardo', category: ACTUALIDAD,
    portraitKey: 'abelardo_eleccion', portraitFile: 'abelardo_eleccion.png', headKey: 'abelardo_head', headFile: 'abelardo_head.png', color: 0x2f80ed,
    challengeQuotes: ['Hoy la tarima se convierte en selva.', 'Que suene la campana: el tigre ya despertó.'],
    victoryQuotes: ['El tigre no pidió segunda vuelta: resolvió en el primer round.', 'Mucho discurso, pero el zarpazo quedó en el marcador.'],
    arcadeEnding: 'Abelardo declaró a Colombia reserva natural del buen humor. Cada debate comenzó con rugido reglamentario y terminó antes de que alguien sacara otra encuesta.',
    special: { name: 'Zarpazo del Tigre', damage: 16, range: 230, knockback: 340, cooldown: 620 },
    ultimate: { name: 'Mordida del Tigre', damage: 30, range: 320, knockback: 520, freezeMs: 650, cooldown: 1100 }
  }),
  createCharacter({
    id: 'petro', name: 'Petro', category: ACTUALIDAD,
    portraitKey: 'petro_eleccion', portraitFile: 'petro_eleccion.png', headKey: 'petro_head', headFile: 'petro_head.png', color: 0xeb3b5a,
    challengeQuotes: ['Esta pelea también necesita un cambio.', 'Prepárate: hoy el marcador cambia de rumbo.'],
    victoryQuotes: ['El cambio llegó hasta tu barra de vida.', 'La remontada estaba escrita en el programa de combate.'],
    arcadeEnding: 'Petro transformó la Casa de Nariño en una enorme asamblea arcade. Los discursos duraban tres combos y toda reforma debía superar primero una pelea de jefe.',
    special: { name: 'Primera Línea', damage: 15, range: 245, knockback: 365, cooldown: 640 },
    ultimate: { name: 'Chorreo Populista', damage: 29, range: 330, knockback: 500, freezeMs: 700, cooldown: 1150 }
  }),
  createCharacter({
    id: 'uribe', name: 'Uribe', category: ACTUALIDAD,
    portraitKey: 'uribe_eleccion', portraitFile: 'uribe_eleccion.png', headKey: 'uribe_head', headFile: 'uribe_head.png', color: 0x5aa9e6,
    challengeQuotes: ['Este combate se gana con mano firme y combo corto.', 'Venga pues, que aquí no se pelea por Twitter.'],
    victoryQuotes: ['Le di en la jugada, muchacho.', 'Este round fue democrático: ganó mi combo.'],
    arcadeEnding: 'Uribe administró el país como una finca de entrenamiento: madrugón, vuelta por el escenario y reunión de seguridad antes del desayuno pixelado.',
    special: { name: 'Defensa del Ubérrimo', damage: 14, range: 220, knockback: 410, cooldown: 650 },
    ultimate: { name: 'Estado de Opinión', damage: 28, range: 315, knockback: 540, freezeMs: 680, cooldown: 1180 }
  }),
  createCharacter({
    id: 'polopolo', name: 'Polo Polo', category: ACTUALIDAD,
    portraitKey: 'polopolo_eleccion', portraitFile: 'polopolo_eleccion.png', headKey: 'polopolo_head', headFile: 'polopolo_head.png', color: 0xff9f43,
    challengeQuotes: ['Este duelo ya tiene tendencia y todavía no empieza.', 'Sonríe: el próximo combo será contenido viral.'],
    victoryQuotes: ['Esta victoria ya es tendencia nacional.', 'Te funó el marcador antes que las redes.'],
    arcadeEnding: 'Polo Polo instaló un contador de tendencias en cada plaza. Los decretos solo entraban en vigor después de alcanzar diez mil reacciones y sobrevivir al chat del país.',
    special: { name: 'Funada Masiva', damage: 16, range: 250, knockback: 330, cooldown: 610 },
    ultimate: { name: 'Tendencia Nacional', damage: 29, range: 345, knockback: 475, freezeMs: 700, cooldown: 1140 }
  }),
  createCharacter({ id: 'santos', name: 'Santos', category: ACTUALIDAD, portraitFile: 'JuanManuelSantos.png', color: 0x8da0cb, challengeQuotes: ['Podemos acordar la pelea, pero no el resultado.', 'Primero el saludo; después, el combo diplomático.'], victoryQuotes: ['Firmamos la paz… con el marcador.', 'La palomita aterrizó justo sobre tu barra de vida.'], arcadeEnding: 'Santos fundó el Ministerio del Apretón de Manos. Toda disputa nacional se resolvía con una mesa, tres cámaras y un último round cuidadosamente negociado.', special: { name: 'Palomita de la Paz', damage: 14, range: 240, knockback: 350, cooldown: 600 }, ultimate: { name: 'Acuerdo Final', damage: 27, range: 340, knockback: 490, freezeMs: 720, cooldown: 1120 } }),
  createCharacter({ id: 'cabal', name: 'Cabal', category: ACTUALIDAD, portraitFile: 'MariaFernandaCabal.png', color: 0xd46fbd, challengeQuotes: ['El debate empieza cuando yo lanzo el primer golpe.', 'Traje argumentos; vienen con knockback.'], victoryQuotes: ['El debate quedó cerrado por nocaut.', 'Te faltó réplica y te sobró barra vacía.'], arcadeEnding: 'Cabal convirtió cada sesión del Congreso en combate estelar. Las proposiciones llegaban con guantes y nadie se atrevía a pedir una moción sin barra de Súper.', special: { name: 'Furia del Senado', damage: 17, range: 225, knockback: 380, cooldown: 670 }, ultimate: { name: 'Debate Incendiario', damage: 31, range: 310, knockback: 510, freezeMs: 640, cooldown: 1160 } }),
  createCharacter({ id: 'epa_colombia', name: 'Epa Colombia', category: ACTUALIDAD, portraitFile: 'EpaColombia.png', color: 0xff5fa2, challengeQuotes: ['Amiga, hoy sales del ring con keratina y aprendizaje.', 'Esta pelea va a quedar divina, pero no para ti.'], victoryQuotes: ['Amiga, te dejé el ego divino y la vida en cero.', 'La keratina quedó firme; tu defensa, no tanto.'], arcadeEnding: 'Epa Colombia abrió una keratinería en cada ministerio. El país quedó brillante, emprendedor y obligado a confirmar cada cita antes del consejo de ministros.', special: { name: 'Keratina Letal', damage: 16, range: 235, knockback: 360, cooldown: 620 }, ultimate: { name: 'Imperio de la Keratina', damage: 30, range: 325, knockback: 505, freezeMs: 720, cooldown: 1130 } }),
  createCharacter({ id: 'pechi_player', name: 'Pechi Player', category: FITNESS, portraitFile: 'PechyPlayer.png', color: 0x35d07f, challengeQuotes: ['Calienta bien: este round va hasta el fallo.', 'Hoy toca pierna, cardio y esquivar mis combos.'], victoryQuotes: ['No fue suerte: fueron repeticiones.', 'Llegaste al fallo… pero del lado equivocado.'], arcadeEnding: 'Pechi Player transformó Colombia en un gimnasio continental. El presupuesto se midió en repeticiones y cada lunes fue oficialmente día de pierna.', special: { name: 'Rutina al Fallo', damage: 18, range: 215, knockback: 395, cooldown: 680 }, ultimate: { name: 'Modo Bestia', damage: 32, range: 300, knockback: 550, freezeMs: 620, cooldown: 1200 } }),
  createCharacter({ id: 'dr_bayter', name: 'Dr. Bayter', category: FITNESS, portraitFile: 'DocBayter.png', color: 0x55b7ff, challengeQuotes: ['Ese combo tiene demasiados carbohidratos.', 'Tu estrategia necesita disciplina metabólica.'], victoryQuotes: ['Cero azúcar, cero excusas y cien por ciento victoria.', 'Tu barra de vida salió de cetosis.'], arcadeEnding: 'Dr. Bayter puso al país en modo keto. El pan pasó a la clandestinidad, los aguacates cotizaron en bolsa y cada consejo comunitario empezó leyendo etiquetas.', special: { name: 'Dieta Keto', damage: 15, range: 250, knockback: 345, cooldown: 600 }, ultimate: { name: 'Código Bayter', damage: 29, range: 335, knockback: 500, freezeMs: 710, cooldown: 1150 } }),
  createCharacter({ id: 'chico_gel', name: 'Chico Gel', category: FITNESS, portraitFile: 'ChicoGel.png', color: 0xf6c445, challengeQuotes: ['Mi peinado aguanta más golpes que tu defensa.', 'Hoy vas a conocer la fijación de combate.'], victoryQuotes: ['La victoria quedó fija todo el día.', 'Ni el knockback pudo despeinarme.'], arcadeEnding: 'Chico Gel decretó peinado resistente como política de Estado. Ni la inflación, ni la lluvia, ni una Ulti lograron mover un solo cabello nacional.', special: { name: 'Golpe Fijador', damage: 17, range: 225, knockback: 375, cooldown: 650 }, ultimate: { name: 'Fijación Extrema', damage: 31, range: 315, knockback: 525, freezeMs: 680, cooldown: 1180 } }),
  createCharacter({ id: 'colombiano_promedio', name: 'Colombiano Promedio', category: COTIDIANIDAD, portraitFile: 'ColombianoPromedio.png', color: 0xf0b44d, special: { name: 'Quincena Eterna', damage: 16, range: 230, knockback: 350, cooldown: 620 }, ultimate: { name: 'Rebusque Nacional', damage: 30, range: 325, knockback: 500, freezeMs: 680, cooldown: 1140 } }),
  createCharacter({ id: 'diomedez', name: 'Diomedez', category: ENTRETENIMIENTO, portraitFile: 'Diomedez.png', color: 0xe35d6a, special: { name: 'Nota Vallenata', damage: 17, range: 245, knockback: 370, cooldown: 630 }, ultimate: { name: 'Concierto Infinito', damage: 31, range: 340, knockback: 515, freezeMs: 700, cooldown: 1160 } }),
  createCharacter({ id: 'el_busetero', name: 'El Busetero', category: COTIDIANIDAD, portraitFile: 'ElBusetero.png', color: 0xf29b38, special: { name: 'Frenazo Sorpresa', damage: 17, range: 230, knockback: 405, cooldown: 640 }, ultimate: { name: 'Ruta Fuera de Servicio', damage: 31, range: 330, knockback: 545, freezeMs: 690, cooldown: 1170 } }),
  createCharacter({ id: 'el_del_billar', name: 'El del Billar', category: COTIDIANIDAD, portraitFile: 'ElDelBillar.png', color: 0x3ebd89, special: { name: 'Carambola Triple', damage: 18, range: 250, knockback: 380, cooldown: 650 }, ultimate: { name: 'Taco Maestro', damage: 32, range: 335, knockback: 520, freezeMs: 710, cooldown: 1180 } }),
  createCharacter({ id: 'gallina', name: 'Gallina', category: COTIDIANIDAD, portraitFile: 'Gallina.png', color: 0xffcf5a, special: { name: 'Picotazo Criollo', damage: 15, range: 220, knockback: 360, cooldown: 590 }, ultimate: { name: 'Rebelión del Corral', damage: 29, range: 315, knockback: 490, freezeMs: 650, cooldown: 1100 } }),
  createCharacter({ id: 'gota_a_gota', name: 'Gota a Gota', category: COTIDIANIDAD, portraitFile: 'GotaAGota.png', color: 0x66b7a5, special: { name: 'Interés Diario', damage: 17, range: 235, knockback: 365, cooldown: 620 }, ultimate: { name: 'Cobro Acumulado', damage: 32, range: 325, knockback: 530, freezeMs: 740, cooldown: 1200 } }),
  createCharacter({ id: 'la_abuela', name: 'La Abuela', category: COTIDIANIDAD, portraitFile: 'LaAbuela.png', color: 0xc98acb, special: { name: 'Chancla Teledirigida', damage: 18, range: 270, knockback: 380, cooldown: 640 }, ultimate: { name: 'Aquí Mando Yo', damage: 33, range: 345, knockback: 540, freezeMs: 750, cooldown: 1200 } }),
  createCharacter({ id: 'la_marimonda', name: 'La Marimonda', category: ENTRETENIMIENTO, portraitFile: 'LaMarimonda.png', color: 0xff5cb8, special: { name: 'Mueca Carnavalera', damage: 16, range: 245, knockback: 360, cooldown: 600 }, ultimate: { name: 'Carnaval Total', damage: 31, range: 350, knockback: 510, freezeMs: 700, cooldown: 1160 } }),
  createCharacter({ id: 'maduro', name: 'Maduro', category: ACTUALIDAD, portraitFile: 'Maduro.png', color: 0xd34e55, special: { name: 'Cadena Nacional', damage: 16, range: 250, knockback: 350, cooldown: 650 }, ultimate: { name: 'Pajarito Supremo', damage: 30, range: 340, knockback: 520, freezeMs: 730, cooldown: 1190 } }),
  createCharacter({ id: 'modelo_only', name: 'Modelo Only', category: ENTRETENIMIENTO, portraitFile: 'ModeloOnly.png', color: 0xf06db3, special: { name: 'Contenido Exclusivo', damage: 17, range: 230, knockback: 365, cooldown: 610 }, ultimate: { name: 'Suscripción Premium', damage: 31, range: 325, knockback: 510, freezeMs: 690, cooldown: 1150 } }),
  createCharacter({ id: 'padre_jaramillo', name: 'Padre Jaramillo', category: ENTRETENIMIENTO, portraitFile: 'PadreJaramillo.png', color: 0x9c8bd7, special: { name: 'Sermón Relámpago', damage: 16, range: 260, knockback: 355, cooldown: 630 }, ultimate: { name: 'Exorcismo Arcade', damage: 32, range: 345, knockback: 525, freezeMs: 760, cooldown: 1200 } }),
  createCharacter({ id: 'pirry', name: 'Pirry', category: ACTUALIDAD, portraitFile: 'Pirry.png', color: 0x55a7cc, special: { name: 'Crónica Incómoda', damage: 17, range: 250, knockback: 370, cooldown: 640 }, ultimate: { name: 'Informe Especial', damage: 31, range: 340, knockback: 515, freezeMs: 720, cooldown: 1180 } }),
  createCharacter({ id: 'policia', name: 'Policía', category: COTIDIANIDAD, portraitFile: 'Policia.png', color: 0x4b9b65, special: { name: 'Comparendo Express', damage: 16, range: 240, knockback: 390, cooldown: 630 }, ultimate: { name: 'Operativo Nacional', damage: 31, range: 330, knockback: 540, freezeMs: 710, cooldown: 1190 } }),
  createCharacter({ id: 'shakira', name: 'Shakira', category: ENTRETENIMIENTO, portraitFile: 'Shakira.png', color: 0xf2c94c, special: { name: 'Cadera Certera', damage: 18, range: 235, knockback: 380, cooldown: 610 }, ultimate: { name: 'Waka Waka Final', damage: 33, range: 350, knockback: 535, freezeMs: 720, cooldown: 1200 } }),
  createCharacter({ id: 'trabajador_rappi', name: 'Trabajador de Rappi', category: COTIDIANIDAD, portraitFile: 'TrabajadorDeRappi.png', color: 0xff5a49, special: { name: 'Entrega Relámpago', damage: 17, range: 245, knockback: 375, cooldown: 600 }, ultimate: { name: 'Pedido Prioritario', damage: 31, range: 335, knockback: 520, freezeMs: 680, cooldown: 1150 } }),
  ARCADE_BOSS
]);

export const ACTIVE_CHARACTERS = Object.freeze(CHARACTERS.filter(character => character.active !== false));
export const CHARACTER_BY_ID = Object.freeze(Object.fromEntries(CHARACTERS.map(character => [character.id, character])));

export function preloadCharacterAssets(scene, characters = CHARACTERS) {
  const queuedKeys = new Set();
  characters.forEach(character => {
    [
      [character.portrait, character.portraitAsset],
      [character.headSprite, character.headSpriteAsset]
    ].forEach(([textureKey, assetPath]) => {
      if (!textureKey || !assetPath || queuedKeys.has(textureKey) || scene.textures.exists(textureKey)) return;
      queuedKeys.add(textureKey);
      scene.load.image(textureKey, assetPath);
    });
  });
}
