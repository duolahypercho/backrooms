import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCharacterCatalog,
  hashCharacterKey,
  selectCharacterDefinition,
} from './catalog.js';
import { loadCharactersFromDisk } from './node-catalog.js';

const definition = (id) => ({
  id,
  name: id,
  version: '1.0.0-test',
  createFactory() {},
});

test('character folders are discovered automatically by the Node catalog', async () => {
  const catalog = await loadCharactersFromDisk();
  assert.ok(catalog.has('threshold-surveyor'));
  assert.ok(catalog.definitions.length >= 1);
});

test('catalog sorts by order then id and resolves explicit character ids', () => {
  const catalog = createCharacterCatalog({
    './zulu/character.js': { default: { ...definition('zulu'), order: 20 } },
    './alpha/character.js': { default: { ...definition('alpha'), order: 20 } },
    './first.character.js': { default: { ...definition('first'), order: 1 } },
  });

  assert.deepEqual(catalog.ids, ['first', 'alpha', 'zulu']);
  assert.equal(catalog.get('zulu')?.id, 'zulu');
  assert.equal(selectCharacterDefinition(catalog, 'player-1', 'zulu').id, 'zulu');
});

test('implicit and unknown character selection is deterministic by player id', () => {
  const catalog = createCharacterCatalog({
    './a/character.js': { default: definition('a') },
    './b/character.js': { default: definition('b') },
    './c/character.js': { default: definition('c') },
  });
  const expected = catalog.definitions[hashCharacterKey('same-player') % 3];

  assert.equal(selectCharacterDefinition(catalog, 'same-player'), expected);
  assert.equal(selectCharacterDefinition(catalog, 'same-player'), expected);
  assert.equal(selectCharacterDefinition(catalog, 'same-player', 'not-installed'), expected);
});

test('catalog rejects invalid definitions and duplicate ids', () => {
  assert.throws(
    () => createCharacterCatalog({ './bad/character.js': { default: definition('Bad ID') } }),
    /invalid id/,
  );
  assert.throws(
    () => createCharacterCatalog({
      './one/character.js': { default: definition('same') },
      './two/character.js': { default: definition('same') },
    }),
    /Duplicate character id/,
  );
  assert.throws(
    () => createCharacterCatalog({
      './missing/character.js': { default: { id: 'missing', name: 'Missing', version: '1.0.0' } },
    }),
    /createFactory/,
  );
  assert.throws(
    () => createCharacterCatalog({
      './nameless/character.js': { default: { ...definition('nameless'), name: '' } },
    }),
    /non-empty name/,
  );
  assert.throws(
    () => createCharacterCatalog({
      './bad-version/character.js': {
        default: { ...definition('bad-version'), version: 2 },
      },
    }),
    /invalid version/,
  );
  assert.throws(() => createCharacterCatalog({}), /No character plugins/);
});
