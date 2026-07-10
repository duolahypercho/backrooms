const CHARACTER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function moduleDefinition(moduleValue) {
  if (!moduleValue || typeof moduleValue !== 'object') return null;
  return moduleValue.default || null;
}

export function validateCharacterDefinition(definition, source = 'character plugin') {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError(`Character module ${source} must export a definition as default.`);
  }
  if (typeof definition.id !== 'string' || !CHARACTER_ID_PATTERN.test(definition.id)) {
    throw new TypeError(
      `Character module ${source} has invalid id ${JSON.stringify(definition.id)}; use a lowercase slug.`,
    );
  }
  if (typeof definition.name !== 'string' || !definition.name.trim()) {
    throw new TypeError(`Character ${definition.id} must provide a non-empty name.`);
  }
  if (definition.order !== undefined && !Number.isFinite(definition.order)) {
    throw new TypeError(`Character ${definition.id} has an invalid order.`);
  }
  if (typeof definition.version !== 'string' || !definition.version.trim()) {
    throw new TypeError(`Character ${definition.id} has an invalid version.`);
  }
  if (typeof definition.createFactory !== 'function') {
    throw new TypeError(
      `Character ${definition.id} must implement createFactory({ THREE, options }).`,
    );
  }
}

/**
 * Builds and validates a deterministic catalog from Vite eager-glob modules.
 * This pure function intentionally has no Vite dependency so contributors can
 * test character definitions with Node.
 */
export function createCharacterCatalog(modules) {
  if (!modules || typeof modules !== 'object') {
    throw new TypeError('Character modules must be an object keyed by module path.');
  }

  const definitions = [];
  const byId = new Map();
  Object.entries(modules)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([source, moduleValue]) => {
      const definition = moduleDefinition(moduleValue);
      validateCharacterDefinition(definition, source);
      if (byId.has(definition.id)) {
        throw new Error(`Duplicate character id ${JSON.stringify(definition.id)} in ${source}.`);
      }
      const frozenDefinition = Object.freeze({ ...definition });
      definitions.push(frozenDefinition);
      byId.set(frozenDefinition.id, frozenDefinition);
    });

  if (definitions.length === 0) {
    throw new Error(
      'No character plugins were discovered in src/characters/*/character.js or src/characters/*.character.js.',
    );
  }

  definitions.sort((left, right) => (
    (finiteOrder(left.order) - finiteOrder(right.order))
    || left.id.localeCompare(right.id)
  ));
  const frozenDefinitions = Object.freeze(definitions);
  return Object.freeze({
    definitions: frozenDefinitions,
    ids: Object.freeze(frozenDefinitions.map(({ id }) => id)),
    get(id) {
      return byId.get(String(id)) || null;
    },
    has(id) {
      return byId.has(String(id));
    },
    [Symbol.iterator]() {
      return frozenDefinitions[Symbol.iterator]();
    },
  });
}

function finiteOrder(value) {
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** Stable FNV-1a hash used to keep implicit character selection peer-consistent. */
export function hashCharacterKey(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    const codePoint = character.codePointAt(0);
    hash ^= codePoint;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Explicit registered IDs win. Missing/unknown IDs fall back to a stable
 * selection so peers with different plugin sets can still render one another.
 */
export function selectCharacterDefinition(catalog, playerId, characterId) {
  if (!catalog?.definitions?.length || typeof catalog.get !== 'function') {
    throw new TypeError('selectCharacterDefinition requires a non-empty character catalog.');
  }
  if (characterId !== undefined && characterId !== null && String(characterId).trim()) {
    const explicit = catalog.get(String(characterId).trim());
    if (explicit) return explicit;
  }
  return catalog.definitions[hashCharacterKey(playerId) % catalog.definitions.length];
}
