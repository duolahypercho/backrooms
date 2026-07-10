import { createLevelCatalog, parseLevelIndex } from './catalog.js';
import { createLevelFingerprint } from './fingerprint.js';

// Vite expands this at build time and watches the glob during development.
// Either a folder (`my-level/level.js`) or one file (`my-level.level.js`) is
// enough to register content. No central manifest needs to be edited.
const discoveredLevelModules = import.meta.glob(
  ['./*/level.js', './*.level.js', '!./_template/**'],
  { eager: true },
);

export const LEVELS = createLevelCatalog(discoveredLevelModules);
export const LEVEL_IDS = Object.freeze(LEVELS.map((level) => level.id));
export const LEVEL_FINGERPRINT = createLevelFingerprint(LEVELS);
export const getLevelIndex = (searchParams) => parseLevelIndex(searchParams, LEVELS.length);
export const getLevelById = (id) => LEVELS.find((level) => level.id === id) || null;
