/**
 * Network teammate lifecycle and interpolation for Three.js r178+.
 * Character geometry, animation, and appearance live in auto-discovered
 * plugins under src/characters instead of in this manager.
 */

import { characterCatalog as defaultCharacterCatalog } from './characters/index.js';
import { hashCharacterKey, validateCharacterDefinition } from './characters/catalog.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const localNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function requireThree(THREE) {
  if (!THREE || typeof THREE.Group !== 'function' || typeof THREE.Mesh !== 'function') {
    throw new TypeError('createRemotePlayerManager requires the active Three.js namespace.');
  }
}

function readPosition(target, position) {
  if (Array.isArray(position)) {
    target.set(
      finiteNumber(position[0], target.x),
      finiteNumber(position[1], target.y),
      finiteNumber(position[2], target.z),
    );
    return true;
  }
  if (position && typeof position === 'object') {
    target.set(
      finiteNumber(position.x, target.x),
      finiteNumber(position.y, target.y),
      finiteNumber(position.z, target.z),
    );
    return true;
  }
  return false;
}

function readYaw(snapshot) {
  if (Number.isFinite(snapshot.yaw)) return snapshot.yaw;
  const isQuaternionLike = (value) => Boolean(
    value
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Number.isFinite(value.z)
    && Number.isFinite(value.w),
  );
  const quaternion = isQuaternionLike(snapshot.quaternion)
    ? snapshot.quaternion
    : isQuaternionLike(snapshot.rotation)
      ? snapshot.rotation
      : null;
  if (quaternion) {
    const sinYaw = 2 * (quaternion.w * quaternion.y + quaternion.x * quaternion.z);
    const cosYaw = 1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
    return Math.atan2(sinYaw, cosYaw);
  }
  if (Number.isFinite(snapshot.rotation?.y)) return snapshot.rotation.y;
  return null;
}

function inferSpeed(snapshot, previousPosition, nextPosition, elapsedSinceSnapshot) {
  if (Number.isFinite(snapshot.speed)) return clamp(Math.abs(snapshot.speed), 0, 12);
  const velocity = snapshot.velocity;
  if (velocity && Number.isFinite(velocity.x) && Number.isFinite(velocity.z)) {
    return clamp(Math.hypot(velocity.x, velocity.z), 0, 12);
  }
  if (elapsedSinceSnapshot > 0.008 && elapsedSinceSnapshot < 2) {
    const horizontalDistance = Math.hypot(
      nextPosition.x - previousPosition.x,
      nextPosition.z - previousPosition.z,
    );
    return clamp(horizontalDistance / elapsedSinceSnapshot, 0, 12);
  }
  return 0;
}

function validateFactory(definition, factory) {
  if (!factory || typeof factory.create !== 'function' || typeof factory.dispose !== 'function') {
    throw new TypeError(
      `Character ${definition.id} factory must return { create(snapshot), dispose() }.`,
    );
  }
  return factory;
}

function validateAvatar(definition, avatar) {
  const requiredMethods = ['setColor', 'setName', 'setFlashlightEnabled', 'animate', 'dispose'];
  const root = avatar?.root;
  const validRoot = Boolean(
    root?.isObject3D
    && typeof root.position?.copy === 'function'
    && typeof root.position?.set === 'function'
    && typeof root.quaternion?.copy === 'function'
    && typeof root.rotation === 'object',
  );
  if (!avatar || !validRoot || !avatar.rig || typeof avatar.rig !== 'object') {
    throw new TypeError(`Character ${definition.id} create(snapshot) must return an avatar with root and rig.`);
  }
  const missing = requiredMethods.find((method) => typeof avatar[method] !== 'function');
  if (missing) {
    throw new TypeError(`Character ${definition.id} avatar must implement ${missing}().`);
  }
  return avatar;
}

function safeDefinitionId(definition, fallback = 'unknown-character') {
  try {
    return typeof definition?.id === 'string' && definition.id ? definition.id : fallback;
  } catch {
    return fallback;
  }
}

function safeDefinitionVersion(definition) {
  try {
    return typeof definition?.version === 'string' ? definition.version : null;
  } catch {
    return null;
  }
}

function makeInertAvatar(THREE, playerId) {
  const root = new THREE.Group();
  root.name = `remote_player_${String(playerId)}_unavailable`;
  return {
    root,
    rig: {},
    setColor() {},
    setName() {},
    setFlashlightEnabled() {},
    animate() {},
    dispose() {
      if (root.parent) root.parent.remove(root);
    },
  };
}

const INERT_CHARACTER = Object.freeze({
  id: 'unavailable-character',
  name: 'Unavailable Character',
  version: '1.0.0',
});

/**
 * Creates a manager for networked teammate visuals.
 *
 * Snapshot shape:
 * { id, characterId?, name, position:{x,y,z}|[x,y,z], yaw, pitch, speed,
 *   velocity, running, crouching, flashlight, color, visible }
 *
 * `characterId` selects a registered character plugin. When absent or unknown,
 * every peer deterministically selects one from the player id. `pitch` follows
 * camera convention: positive looks up. Position is the player's floor point.
 * `config.characterCatalog` may inject an equivalent catalog (primarily for
 * tests). `config.onCharacterError({ characterId, stage, error })` receives one
 * diagnostic before a broken plugin is quarantined and replaced.
 */
export function createRemotePlayerManager(THREE, scene, config = {}) {
  requireThree(THREE);
  if (!scene || typeof scene.add !== 'function') {
    throw new TypeError('createRemotePlayerManager requires a Three.js scene or Object3D parent.');
  }

  const {
    characterCatalog: injectedCharacterCatalog,
    onCharacterError,
    ...optionOverrides
  } = config;
  const options = {
    camera: null,
    avatarScale: 1,
    defaultColor: 0x596653,
    castShadow: true,
    receiveShadow: false,
    nameTags: true,
    nameTagDistance: 24,
    nameTagHeight: 1.94,
    crouchNameTagHeight: 1.7,
    flashlights: true,
    flashlightBeams: true,
    flashlightColor: 0xffedbd,
    flashlightIntensity: 34,
    flashlightDistance: 15,
    flashlightAngle: 0.34,
    beamOpacity: 0.032,
    positionSmoothing: 14,
    rotationSmoothing: 16,
    pitchSmoothing: 15,
    teleportDistance: 8,
    staleMotionDelay: 0.45,
    staleMotionDecay: 7,
    ...optionOverrides,
  };
  const players = new Map();
  const factories = new Map();
  const quarantinedObjects = new WeakSet();
  const quarantinedValues = new Set();
  const reportedObjects = new WeakSet();
  const reportedValues = new Set();
  let disposed = false;

  const objectLike = (value) => (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
  const tracked = (objectSet, valueSet, value) => (
    objectLike(value) ? objectSet.has(value) : valueSet.has(value)
  );
  const track = (objectSet, valueSet, value) => {
    if (objectLike(value)) objectSet.add(value);
    else valueSet.add(value);
  };
  const reportFailure = (definition, stage, cause) => {
    if (tracked(reportedObjects, reportedValues, definition)) return;
    track(reportedObjects, reportedValues, definition);
    const error = cause instanceof Error ? cause : new Error(String(cause));
    const detail = Object.freeze({
      characterId: safeDefinitionId(definition),
      stage,
      error,
    });
    if (typeof onCharacterError === 'function') {
      try {
        onCharacterError(detail);
      } catch {
        // Diagnostics must never become a second render failure.
      }
      return;
    }
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      try {
        console.error(
          `[characters] Quarantined ${detail.characterId} after ${stage} failed.`,
          error,
        );
      } catch {
        // A patched console must not be able to break the player listener.
      }
    }
  };
  const quarantine = (definition, stage, error) => {
    track(quarantinedObjects, quarantinedValues, definition);
    reportFailure(definition, stage, error);
  };
  const isQuarantined = (definition) => tracked(
    quarantinedObjects,
    quarantinedValues,
    definition,
  );

  const requestedCatalog = injectedCharacterCatalog || defaultCharacterCatalog;
  let definitions;
  try {
    if (!Array.isArray(requestedCatalog?.definitions) || requestedCatalog.definitions.length === 0) {
      throw new TypeError('Character catalog must expose a non-empty definitions array.');
    }
    definitions = [...requestedCatalog.definitions];
  } catch (error) {
    reportFailure(requestedCatalog, 'catalog', error);
    definitions = [...defaultCharacterCatalog.definitions];
  }

  const selectDefinition = (playerId, characterId) => {
    const explicitId = characterId === undefined || characterId === null
      ? ''
      : String(characterId).trim();
    if (explicitId) {
      const explicit = definitions.find((definition) => (
        safeDefinitionId(definition, '') === explicitId
      ));
      if (explicit) return explicit;
    }
    return definitions[hashCharacterKey(playerId) % definitions.length] || null;
  };
  const candidateDefinitions = (preferred) => {
    const candidates = [];
    const seen = new Set();
    const add = (definition) => {
      if (definition === undefined || definition === null || seen.has(definition)) return;
      seen.add(definition);
      candidates.push(definition);
    };
    add(preferred);
    add(definitions.find((definition) => safeDefinitionId(definition, '') === 'threshold-surveyor'));
    definitions.forEach(add);
    return candidates;
  };

  const getFactory = (definition) => {
    let factory = factories.get(definition);
    if (factory) return factory;
    factory = validateFactory(definition, definition.createFactory({
      THREE,
      options,
      helpers: Object.freeze({ clamp }),
    }));
    factories.set(definition, factory);
    return factory;
  };

  const tryCreateAvatar = (definition, snapshot) => {
    if (isQuarantined(definition)) return null;
    try {
      validateCharacterDefinition(definition, `character ${safeDefinitionId(definition)}`);
    } catch (error) {
      quarantine(definition, 'definition', error);
      return null;
    }
    let factory;
    try {
      factory = getFactory(definition);
    } catch (error) {
      quarantine(definition, 'factory', error);
      return null;
    }
    let avatar = null;
    try {
      avatar = factory.create(snapshot);
      validateAvatar(definition, avatar);
      return { definition, avatar };
    } catch (error) {
      if (avatar && typeof avatar.dispose === 'function') {
        try {
          avatar.dispose();
        } catch {
          // The original create/validation failure is the actionable cause.
        }
      }
      quarantine(definition, 'create', error);
      return null;
    }
  };

  const createAvatarWithFallback = (snapshot, preferred) => {
    for (const definition of candidateDefinitions(preferred)) {
      const created = tryCreateAvatar(definition, snapshot);
      if (created) return created;
    }
    return {
      definition: INERT_CHARACTER,
      avatar: makeInertAvatar(THREE, snapshot.id),
    };
  };

  const disposeEntryAvatar = (entry) => {
    try {
      entry.avatar.dispose();
    } catch (error) {
      quarantine(entry.character, 'dispose', error);
      if (entry.group?.parent) entry.group.parent.remove(entry.group);
    }
  };

  const entrySnapshot = (entry) => ({
    id: entry.id,
    name: entry.name,
    color: entry.color,
    flashlight: entry.flashlight,
    visible: entry.visible,
    crouching: entry.crouching,
    running: entry.running,
    pitch: entry.targetPitch,
    speed: entry.targetSpeed,
  });

  const installAvatar = (entry, created) => {
    const previousGroup = entry.group;
    let positionX = entry.targetPosition.x;
    let positionY = entry.targetPosition.y;
    let positionZ = entry.targetPosition.z;
    let displayedYaw = entry.targetYaw;
    try {
      positionX = finiteNumber(previousGroup?.position?.x, positionX);
      positionY = finiteNumber(previousGroup?.position?.y, positionY);
      positionZ = finiteNumber(previousGroup?.position?.z, positionZ);
      displayedYaw = finiteNumber(previousGroup?.rotation?.y, displayedYaw);
    } catch {
      // A failed animation may have corrupted its own transform; target state is safe.
    }
    created.avatar.root.position.set(positionX, positionY, positionZ);
    created.avatar.root.rotation.y = displayedYaw;
    created.avatar.root.visible = entry.visible;
    disposeEntryAvatar(entry);
    scene.add(created.avatar.root);
    entry.characterId = safeDefinitionId(created.definition, INERT_CHARACTER.id);
    entry.characterVersion = safeDefinitionVersion(created.definition);
    entry.character = created.definition;
    entry.avatar = created.avatar;
    entry.group = created.avatar.root;
    entry.rig = created.avatar.rig;
  };

  const replaceBrokenAvatar = (entry, stage, error) => {
    quarantine(entry.character, stage, error);
    const created = createAvatarWithFallback(entrySnapshot(entry), null);
    installAvatar(entry, created);
  };

  const invokeAvatar = (entry, stage, callback) => {
    try {
      callback(entry.avatar);
      return true;
    } catch (error) {
      replaceBrokenAvatar(entry, stage, error);
      return false;
    }
  };

  const readonlyPlayers = Object.freeze({
    get size() {
      return players.size;
    },
    has(id) {
      return players.has(String(id));
    },
    get(id) {
      return players.get(String(id));
    },
    keys() {
      return players.keys();
    },
    values() {
      return players.values();
    },
    entries() {
      return players.entries();
    },
    forEach(callback, thisArg) {
      players.forEach((entry, id) => callback.call(thisArg, entry, id, readonlyPlayers));
    },
    [Symbol.iterator]() {
      return players[Symbol.iterator]();
    },
  });

  const manager = {
    get players() {
      return readonlyPlayers;
    },

    get size() {
      return players.size;
    },

    has(id) {
      return players.has(String(id));
    },

    get(id) {
      return players.get(String(id)) || null;
    },

    keys() {
      return players.keys();
    },

    values() {
      return players.values();
    },

    entries() {
      return players.entries();
    },

    forEach(callback, thisArg) {
      readonlyPlayers.forEach(callback, thisArg);
    },

    [Symbol.iterator]() {
      return players.values();
    },

    upsert(snapshot) {
      if (disposed) throw new Error('Remote player manager has been disposed.');
      if (!snapshot || snapshot.id === undefined || snapshot.id === null) {
        throw new TypeError('Remote player snapshots require an id.');
      }
      const id = String(snapshot.id);
      const receivedAt = localNow();
      const preferredDefinition = selectDefinition(id, snapshot.characterId);
      let entry = players.get(id);

      if (!entry) {
        const created = createAvatarWithFallback({ ...snapshot, id }, preferredDefinition);
        const { definition, avatar } = created;
        const initialPosition = new THREE.Vector3();
        readPosition(initialPosition, snapshot.position);
        avatar.root.position.copy(initialPosition);
        const initialYaw = readYaw(snapshot) ?? 0;
        avatar.root.rotation.y = initialYaw;
        scene.add(avatar.root);
        entry = {
          id,
          characterId: safeDefinitionId(definition, INERT_CHARACTER.id),
          characterVersion: safeDefinitionVersion(definition),
          character: definition,
          avatar,
          group: avatar.root,
          rig: avatar.rig,
          targetPosition: initialPosition.clone(),
          previousTargetPosition: initialPosition.clone(),
          nextPosition: initialPosition.clone(),
          targetYaw: initialYaw,
          targetPitch: Number.isFinite(snapshot.pitch) ? clamp(snapshot.pitch, -1.45, 1.45) : 0,
          displayPitch: 0,
          targetSpeed: inferSpeed(snapshot, initialPosition, initialPosition, 0),
          displaySpeed: 0,
          running: Boolean(snapshot.running),
          crouching: Boolean(snapshot.crouching),
          crouchAmount: snapshot.crouching ? 1 : 0,
          gaitPhase: 0,
          animationTime: 0,
          lastReceivedAt: receivedAt,
          lastSnapshotAt: receivedAt,
          name: String(snapshot.name || 'TEAMMATE'),
          color: snapshot.color ?? options.defaultColor,
          flashlight: snapshot.flashlight !== false,
          visible: snapshot.visible !== false,
        };
        players.set(id, entry);
      } else {
        if (
          preferredDefinition
          && !isQuarantined(preferredDefinition)
          && safeDefinitionId(preferredDefinition) !== entry.characterId
        ) {
          const created = createAvatarWithFallback({
            ...snapshot,
            id,
            name: snapshot.name ?? entry.name,
            color: snapshot.color ?? entry.color,
            flashlight: snapshot.flashlight ?? entry.flashlight,
          }, preferredDefinition);
          installAvatar(entry, created);
        }
        entry.previousTargetPosition.copy(entry.targetPosition);
        entry.nextPosition.copy(entry.targetPosition);
        if (readPosition(entry.nextPosition, snapshot.position)) entry.targetPosition.copy(entry.nextPosition);
        const elapsedSinceSnapshot = receivedAt - entry.lastSnapshotAt;
        entry.targetSpeed = inferSpeed(
          snapshot,
          entry.previousTargetPosition,
          entry.targetPosition,
          elapsedSinceSnapshot,
        );
        const yaw = readYaw(snapshot);
        if (yaw !== null) entry.targetYaw = yaw;
        if (Number.isFinite(snapshot.pitch)) entry.targetPitch = clamp(snapshot.pitch, -1.45, 1.45);
        if (snapshot.running !== undefined) entry.running = Boolean(snapshot.running);
        if (snapshot.crouching !== undefined) entry.crouching = Boolean(snapshot.crouching);
        if (snapshot.name !== undefined && String(snapshot.name) !== entry.name) {
          entry.name = String(snapshot.name || 'TEAMMATE');
          invokeAvatar(entry, 'setName', (avatar) => avatar.setName(entry.name));
        }
        if (snapshot.color !== undefined && snapshot.color !== entry.color) {
          entry.color = snapshot.color;
          invokeAvatar(entry, 'setColor', (avatar) => avatar.setColor(entry.color));
        }
        entry.lastSnapshotAt = receivedAt;
      }

      if (snapshot.flashlight !== undefined) {
        entry.flashlight = Boolean(snapshot.flashlight);
        invokeAvatar(
          entry,
          'setFlashlightEnabled',
          (avatar) => avatar.setFlashlightEnabled(entry.flashlight),
        );
      }
      if (snapshot.visible !== undefined) {
        entry.visible = Boolean(snapshot.visible);
        entry.group.visible = entry.visible;
      }
      entry.lastReceivedAt = receivedAt;

      if (entry.group.position.distanceToSquared(entry.targetPosition) > options.teleportDistance ** 2) {
        entry.group.position.copy(entry.targetPosition);
        entry.group.rotation.y = entry.targetYaw;
        const hasVelocity = Number.isFinite(snapshot.velocity?.x) && Number.isFinite(snapshot.velocity?.z);
        if (!Number.isFinite(snapshot.speed) && !hasVelocity) entry.targetSpeed = 0;
        entry.displaySpeed = 0;
        entry.gaitPhase = 0;
      }
      return entry;
    },

    update(deltaSeconds, camera = options.camera) {
      if (disposed) return;
      const delta = clamp(Number(deltaSeconds) || 0, 0, 0.1);
      const positionAlpha = 1 - Math.exp(-options.positionSmoothing * delta);
      const rotationAlpha = 1 - Math.exp(-options.rotationSmoothing * delta);
      const pitchAlpha = 1 - Math.exp(-options.pitchSmoothing * delta);
      const now = localNow();

      players.forEach((entry) => {
        try {
          if (now - entry.lastReceivedAt > options.staleMotionDelay) {
            const staleDecay = Math.exp(-options.staleMotionDecay * delta);
            entry.targetSpeed *= staleDecay;
            entry.displaySpeed *= staleDecay;
            if (entry.targetSpeed < 0.01) entry.targetSpeed = 0;
            if (entry.displaySpeed < 0.01) entry.displaySpeed = 0;
          }
          entry.group.position.lerp(entry.targetPosition, positionAlpha);
          const yawDelta = Math.atan2(
            Math.sin(entry.targetYaw - entry.group.rotation.y),
            Math.cos(entry.targetYaw - entry.group.rotation.y),
          );
          entry.group.rotation.y += yawDelta * rotationAlpha;
          entry.group.rotation.y = Math.atan2(
            Math.sin(entry.group.rotation.y),
            Math.cos(entry.group.rotation.y),
          );
          entry.displayPitch += (entry.targetPitch - entry.displayPitch) * pitchAlpha;
          entry.animationTime += delta;
          invokeAvatar(entry, 'animate', (avatar) => avatar.animate(entry, delta));

          const tag = entry.rig.tag;
          if (tag && camera?.position) {
            const distance = camera.position.distanceTo(entry.group.position);
            const fadeStart = options.nameTagDistance * 0.72;
            tag.material.opacity = clamp(
              1 - (distance - fadeStart) / Math.max(0.01, options.nameTagDistance - fadeStart),
              0,
              0.92,
            );
            tag.sprite.visible = distance < options.nameTagDistance;
          }
        } catch (error) {
          replaceBrokenAvatar(entry, 'update', error);
        }
      });
    },

    remove(id) {
      const key = String(id);
      const entry = players.get(key);
      if (!entry) return false;
      disposeEntryAvatar(entry);
      players.delete(key);
      return true;
    },

    pruneStale(maxAgeSeconds = 15) {
      const cutoff = localNow() - Math.max(0, Number(maxAgeSeconds) || 0);
      const removed = [];
      players.forEach((entry, id) => {
        if (entry.lastReceivedAt >= cutoff) return;
        disposeEntryAvatar(entry);
        players.delete(id);
        removed.push(id);
      });
      return removed;
    },

    clear() {
      players.forEach((entry) => disposeEntryAvatar(entry));
      players.clear();
    },

    dispose() {
      if (disposed) return;
      manager.clear();
      factories.forEach((factory, definition) => {
        try {
          factory.dispose();
        } catch (error) {
          quarantine(definition, 'factory.dispose', error);
        }
      });
      factories.clear();
      disposed = true;
    },
  };

  return manager;
}
