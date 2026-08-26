const svgDataUri = source => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

const farArt = ({ top, bottom, sun, hills }) => svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <rect width="1400" height="620" fill="url(#sky)"/>
    <circle cx="700" cy="205" r="112" fill="${sun}" opacity=".68"/>
    <path d="${hills}" fill="#11192d" opacity=".68"/>
    <g fill="#fff1bd" opacity=".5"><circle cx="130" cy="105" r="3"/><circle cx="286" cy="150" r="4"/><circle cx="1120" cy="92" r="3"/><circle cx="1260" cy="145" r="4"/></g>
  </svg>`);

const plazaMidArt = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">
    <rect x="115" y="300" width="1170" height="252" rx="8" fill="#d4b568"/><rect x="90" y="278" width="1220" height="34" fill="#f4dc9d"/><path d="M75 278L700 170 1325 278Z" fill="#29344d"/>
    <g fill="#f6e9c4"><rect x="180" y="322" width="42" height="220"/><rect x="320" y="322" width="42" height="220"/><rect x="460" y="322" width="42" height="220"/><rect x="898" y="322" width="42" height="220"/><rect x="1038" y="322" width="42" height="220"/><rect x="1178" y="322" width="42" height="220"/></g>
    <g fill="#352b3d"><rect x="584" y="328" width="232" height="214"/><rect x="245" y="365" width="44" height="74"/><rect x="1110" y="365" width="44" height="74"/></g><rect y="542" width="1400" height="78" fill="#5d5461"/>
  </svg>`);

const vallenatoMidArt = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">
    <path d="M90 470Q250 180 410 470M990 470Q1150 180 1310 470" fill="none" stroke="#f1c55a" stroke-width="24"/><path d="M160 470Q250 290 340 470M1060 470Q1150 290 1240 470" fill="none" stroke="#e05b49" stroke-width="12"/>
    <rect x="300" y="338" width="800" height="210" rx="22" fill="#152d4a"/><rect x="350" y="382" width="700" height="126" fill="#071425"/>
    <g fill="#58c6dc"><rect x="390" y="420" width="14" height="50"/><rect x="430" y="400" width="14" height="70"/><rect x="470" y="430" width="14" height="40"/><rect x="910" y="405" width="14" height="65"/><rect x="950" y="425" width="14" height="45"/></g>
    <circle cx="700" cy="416" r="66" fill="#e85a4f"/><circle cx="700" cy="416" r="46" fill="#f3c65c"/><rect y="542" width="1400" height="78" fill="#15233a"/>
  </svg>`);

const metroMidArt = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">
    <g fill="#172038"><rect x="0" y="250" width="140" height="292"/><rect x="155" y="315" width="120" height="227"/><rect x="1120" y="280" width="115" height="262"/><rect x="1250" y="215" width="150" height="327"/></g>
    <g fill="#ffd76b" opacity=".55"><rect x="28" y="285" width="16" height="22"/><rect x="74" y="285" width="16" height="22"/><rect x="1180" y="318" width="16" height="22"/><rect x="1300" y="260" width="16" height="22"/></g>
    <path d="M110 450V280H1290V450M220 280V450M1180 280V450" fill="none" stroke="#a8b6c7" stroke-width="18"/><path d="M85 282H1315" stroke="#dfe7ed" stroke-width="22"/><path d="M85 302H1315" stroke="#607286" stroke-width="7"/><rect y="542" width="1400" height="78" fill="#323946"/>
  </svg>`);

const frontArt = (accent, variant = 'crowd') => svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="620" viewBox="0 0 1400 620">
    ${variant === 'rail'
      ? '<path d="M0 548H1400M0 600H1400M90 530V620M270 530V620M1130 530V620M1310 530V620" fill="none" stroke="#121a27" stroke-width="18"/><path d="M0 548H1400" stroke="#dfe7ed" stroke-width="5"/>'
      : '<g fill="#0a0d17"><circle cx="95" cy="532" r="25"/><rect x="72" y="550" width="46" height="70" rx="20"/><circle cx="1285" cy="526" r="27"/><rect x="1258" y="548" width="54" height="72" rx="20"/><circle cx="195" cy="558" r="17"/><circle cx="1205" cy="558" r="17"/></g>'}
    <path d="M0 610H1400" stroke="${accent}" stroke-width="12" opacity=".7"/>
  </svg>`);

const sharedMusicPath = 'assets/audio/bgm_menu.mp3';
const layer = (texture, image, parallax, depth, extra = {}) => Object.freeze({
  texture, image, parallax, depth, align: 'ground', overscan: 150, ...extra
});

// Para usar una foto real, cambia `image` por una ruta como `assets/stages/plaza.jpg`.
// También se conserva `bgImage` como fallback compatible con escenarios antiguos.
export const STAGES = Object.freeze([
  Object.freeze({
    id: 'plaza_bolivar', name: 'Plaza de Bolívar', description: 'Duelo frente al corazón histórico de Bogotá, entre columnas, palomas y discursos de alto riesgo.', bgImage: plazaMidArt, bgTexture: 'stage_plaza_bolivar_legacy',
    bgFar: layer('stage_plaza_far', farArt({ top: '#101a46', bottom: '#e47d54', sun: '#ffd26b', hills: 'M0 472L150 405 315 446 465 360 650 442 830 382 1010 430 1200 350 1400 430V620H0Z' }), 0.14, -30),
    bgMid: layer('stage_plaza_mid', plazaMidArt, 0.48, -20),
    fgFront: layer('stage_plaza_front', frontArt('#f4d06f'), 1.12, 18),
    musicTrack: Object.freeze({ key: 'stage_plaza_bolivar_bgm', path: sharedMusicPath, volume: 0.96, rate: 0.96 }),
    floor: Object.freeze({ x: 38, y: 610, width: 1204, height: 110 }), cameraBounds: Object.freeze({ x: -20, y: 0, width: 1320, height: 720 }),
    parallaxStrength: 42, floorColor: 0x5d5461, accentColor: 0xf4d06f, ambience: Object.freeze({ type: 'crowd', lights: 7 })
  }),
  Object.freeze({
    id: 'leyenda_vallenata', name: 'Parque de la Leyenda Vallenata', description: 'Una tarima nocturna de acordeones, luces y público inquieto donde cada golpe quiere volverse canción.', bgImage: vallenatoMidArt, bgTexture: 'stage_leyenda_vallenata_legacy',
    bgFar: layer('stage_vallenato_far', farArt({ top: '#081e3b', bottom: '#ed8d4e', sun: '#ffe39b', hills: 'M0 438Q175 330 350 438T700 438T1050 438T1400 438V620H0Z' }), 0.12, -30),
    bgMid: layer('stage_vallenato_mid', vallenatoMidArt, 0.52, -20),
    fgFront: layer('stage_vallenato_front', frontArt('#f1c55a'), 1.16, 18),
    musicTrack: Object.freeze({ key: 'stage_leyenda_vallenata_bgm', path: sharedMusicPath, volume: 1, rate: 1.05 }),
    floor: Object.freeze({ x: 26, y: 604, width: 1228, height: 116 }), cameraBounds: Object.freeze({ x: -40, y: 0, width: 1360, height: 720 }),
    parallaxStrength: 50, floorColor: 0x15233a, accentColor: 0xf1c55a, ambience: Object.freeze({ type: 'crowd', lights: 10 })
  }),
  Object.freeze({
    id: 'transmilenio', name: 'Estación de TransMilenio', description: 'Hora pico, luces urbanas y articulados a toda velocidad: una arena donde nadie respeta la fila.', bgImage: metroMidArt, bgTexture: 'stage_transmilenio_legacy',
    bgFar: layer('stage_metro_far', farArt({ top: '#17213f', bottom: '#efae67', sun: '#ffd584', hills: 'M0 470L170 390 330 445 510 350 690 430 900 365 1080 430 1250 340 1400 410V620H0Z' }), 0.1, -30),
    bgMid: layer('stage_metro_mid', metroMidArt, 0.58, -20),
    fgFront: layer('stage_metro_front', frontArt('#e53950', 'rail'), 1.2, 18),
    musicTrack: Object.freeze({ key: 'stage_transmilenio_bgm', path: sharedMusicPath, volume: 0.92, rate: 1 }),
    floor: Object.freeze({ x: 48, y: 616, width: 1184, height: 104 }), cameraBounds: Object.freeze({ x: -10, y: 0, width: 1300, height: 720 }),
    parallaxStrength: 46, floorColor: 0x323946, accentColor: 0xe53950, ambience: Object.freeze({ type: 'transit', lights: 12, transitInterval: 9000 })
  })
]);

export const STAGE_BY_ID = Object.freeze(Object.fromEntries(STAGES.map(stage => [stage.id, stage])));

export function getRandomStage(excludedId = null) {
  const candidates = STAGES.filter(stage => stage.id !== excludedId);
  return candidates[Math.floor(Math.random() * candidates.length)] || STAGES[0];
}
