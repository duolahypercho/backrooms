const TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'collapsed-wanderer', weight: 0.7 }),
  Object.freeze({ id: 'abandoned-pack', weight: 1.25 }),
  Object.freeze({ id: 'chair-pile', weight: 1.05 }),
  Object.freeze({ id: 'black-motes', weight: 0.9 }),
  Object.freeze({ id: 'shoe-trail', weight: 1.1 }),
]);

const TYPE_IDS = new Set(TYPE_DEFINITIONS.map(({ id }) => id));
const DEFAULT_DENSITY = 0.015;
const DEFAULT_MAX = Object.freeze({ desktop: 8, mobile: 4 });
const HARD_MAX = Object.freeze({ desktop: 12, mobile: 6 });

export const INCIDENT_TYPES = Object.freeze(TYPE_DEFINITIONS.map(({ id }) => id));

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seedToUint(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  return hashString(seed ?? 'threshold-incidents');
}

function createRandom(seed) {
  let state = seedToUint(seed) || 0x7f4a7c15;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    uint() {
      return Math.floor(this.next() * 4294967296) >>> 0;
    },
  };
}

function cellKey(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return `index:${Math.trunc(value)}`;
  if (typeof value === 'string') {
    const number = Number(value);
    return value.trim() !== '' && Number.isFinite(number)
      ? `index:${Math.trunc(number)}`
      : `id:${value}`;
  }
  if (!value || typeof value !== 'object') return '';
  const index = value.cellIndex ?? value.index;
  if (Number.isFinite(Number(index))) return `index:${Math.trunc(Number(index))}`;
  if (value.id !== undefined && value.id !== null) return `id:${String(value.id)}`;
  return '';
}

function normalizeCell(value, columns) {
  const key = cellKey(value);
  if (!key) return null;
  const object = value && typeof value === 'object' ? value : {};
  const rawIndex = object.cellIndex ?? object.index ?? value;
  const parsedIndex = Number(rawIndex);
  const cellIndex = Number.isFinite(parsedIndex) ? Math.trunc(parsedIndex) : String(object.id ?? value);
  const knownColumns = Math.max(0, Math.trunc(finite(columns, 0)));
  const inferredRow = typeof cellIndex === 'number' && knownColumns > 0
    ? Math.floor(cellIndex / knownColumns)
    : undefined;
  const inferredColumn = typeof cellIndex === 'number' && knownColumns > 0
    ? ((cellIndex % knownColumns) + knownColumns) % knownColumns
    : undefined;
  const row = Number.isFinite(Number(object.row)) ? Math.trunc(Number(object.row)) : inferredRow;
  const columnValue = object.col ?? object.column;
  const col = Number.isFinite(Number(columnValue)) ? Math.trunc(Number(columnValue)) : inferredColumn;
  const sourcePosition = object.position && typeof object.position === 'object'
    ? object.position
    : object;
  const position = Number.isFinite(Number(sourcePosition.x)) && Number.isFinite(Number(sourcePosition.z))
    ? { x: Number(sourcePosition.x), z: Number(sourcePosition.z) }
    : undefined;

  return { key, cellIndex, row, col, position };
}

function weightedType(types, random) {
  const total = types.reduce((sum, definition) => sum + definition.weight, 0);
  let cursor = random.next() * total;
  for (const definition of types) {
    cursor -= definition.weight;
    if (cursor <= 0) return definition.id;
  }
  return types.at(-1).id;
}

function availableTypes(options) {
  const requested = Array.isArray(options.types) && options.types.length
    ? new Set(options.types.map(String))
    : null;
  const weights = options.weights && typeof options.weights === 'object' ? options.weights : {};
  const configured = TYPE_DEFINITIONS
    .filter(({ id }) => !requested || requested.has(id))
    .map(({ id, weight }) => ({
      id,
      weight: clamp(finite(weights[id], weight), 0, 100),
    }))
    .filter(({ weight }) => weight > 0);
  if (configured.length) return configured;
  if (requested) throw new TypeError('At least one requested incident type needs a positive weight.');
  return TYPE_DEFINITIONS;
}

function farEnough(candidate, selected, minimumDistance) {
  if (minimumDistance <= 0 || candidate.row === undefined || candidate.col === undefined) return true;
  return selected.every((other) => {
    if (other.row === undefined || other.col === undefined) return true;
    return Math.abs(candidate.row - other.row) + Math.abs(candidate.col - other.col) >= minimumDistance;
  });
}

/**
 * Plans rare, static environmental incidents without touching Three.js or game
 * state. The returned records are JSON-safe, which makes them suitable for
 * deterministic co-op synchronization or level snapshots.
 */
export function planIncidents(options = {}) {
  const mobile = options.mobile === true;
  const random = createRandom(options.seed);
  const protectedKeys = new Set(
    [...(options.protectedCells || [])].map(cellKey).filter(Boolean),
  );
  const unique = new Map();
  for (const value of Array.isArray(options.candidateCells) ? options.candidateCells : []) {
    const cell = normalizeCell(value, options.columns);
    if (cell && !protectedKeys.has(cell.key) && !unique.has(cell.key)) unique.set(cell.key, cell);
  }
  const candidates = [...unique.values()].sort((left, right) => left.key.localeCompare(right.key, 'en', { numeric: true }));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  const platform = mobile ? 'mobile' : 'desktop';
  const hardMaximum = HARD_MAX[platform];
  const maximum = clamp(
    Math.trunc(finite(options.maxCount, DEFAULT_MAX[platform])),
    0,
    hardMaximum,
  );
  const density = clamp(finite(options.density, DEFAULT_DENSITY), 0, 0.05);
  const naturalCount = Math.round(candidates.length * density * (mobile ? 0.62 : 1));
  const defaultMinimum = candidates.length >= 32 ? 1 : 0;
  const minimum = clamp(Math.trunc(finite(options.minCount, defaultMinimum)), 0, maximum);
  const requestedCount = Number.isFinite(Number(options.count))
    ? Math.max(minimum, Math.trunc(Number(options.count)))
    : Math.max(minimum, naturalCount);
  const targetCount = clamp(requestedCount, 0, Math.min(maximum, candidates.length));
  const minimumDistance = clamp(Math.trunc(finite(options.minCellDistance, 2)), 0, 64);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= targetCount) break;
    if (farEnough(candidate, selected, minimumDistance)) selected.push(candidate);
  }
  // Spacing is a preference; explicit count/minCount is the contract. Backfill
  // from unique candidates when a cramped layout cannot satisfy both.
  for (const candidate of candidates) {
    if (selected.length >= targetCount) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  const types = availableTypes(options);
  return selected.map((cell, index) => {
    const type = weightedType(types, random);
    const keyHash = hashString(cell.key).toString(36);
    const incident = {
      version: 1,
      id: `incident-${String(index + 1).padStart(2, '0')}-${keyHash}-${type}`,
      type,
      cellIndex: cell.cellIndex,
      rotation: Number((random.next() * Math.PI * 2).toFixed(6)),
      offsetX: Number(((random.next() - 0.5) * 1.25).toFixed(4)),
      offsetZ: Number(((random.next() - 0.5) * 1.25).toFixed(4)),
      scale: Number((0.86 + random.next() * 0.26).toFixed(4)),
      variant: Math.floor(random.next() * 4),
      detailSeed: random.uint(),
    };
    if (cell.position) incident.position = { ...cell.position };
    return incident;
  });
}

function makeResources(THREE, palette = {}) {
  const color = (name, fallback) => palette[name] ?? fallback;
  return {
    geometries: {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(0.5, 10, 7),
      limb: new THREE.CylinderGeometry(0.5, 0.42, 1, 7),
      disk: new THREE.CircleGeometry(1, 16),
    },
    materials: {
      cloth: new THREE.MeshStandardMaterial({ color: color('cloth', 0x30332d), roughness: 0.96 }),
      clothLight: new THREE.MeshStandardMaterial({ color: color('clothLight', 0x55584d), roughness: 0.94 }),
      faded: new THREE.MeshStandardMaterial({ color: color('faded', 0x77705b), roughness: 0.9 }),
      rubber: new THREE.MeshStandardMaterial({ color: color('rubber', 0x171915), roughness: 0.88 }),
      metal: new THREE.MeshStandardMaterial({ color: color('metal', 0x4d514a), roughness: 0.66, metalness: 0.28 }),
      paper: new THREE.MeshStandardMaterial({ color: color('paper', 0xb8ae8a), roughness: 1, side: THREE.DoubleSide }),
      shadow: new THREE.MeshBasicMaterial({ color: color('shadow', 0x080908), transparent: true, opacity: 0.24, depthWrite: false }),
      motes: new THREE.PointsMaterial({
        color: color('motes', 0x080a08),
        size: 0.048,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      }),
    },
  };
}

function configureMesh(mesh, shadows) {
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  return mesh;
}

function addBox(THREE, group, resources, material, position, scale, rotation, shadows) {
  const mesh = configureMesh(new THREE.Mesh(resources.geometries.box, material), shadows);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function makeInstances(THREE, geometry, material, transforms, shadows) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const helper = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    helper.position.set(...transform.position);
    helper.rotation.set(...(transform.rotation || [0, 0, 0]));
    helper.scale.set(...transform.scale);
    helper.updateMatrix();
    mesh.setMatrixAt(index, helper.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return configureMesh(mesh, shadows);
}

function buildCollapsedWanderer(THREE, resources, item, shadows) {
  const group = new THREE.Group();
  group.name = 'collapsed_wanderer_non_graphic';
  const torso = addBox(
    THREE,
    group,
    resources,
    resources.materials.cloth,
    [0, 0.27, 0],
    [0.58, 0.31, 0.92],
    [0.08, 0, item.variant % 2 ? -0.14 : 0.12],
    shadows,
  );
  torso.name = 'still_clothed_torso';
  const head = configureMesh(new THREE.Mesh(resources.geometries.sphere, resources.materials.faded), shadows);
  head.name = 'obscured_head';
  head.position.set(0.08, 0.28, -0.66);
  head.scale.set(0.24, 0.2, 0.24);
  group.add(head);
  const limbs = [
    { position: [-0.36, 0.16, -0.12], scale: [0.11, 0.58, 0.11], rotation: [Math.PI / 2, 0, -0.38] },
    { position: [0.37, 0.14, 0.03], scale: [0.1, 0.55, 0.1], rotation: [Math.PI / 2, 0, 0.48] },
    { position: [-0.22, 0.15, 0.67], scale: [0.13, 0.72, 0.13], rotation: [Math.PI / 2, 0, -0.2] },
    { position: [0.27, 0.14, 0.65], scale: [0.13, 0.68, 0.13], rotation: [Math.PI / 2, 0, 0.24] },
  ];
  group.add(makeInstances(THREE, resources.geometries.limb, resources.materials.cloth, limbs, shadows));
  group.userData.description = 'A motionless, fully clothed wanderer; no graphic detail.';
  return group;
}

function buildAbandonedPack(THREE, resources, item, shadows) {
  const group = new THREE.Group();
  group.name = 'abandoned_pack';
  addBox(THREE, group, resources, resources.materials.clothLight, [0, 0.3, 0], [0.66, 0.58, 0.34], [0.06, 0, -0.08], shadows);
  addBox(THREE, group, resources, resources.materials.cloth, [0, 0.53, -0.12], [0.62, 0.18, 0.16], [-0.14, 0, 0], shadows);
  addBox(THREE, group, resources, resources.materials.rubber, [-0.25, 0.31, 0.2], [0.08, 0.5, 0.06], [0, 0, -0.25], shadows);
  const paper = configureMesh(new THREE.Mesh(resources.geometries.box, resources.materials.paper), false);
  paper.position.set(0.58 + item.variant * 0.06, 0.018, 0.2);
  paper.scale.set(0.42, 0.012, 0.31);
  paper.rotation.y = -0.45;
  group.add(paper);
  return group;
}

function buildChairPile(THREE, resources, item, shadows) {
  const group = new THREE.Group();
  group.name = 'chair_pile';
  const transforms = [];
  const chairCount = 2 + (item.variant % 2);
  for (let chair = 0; chair < chairCount; chair += 1) {
    const direction = chair % 2 ? -1 : 1;
    const x = (chair - (chairCount - 1) / 2) * 0.52;
    const z = (chair % 2 - 0.5) * 0.34;
    const tilt = direction * (0.18 + chair * 0.07);
    transforms.push({ position: [x, 0.58, z], scale: [0.56, 0.1, 0.55], rotation: [tilt, chair * 0.7, 0.08 * direction] });
    transforms.push({ position: [x, 0.98, z + direction * 0.22], scale: [0.56, 0.7, 0.09], rotation: [tilt, chair * 0.7, 0.08 * direction] });
    for (const sideX of [-0.22, 0.22]) {
      for (const sideZ of [-0.2, 0.2]) {
        transforms.push({
          position: [x + sideX, 0.3, z + sideZ],
          scale: [0.065, 0.58, 0.065],
          rotation: [tilt * 0.35, chair * 0.7, direction * 0.06],
        });
      }
    }
  }
  group.add(makeInstances(THREE, resources.geometries.box, resources.materials.metal, transforms, shadows));
  return group;
}

function buildBlackMotes(THREE, resources, item) {
  const group = new THREE.Group();
  group.name = 'black_motes';
  const random = createRandom(item.detailSeed);
  const count = 34 + (item.variant % 4) * 8;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 0.18 + random.next() * 0.84;
    const angle = random.next() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0.08 + random.next() * 1.55;
    positions[index * 3 + 2] = Math.sin(angle) * radius * 0.72;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(geometry, resources.materials.motes);
  motes.name = 'mote_cloud_single_draw';
  group.add(motes);
  const shadow = new THREE.Mesh(resources.geometries.disk, resources.materials.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.scale.set(0.72, 0.52, 1);
  group.add(shadow);
  return group;
}

function buildShoeTrail(THREE, resources, item, shadows) {
  const group = new THREE.Group();
  group.name = 'strange_shoe_trail';
  const random = createRandom(item.detailSeed);
  const count = 6 + item.variant;
  const transforms = [];
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 ? 1 : -1;
    transforms.push({
      position: [side * (0.14 + random.next() * 0.05), 0.045, (index - (count - 1) / 2) * 0.31],
      scale: [0.17, 0.08, 0.34],
      rotation: [0, side * (0.08 + random.next() * 0.16), 0],
    });
  }
  group.add(makeInstances(THREE, resources.geometries.box, resources.materials.rubber, transforms, shadows));
  return group;
}

function buildIncident(THREE, resources, item, shadows) {
  if (item.type === 'collapsed-wanderer') return buildCollapsedWanderer(THREE, resources, item, shadows);
  if (item.type === 'abandoned-pack') return buildAbandonedPack(THREE, resources, item, shadows);
  if (item.type === 'chair-pile') return buildChairPile(THREE, resources, item, shadows);
  if (item.type === 'black-motes') return buildBlackMotes(THREE, resources, item);
  if (item.type === 'shoe-trail') return buildShoeTrail(THREE, resources, item, shadows);
  return null;
}

/**
 * Builds a single disposable root for a plan. Geometry and materials are shared
 * across incidents, while repeated chairs, limbs, shoes, and motes are batched.
 */
export function buildIncidentGroup(THREE, plan = [], options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) throw new TypeError('A compatible Three.js namespace is required.');
  const root = new THREE.Group();
  root.name = 'procedural_incidents';
  root.userData.incidentCount = 0;
  root.userData.disposed = false;
  if (!Array.isArray(plan) || plan.length === 0) {
    root.userData.dispose = () => disposeIncidentGroup(root);
    return root;
  }

  const resources = makeResources(THREE, options.palette);
  const shadows = options.shadows ?? options.mobile !== true;
  const cellToWorld = typeof options.cellToWorld === 'function'
    ? options.cellToWorld
    : () => ({ x: 0, y: 0, z: 0 });
  for (const item of plan) {
    if (!item || !TYPE_IDS.has(String(item.type))) continue;
    const incident = buildIncident(THREE, resources, item, shadows);
    if (!incident) continue;
    const mapped = item.position || cellToWorld(item.cellIndex);
    const x = finite(mapped?.x, 0) + finite(item.offsetX, 0);
    const z = finite(mapped?.z, 0) + finite(item.offsetZ, 0);
    const y = options.floorY === undefined ? finite(mapped?.y, 0) : finite(options.floorY, 0);
    incident.name = `incident_${String(item.id || item.type)}`;
    incident.position.set(x, y, z);
    incident.rotation.y = finite(item.rotation, 0);
    incident.scale.setScalar(clamp(finite(item.scale, 1), 0.4, 2));
    incident.userData.incidentId = String(item.id || '');
    incident.userData.incidentType = String(item.type);
    incident.userData.cellIndex = item.cellIndex;
    root.add(incident);
    root.userData.incidentCount += 1;
  }
  root.userData.dispose = () => disposeIncidentGroup(root);
  return root;
}

/** Removes the group from its parent and disposes every unique GPU resource. */
export function disposeIncidentGroup(group) {
  if (!group || group.userData?.disposed) return false;
  const geometries = new Set();
  const materials = new Set();
  group.traverse?.((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  materials.forEach((material) => {
    for (const value of Object.values(material)) {
      if (value?.isTexture) value.dispose?.();
    }
    material.dispose?.();
  });
  group.removeFromParent?.();
  group.clear?.();
  group.userData.disposed = true;
  group.userData.incidentCount = 0;
  return true;
}
