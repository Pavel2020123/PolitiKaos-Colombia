export const ARCADE_RECORD_STORAGE_KEY = 'guachafita-strike.arcade.bestTime.v1';
const LEGACY_ARCADE_RECORD_STORAGE_KEY = 'politikaos.arcade.bestTime.v1';

export function loadArcadeRecord() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const currentValue = localStorage.getItem(ARCADE_RECORD_STORAGE_KEY);
    const legacyValue = localStorage.getItem(LEGACY_ARCADE_RECORD_STORAGE_KEY);
    const stored = JSON.parse(currentValue || legacyValue);
    if (!stored || !Number.isFinite(stored.timeMs) || stored.timeMs <= 0 || !stored.characterName) return null;
    if (!currentValue && legacyValue) {
      localStorage.setItem(ARCADE_RECORD_STORAGE_KEY, legacyValue);
    }
    return stored;
  } catch (error) {
    console.warn('No se pudo leer el récord Arcade.', error);
    return null;
  }
}

export function saveArcadeRecord(timeMs, character) {
  const normalizedTime = Math.max(1, Math.round(timeMs));
  const currentRecord = loadArcadeRecord();
  if (currentRecord && currentRecord.timeMs <= normalizedTime) {
    return { record: currentRecord, isNewRecord: false };
  }

  const record = {
    timeMs: normalizedTime,
    characterId: character.id,
    characterName: character.name,
    savedAt: new Date().toISOString()
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ARCADE_RECORD_STORAGE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn('No se pudo guardar el récord Arcade.', error);
    }
  }
  return { record, isNewRecord: true };
}

export function formatArcadeTime(timeMs) {
  const totalCentiseconds = Math.max(0, Math.floor(timeMs / 10));
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}
