function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Level fingerprints require finite numbers.');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalize(value[key])}`
    )).join(',')}}`;
  }
  throw new TypeError(`Level fingerprints cannot encode ${typeof value} values.`);
}

// Bump whenever deterministic maze, prop, objective, incident, or collider
// algorithms change. This prevents two cached builds from accepting one
// another while deriving different shared worlds from the same room seed.
export const SHARED_WORLD_REVISION = 2;

function hashContent(value, prefix) {
  const source = canonicalize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${prefix}-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function createLevelFingerprint(levels, options = {}) {
  return hashContent({
    sharedWorldRevision: options.sharedWorldRevision ?? SHARED_WORLD_REVISION,
    levels,
  }, 'levels-v2');
}

export function createGameContentFingerprint(levels, characters, options = {}) {
  const characterMetadata = Array.from(characters || [], (definition) => {
    if (typeof definition.version !== 'string' || !definition.version.trim()) {
      throw new TypeError(`Character ${definition.id || '(unknown)'} needs a version before fingerprinting.`);
    }
    return {
      id: definition.id,
      name: definition.name,
      order: definition.order ?? null,
      version: definition.version,
    };
  });
  return hashContent({
    sharedWorldRevision: options.sharedWorldRevision ?? SHARED_WORLD_REVISION,
    levels,
    characters: characterMetadata,
  }, 'game-v1');
}

export { canonicalize as canonicalizeLevelContent };
