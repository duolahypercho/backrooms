import { createCharacterCatalog } from './catalog.js';
import thresholdSurveyor from './threshold-surveyor/character.js';

// The fallback keeps the registry importable in Node for manager unit tests;
// Vite replaces the eager glob at build time in the browser application.
const characterModules = import.meta.env
  ? import.meta.glob(
    ['./*/character.js', './*.character.js', '!./_template/**'],
    { eager: true },
  )
  : { './threshold-surveyor/character.js': { default: thresholdSurveyor } };

export const characterCatalog = createCharacterCatalog(characterModules);
export {
  hashCharacterKey,
  selectCharacterDefinition,
  validateCharacterDefinition,
} from './catalog.js';
