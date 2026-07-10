import { loadCharactersFromDisk } from '../src/characters/node-catalog.js';
import { loadLevelsFromDisk } from '../src/levels/node-catalog.js';
import {
  createGameContentFingerprint,
  SHARED_WORLD_REVISION,
} from '../src/levels/fingerprint.js';

const levels = await loadLevelsFromDisk();
const characters = await loadCharactersFromDisk();
const fingerprint = createGameContentFingerprint(levels, characters.definitions);

console.log(`Content valid: ${levels.length} level(s), ${characters.definitions.length} character(s).`);
console.log(`Levels: ${levels.map(({ id }) => id).join(', ')}`);
console.log(`Characters: ${characters.ids.join(', ')}`);
console.log(`Shared-world revision: ${SHARED_WORLD_REVISION}`);
console.log(`Multiplayer fingerprint: ${fingerprint}`);
