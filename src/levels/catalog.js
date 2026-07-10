import { validateAtmosphereProfile } from '../atmosphere.js';

const REQUIRED_SECTIONS = [
  'exit',
  'copy',
  'maze',
  'surfaces',
  'fog',
  'lighting',
  'audio',
  'objective',
  'props',
  'atmosphere',
  'equipment',
  'evidence',
  'monster',
];

const PROP_TYPES = new Set([
  'wall-pipe',
  'hanging-chain',
  'standing-water',
  'ceiling-vent',
  'cable-tray',
  'drain-grate',
  'square-column',
  'service-crate',
  'discarded-chair',
  'oil-drum',
  'retail-shelf',
  'hospital-bed',
  'school-locker',
  'parking-barrier',
  'pool-bench',
  'theater-seat',
  'lab-table',
  'airport-bench',
  'server-rack',
]);
const BLOCKING_PROP_TYPES = new Set([
  'square-column',
  'service-crate',
  'discarded-chair',
  'oil-drum',
  'retail-shelf',
  'hospital-bed',
  'school-locker',
  'parking-barrier',
  'pool-bench',
  'theater-seat',
  'lab-table',
  'airport-bench',
  'server-rack',
]);
const OBJECTIVE_TYPES = new Set(['none', 'fuse', 'valve']);
const MONSTER_IDENTITIES = new Set(['still', 'foreman', 'wader']);
const INCIDENT_TYPES = new Set([
  'collapsed-wanderer',
  'abandoned-pack',
  'chair-pile',
  'black-motes',
  'shoe-trail',
]);

function moduleValue(module) {
  return module?.default ?? module?.level ?? module;
}

function contentError(source, message) {
  return new TypeError(`Invalid level module ${source}: ${message}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function requireObject(value, path, source) {
  if (!isObject(value)) throw contentError(source, `${path} must be an object.`);
  return value;
}

function requireString(value, path, source, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw contentError(source, `${path} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
  }
  return value;
}

function requireNumber(value, path, source, options = {}) {
  const { integer = false, min = -Infinity, max = Infinity, exclusiveMin = false } = options;
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw contentError(source, `${path} must be a finite${integer ? ' integer' : ' number'}.`);
  }
  if ((exclusiveMin ? value <= min : value < min) || value > max) {
    const minimum = exclusiveMin ? `greater than ${min}` : `at least ${min}`;
    throw contentError(source, `${path} must be ${minimum} and at most ${max}.`);
  }
  return value;
}

function requireColor(value, path, source, { nullable = false } = {}) {
  if (nullable && value === null) return value;
  return requireNumber(value, path, source, { integer: true, min: 0, max: 0xffffff });
}

function requireRgb(value, path, source) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw contentError(source, `${path} must be an RGB triplet.`);
  }
  value.forEach((channel, index) => requireNumber(channel, `${path}[${index}]`, source, {
    integer: true,
    min: 0,
    max: 255,
  }));
}

function requireRange(value, path, source, options = {}) {
  const { min = 0, max = Infinity, integer = false } = options;
  if (!Array.isArray(value) || value.length !== 2) {
    throw contentError(source, `${path} must be a [minimum, maximum] pair.`);
  }
  requireNumber(value[0], `${path}[0]`, source, { integer, min, max });
  requireNumber(value[1], `${path}[1]`, source, { integer, min, max });
  if (value[1] < value[0]) throw contentError(source, `${path} maximum must not be below its minimum.`);
}

function validateCopy(copy, source) {
  requireObject(copy, 'copy', source);
  requireString(copy.classification, 'copy.classification', source);
  requireString(copy.status, 'copy.status', source);
  for (const phase of ['start', 'pause', 'death', 'win']) {
    requireObject(copy[phase], `copy.${phase}`, source);
    for (const field of ['kicker', 'title', 'body', 'button']) {
      requireString(copy[phase][field], `copy.${phase}.${field}`, source);
    }
  }
}

function validateMaze(maze, source) {
  requireObject(maze, 'maze', source);
  for (const mode of ['desktop', 'mobile']) {
    requireObject(maze[mode], `maze.${mode}`, source);
    requireNumber(maze[mode].cols, `maze.${mode}.cols`, source, { integer: true, min: 7, max: 51 });
    requireNumber(maze[mode].rows, `maze.${mode}.rows`, source, { integer: true, min: 7, max: 51 });
  }
  requireNumber(maze.loopRatio, 'maze.loopRatio', source, { min: 0, max: 0.75 });
  requireNumber(maze.roomDivisor, 'maze.roomDivisor', source, { min: 1, max: 10_000 });
  requireNumber(maze.minimumRooms, 'maze.minimumRooms', source, { integer: true, min: 0, max: 1_000 });
  requireObject(maze.roomSize, 'maze.roomSize', source);
  requireRange([maze.roomSize.min, maze.roomSize.max], 'maze.roomSize', source, { integer: true, min: 1, max: 12 });
  const smallestGrid = Math.min(
    maze.desktop.cols,
    maze.desktop.rows,
    maze.mobile.cols,
    maze.mobile.rows,
  );
  if (maze.roomSize.max > smallestGrid - 3) {
    throw contentError(source, 'maze.roomSize.max must leave at least a one-cell border on the smallest grid.');
  }
  requireNumber(maze.seedSalt, 'maze.seedSalt', source, { integer: true, min: 0, max: 0xffffffff });
}

function validateSurfaces(surfaces, source) {
  requireObject(surfaces, 'surfaces', source);
  for (const section of ['wall', 'floor', 'ceiling']) {
    const surface = requireObject(surfaces[section], `surfaces.${section}`, source);
    for (const channel of ['base', 'accent', 'grime']) requireRgb(surface[channel], `surfaces.${section}.${channel}`, source);
    requireString(surface.pattern, `surfaces.${section}.pattern`, source);
    requireNumber(surface.roughness, `surfaces.${section}.roughness`, source, { min: 0, max: 1 });
    requireNumber(surface.metalness, `surfaces.${section}.metalness`, source, { min: 0, max: 1 });
    requireNumber(surface.bumpScale, `surfaces.${section}.bumpScale`, source, { min: 0, max: 1 });
  }
  if (surfaces.wall.grimeOpacity !== undefined) {
    requireNumber(surfaces.wall.grimeOpacity, 'surfaces.wall.grimeOpacity', source, { min: 0, max: 1 });
  }
  requireColor(surfaces.ceiling.emissive, 'surfaces.ceiling.emissive', source);
  requireNumber(surfaces.ceiling.emissiveIntensity, 'surfaces.ceiling.emissiveIntensity', source, { min: 0, max: 10 });
  const trim = requireObject(surfaces.trim, 'surfaces.trim', source);
  requireColor(trim.color, 'surfaces.trim.color', source);
  requireNumber(trim.roughness, 'surfaces.trim.roughness', source, { min: 0, max: 1 });
  requireNumber(trim.metalness, 'surfaces.trim.metalness', source, { min: 0, max: 1 });
}

function validateLighting(level, source) {
  const { fog, lighting } = level;
  requireObject(fog, 'fog', source);
  requireColor(fog.color, 'fog.color', source);
  requireObject(fog.density, 'fog.density', source);
  for (const mode of ['desktop', 'mobile']) {
    requireNumber(fog.density[mode], `fog.density.${mode}`, source, { min: 0.0001, max: 0.25 });
  }
  requireObject(lighting, 'lighting', source);
  requireNumber(lighting.exposure, 'lighting.exposure', source, { min: 0.05, max: 5 });
  const hemisphere = requireObject(lighting.hemisphere, 'lighting.hemisphere', source);
  requireColor(hemisphere.sky, 'lighting.hemisphere.sky', source);
  requireColor(hemisphere.ground, 'lighting.hemisphere.ground', source);
  requireObject(hemisphere.intensity, 'lighting.hemisphere.intensity', source);
  const ambient = requireObject(lighting.ambient, 'lighting.ambient', source);
  requireColor(ambient.color, 'lighting.ambient.color', source);
  requireObject(ambient.intensity, 'lighting.ambient.intensity', source);
  for (const mode of ['desktop', 'mobile']) {
    requireNumber(hemisphere.intensity[mode], `lighting.hemisphere.intensity.${mode}`, source, { min: 0, max: 10 });
    requireNumber(ambient.intensity[mode], `lighting.ambient.intensity.${mode}`, source, { min: 0, max: 10 });
  }
  const fixture = requireObject(lighting.fixture, 'lighting.fixture', source);
  for (const key of ['color', 'panelColor', 'deadPanelColor']) requireColor(fixture[key], `lighting.fixture.${key}`, source);
  for (const key of ['intensity', 'distance', 'decay']) {
    requireNumber(fixture[key], `lighting.fixture.${key}`, source, { min: 0, max: 1_000 });
  }
  requireNumber(fixture.angle, 'lighting.fixture.angle', source, { min: 0.001, max: Math.PI / 2 });
  requireNumber(fixture.penumbra, 'lighting.fixture.penumbra', source, { min: 0, max: 1 });
  requireNumber(fixture.brokenChance, 'lighting.fixture.brokenChance', source, { min: 0, max: 1 });
  requireObject(fixture.pool, 'lighting.fixture.pool', source);
  for (const mode of ['desktop', 'mobile']) {
    requireNumber(fixture.pool[mode], `lighting.fixture.pool.${mode}`, source, { integer: true, min: 1, max: 64 });
  }
  const flicker = requireObject(fixture.flicker, 'lighting.fixture.flicker', source);
  for (const key of ['idleRate', 'idleDepth', 'faultFloor', 'recovery']) {
    requireNumber(flicker[key], `lighting.fixture.flicker.${key}`, source, { min: 0, max: 30 });
  }
}

function validateAudio(audio, source) {
  requireObject(audio, 'audio', source);
  requireNumber(audio.masterGain, 'audio.masterGain', source, { min: 0, max: 2 });
  requireNumber(audio.humGain, 'audio.humGain', source, { min: 0, max: 2 });
  if (audio.drips !== undefined && typeof audio.drips !== 'boolean') {
    throw contentError(source, 'audio.drips must be a boolean when present.');
  }
  if (!Array.isArray(audio.oscillators) || !audio.oscillators.length || audio.oscillators.length > 8) {
    throw contentError(source, 'audio.oscillators must contain between one and eight oscillators.');
  }
  audio.oscillators.forEach((oscillator, index) => {
    requireObject(oscillator, `audio.oscillators[${index}]`, source);
    requireNumber(oscillator.frequency, `audio.oscillators[${index}].frequency`, source, { min: 1, max: 24_000 });
    if (!['sine', 'square', 'sawtooth', 'triangle'].includes(oscillator.type)) {
      throw contentError(source, `audio.oscillators[${index}].type is not a supported oscillator type.`);
    }
    requireNumber(oscillator.gain, `audio.oscillators[${index}].gain`, source, { min: 0, max: 2 });
  });
  const noise = requireObject(audio.noise, 'audio.noise', source);
  if (!['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'].includes(noise.filter)) {
    throw contentError(source, `audio.noise.filter "${noise.filter}" is not a supported Web Audio filter type.`);
  }
  for (const key of ['frequency', 'q', 'gain']) requireNumber(noise[key], `audio.noise.${key}`, source, { min: 0, max: 24_000 });
  for (const section of ['heartbeat', 'impact']) {
    requireObject(audio[section], `audio.${section}`, source);
    for (const key of ['startFrequency', 'endFrequency']) {
      requireNumber(audio[section][key], `audio.${section}.${key}`, source, { min: 1, max: 24_000 });
    }
  }
  const footstep = requireObject(audio.footstep, 'audio.footstep', source);
  for (const key of ['walkLowpass', 'runLowpass']) requireNumber(footstep[key], `audio.footstep.${key}`, source, { min: 1, max: 24_000 });
  const ambience = requireObject(audio.ambience, 'audio.ambience', source);
  requireRange(ambience.interval, 'audio.ambience.interval', source, { min: 0.1, max: 600 });
  if (!Array.isArray(ambience.cues) || !ambience.cues.length || ambience.cues.length > 16) {
    throw contentError(source, 'audio.ambience.cues must contain between one and sixteen cues.');
  }
  ambience.cues.forEach((cue, index) => requireString(cue, `audio.ambience.cues[${index}]`, source));
  requireNumber(ambience.stereoWidth, 'audio.ambience.stereoWidth', source, { min: 0, max: 1 });
  requireNumber(ambience.silenceChance, 'audio.ambience.silenceChance', source, { min: 0, max: 1 });
}

function validateObjectiveAndProps(level, source) {
  const objective = requireObject(level.objective, 'objective', source);
  if (!OBJECTIVE_TYPES.has(objective.type)) throw contentError(source, `objective.type "${objective.type}" is not supported.`);
  requireNumber(objective.count, 'objective.count', source, { integer: true, min: 0, max: 12 });
  if ((objective.type === 'none') !== (objective.count === 0)) {
    throw contentError(source, 'objective.type "none" requires count 0; interactive objectives require at least one item.');
  }
  requireColor(objective.color, 'objective.color', source);
  const labels = requireObject(objective.labels, 'objective.labels', source);
  for (const key of ['hud', 'item', 'itemPlural', 'interact', 'progress', 'locked', 'complete']) {
    requireString(labels[key], `objective.labels.${key}`, source, { allowEmpty: true });
  }
  if (!Array.isArray(level.props) || level.props.length > 16) {
    throw contentError(source, 'props must be an array with at most sixteen definitions.');
  }
  let totalPropDensity = 0;
  let blockingPropDensity = 0;
  level.props.forEach((definition, index) => {
    const path = `props[${index}]`;
    requireObject(definition, path, source);
    if (!PROP_TYPES.has(definition.type)) throw contentError(source, `${path}.type "${definition.type}" is not supported.`);
    requireNumber(definition.density, `${path}.density`, source, { min: 0, max: 0.25 });
    totalPropDensity += definition.density;
    if (BLOCKING_PROP_TYPES.has(definition.type)) {
      blockingPropDensity += definition.density;
    }
    requireColor(definition.color, `${path}.color`, source);
    if (definition.accent !== undefined) requireColor(definition.accent, `${path}.accent`, source);
    requireRange(definition.cluster, `${path}.cluster`, source, { integer: true, min: 1, max: 20 });
  });
  if (totalPropDensity > 0.75) throw contentError(source, 'aggregate props density must not exceed 0.75.');
  if (blockingPropDensity > 0.08) throw contentError(source, 'aggregate blocking prop density must not exceed 0.08.');
}

function validateIncidents(incidents, source) {
  if (incidents === undefined) return;
  requireObject(incidents, 'incidents', source);
  const allowedKeys = new Set(['density', 'minCount', 'maxCount', 'minCellDistance', 'weights', 'palette', 'types']);
  for (const key of Object.keys(incidents)) {
    if (!allowedKeys.has(key)) throw contentError(source, `incidents.${key} is not a supported profile field.`);
  }
  requireNumber(incidents.density, 'incidents.density', source, { min: 0, max: 0.05 });
  requireNumber(incidents.minCount, 'incidents.minCount', source, { integer: true, min: 0, max: 6 });
  requireNumber(incidents.maxCount, 'incidents.maxCount', source, { integer: true, min: incidents.minCount, max: 12 });
  requireNumber(incidents.minCellDistance, 'incidents.minCellDistance', source, { integer: true, min: 0, max: 64 });
  const weights = requireObject(incidents.weights, 'incidents.weights', source);
  let weightTotal = 0;
  for (const [type, weight] of Object.entries(weights)) {
    if (!INCIDENT_TYPES.has(type)) throw contentError(source, `incidents.weights contains unsupported type "${type}".`);
    requireNumber(weight, `incidents.weights.${type}`, source, { min: 0, max: 100 });
    weightTotal += weight;
  }
  if (weightTotal <= 0) throw contentError(source, 'incidents.weights must enable at least one incident type.');
  if (incidents.palette !== undefined) {
    requireObject(incidents.palette, 'incidents.palette', source);
    for (const [key, value] of Object.entries(incidents.palette)) requireColor(value, `incidents.palette.${key}`, source);
  }
  if (incidents.types !== undefined) {
    if (!Array.isArray(incidents.types) || !incidents.types.length || incidents.types.length > INCIDENT_TYPES.size) {
      throw contentError(source, 'incidents.types must be a non-empty array of supported incident types.');
    }
    const uniqueTypes = new Set(incidents.types);
    if (uniqueTypes.size !== incidents.types.length || [...uniqueTypes].some((type) => !INCIDENT_TYPES.has(type))) {
      throw contentError(source, 'incidents.types must contain unique supported incident types.');
    }
    if (incidents.types.every((type) => weights[type] !== undefined && Number(weights[type]) <= 0)) {
      throw contentError(source, 'incidents.types must include at least one type with a positive weight.');
    }
  }
}

function validateAtmosphere(atmosphere, source) {
  requireObject(atmosphere, 'atmosphere', source);
  requireString(atmosphere.identity, 'atmosphere.identity', source);
  requireObject(atmosphere.cadence, 'atmosphere.cadence', source);
  requireRange(atmosphere.cadence.first, 'atmosphere.cadence.first', source, { min: 0, max: 600 });
  requireRange(atmosphere.cadence.interval, 'atmosphere.cadence.interval', source, { min: 0, max: 600 });
  if (!Array.isArray(atmosphere.environmentalStory) || atmosphere.environmentalStory.length > 16) {
    throw contentError(source, 'atmosphere.environmentalStory must be an array with at most sixteen entries.');
  }
  let storyDensity = 0;
  atmosphere.environmentalStory.forEach((entry, index) => {
    const path = `atmosphere.environmentalStory[${index}]`;
    requireObject(entry, path, source);
    requireString(entry.id, `${path}.id`, source);
    requireString(entry.text, `${path}.text`, source);
    requireNumber(entry.density, `${path}.density`, source, { min: 0, max: 0.02 });
    storyDensity += entry.density;
    if (!['wall', 'floor', 'fixture', 'objective', 'exit'].includes(entry.placement)) {
      throw contentError(source, `${path}.placement "${entry.placement}" is not supported.`);
    }
  });
  if (storyDensity > 0.05) throw contentError(source, 'aggregate environmental story density must not exceed 0.05.');
  if (!Array.isArray(atmosphere.events) || !Array.isArray(atmosphere.milestones)) {
    throw contentError(source, 'atmosphere.events and atmosphere.milestones must be arrays.');
  }
  if (atmosphere.events.length > 24 || atmosphere.milestones.length > 12) {
    throw contentError(source, 'atmosphere supports at most 24 events and 12 milestones per level.');
  }
  const atmosphereErrors = validateAtmosphereProfile(atmosphere);
  if (atmosphereErrors.length) throw contentError(source, atmosphereErrors.join(' '));
}

function validateEquipmentAndEvidence(level, source) {
  const equipment = requireObject(level.equipment, 'equipment', source);
  const flashlight = requireObject(equipment.flashlight, 'equipment.flashlight', source);
  requireColor(flashlight.color, 'equipment.flashlight.color', source);
  for (const key of ['intensity', 'distance']) {
    requireNumber(flashlight[key], `equipment.flashlight.${key}`, source, { min: 0.001, max: 1_000 });
  }
  requireNumber(flashlight.angle, 'equipment.flashlight.angle', source, { min: 0.001, max: Math.PI / 2 });
  for (const key of ['drainPerSecond', 'emergencyRechargePerSecond', 'flashCost']) {
    requireNumber(flashlight[key], `equipment.flashlight.${key}`, source, { min: 0, max: 1 });
  }
  const evidence = requireObject(level.evidence, 'evidence', source);
  requireNumber(evidence.recharge, 'evidence.recharge', source, { min: 0, max: 1 });
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== 3) {
    throw contentError(source, 'evidence.entries must contain exactly three archive strings.');
  }
  evidence.entries.forEach((entry, index) => requireString(entry, `evidence.entries[${index}]`, source));
}

function validateMonster(monster, source) {
  requireObject(monster, 'monster', source);
  requireString(monster.name, 'monster.name', source);
  if (!MONSTER_IDENTITIES.has(monster.identity)) throw contentError(source, `monster.identity "${monster.identity}" is not supported.`);
  const presentation = requireObject(monster.presentation, 'monster.presentation', source);
  requireString(presentation.silhouette, 'monster.presentation.silhouette', source);
  requireNumber(presentation.eyePulse, 'monster.presentation.eyePulse', source, { min: 0, max: 20 });
  requireNumber(presentation.twitchStrength, 'monster.presentation.twitchStrength', source, { min: 0, max: 20 });
  const sound = requireObject(monster.sound, 'monster.sound', source);
  for (const key of ['breathPitch', 'breathWeight', 'stepWeight', 'drag']) requireNumber(sound[key], `monster.sound.${key}`, source, { min: 0, max: 10 });
  const skin = requireObject(monster.skin, 'monster.skin', source);
  requireString(skin.type, 'monster.skin.type', source);
  requireColor(skin.body, 'monster.skin.body', source);
  requireColor(skin.accent, 'monster.skin.accent', source);
  requireColor(skin.eye, 'monster.skin.eye', source, { nullable: true });
  requireNumber(skin.emissiveIntensity, 'monster.skin.emissiveIntensity', source, { min: 0, max: 50 });
  requireNumber(skin.scale, 'monster.skin.scale', source, { min: 0.2, max: 5 });
  const timing = requireObject(monster.timing, 'monster.timing', source);
  for (const key of ['firstScare', 'scareInterval', 'firstChase']) requireRange(timing[key], `monster.timing.${key}`, source, { min: 0, max: 3_600 });
  for (const key of ['glimpseDuration', 'stalkDuration']) requireNumber(timing[key], `monster.timing.${key}`, source, { min: 0, max: 3_600 });
  requireObject(timing.pathRefresh, 'monster.timing.pathRefresh', source);
  for (const key of ['stalk', 'chase']) requireNumber(timing.pathRefresh[key], `monster.timing.pathRefresh.${key}`, source, { min: 0.01, max: 60 });
  const behavior = requireObject(monster.behavior, 'monster.behavior', source);
  const sight = requireObject(behavior.sight, 'monster.behavior.sight', source);
  for (const key of ['range', 'acquireRate', 'threshold']) requireNumber(sight[key], `monster.behavior.sight.${key}`, source, { min: 0, max: 1_000 });
  requireNumber(sight.peripheralDot, 'monster.behavior.sight.peripheralDot', source, { min: -1, max: 1 });
  const hearing = requireObject(behavior.hearing, 'monster.behavior.hearing', source);
  for (const key of ['baseCells', 'noiseCells', 'chaseNoise', 'reacquireNoise']) requireNumber(hearing[key], `monster.behavior.hearing.${key}`, source, { min: 0, max: 1_000 });
  const chase = requireObject(behavior.chase, 'monster.behavior.chase', source);
  requireNumber(chase.lostSightDelay, 'monster.behavior.chase.lostSightDelay', source, { min: 0, max: 600 });
  requireRange(chase.searchDuration, 'monster.behavior.chase.searchDuration', source, { min: 0, max: 600 });
  requireRange(chase.recovery, 'monster.behavior.chase.recovery', source, { min: 0, max: 600 });
  requireRange(behavior.wanderCells, 'monster.behavior.wanderCells', source, { integer: true, min: 0, max: 1_000 });
  const speeds = requireObject(monster.speeds, 'monster.speeds', source);
  for (const key of ['watched', 'stalk', 'chase']) requireNumber(speeds[key], `monster.speeds.${key}`, source, { min: 0, max: 100 });
  requireNumber(monster.stalkTriggerDistance, 'monster.stalkTriggerDistance', source, { min: 0, max: 1_000 });
  requireNumber(monster.catchDistance, 'monster.catchDistance', source, { min: 0.1, max: 100 });
}

export function validateLevel(level, source = '(unknown)') {
  if (!isObject(level)) throw contentError(source, 'default export must be a level configuration object.');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(level.id || ''))) {
    throw contentError(source, 'id must use lowercase letters, numbers, and hyphens.');
  }
  requireNumber(level.index, 'index', source, { integer: true, min: 0, max: 1_000 });
  requireString(level.name, 'name', source);
  for (const key of REQUIRED_SECTIONS) {
    if (level[key] === undefined || level[key] === null) throw contentError(source, `missing required section "${key}".`);
  }
  requireObject(level.exit, 'exit', source);
  requireString(level.exit.label, 'exit.label', source);
  validateCopy(level.copy, source);
  validateMaze(level.maze, source);
  validateSurfaces(level.surfaces, source);
  validateLighting(level, source);
  validateAudio(level.audio, source);
  validateObjectiveAndProps(level, source);
  validateIncidents(level.incidents, source);
  validateAtmosphere(level.atmosphere, source);
  validateEquipmentAndEvidence(level, source);
  validateMonster(level.monster, source);
  return level;
}

export function createLevelCatalog(modules) {
  const entries = Object.entries(modules || {}).map(([source, module]) => ({
    source,
    level: validateLevel(moduleValue(module), source),
  }));
  if (!entries.length) {
    throw new Error('No level modules were discovered in src/levels/*/level.js or src/levels/*.level.js.');
  }
  entries.sort((left, right) => left.level.index - right.level.index || left.source.localeCompare(right.source));

  const ids = new Set();
  entries.forEach(({ level, source }, expectedIndex) => {
    if (ids.has(level.id)) throw contentError(source, `duplicate id "${level.id}".`);
    ids.add(level.id);
    if (level.index !== expectedIndex) {
      throw contentError(
        source,
        `index ${level.index} leaves a gap; expected ${expectedIndex}. Level indexes must be contiguous.`,
      );
    }
  });
  return Object.freeze(entries.map(({ level }) => deepFreeze(level)));
}

export function parseLevelIndex(searchParams, totalLevels) {
  let rawLevel;
  if (searchParams && typeof searchParams.get === 'function') rawLevel = searchParams.get('level');
  else if (typeof searchParams === 'string') rawLevel = new URLSearchParams(searchParams).get('level');
  else if (searchParams && typeof searchParams === 'object') rawLevel = searchParams.level;
  const parsedLevel = Number(rawLevel);
  const maximum = Math.max(0, Number(totalLevels || 1) - 1);
  if (!Number.isFinite(parsedLevel)) return 0;
  return Math.max(0, Math.min(maximum, Math.trunc(parsedLevel)));
}
