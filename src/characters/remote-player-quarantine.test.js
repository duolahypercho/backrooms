import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createRemotePlayerManager } from '../remote-players.js';

function makeCharacter(id, behavior = {}) {
  const counters = {
    factory: 0,
    create: 0,
    animate: 0,
    disposeAvatar: 0,
    disposeFactory: 0,
  };
  const definition = {
    id,
    name: behavior.name || id,
    version: '1.0.0-test',
    order: behavior.order ?? 10,
    createFactory({ THREE: ActiveThree }) {
      counters.factory += 1;
      if (behavior.factoryError) throw new Error(`${id} factory exploded`);
      return {
        create(snapshot) {
          counters.create += 1;
          if (behavior.createError) throw new Error(`${id} create exploded`);
          const root = new ActiveThree.Group();
          root.name = `${id}_${snapshot.id}`;
          return {
            root,
            rig: {},
            setColor() {
              if (behavior.setterError === 'color') throw new Error(`${id} color exploded`);
            },
            setName() {
              if (behavior.setterError === 'name') throw new Error(`${id} name exploded`);
            },
            setFlashlightEnabled() {
              if (behavior.setterError === 'flashlight') throw new Error(`${id} light exploded`);
            },
            animate() {
              counters.animate += 1;
              if (behavior.animateError) throw new Error(`${id} animate exploded`);
            },
            dispose() {
              counters.disposeAvatar += 1;
              if (root.parent) root.parent.remove(root);
            },
          };
        },
        dispose() {
          counters.disposeFactory += 1;
        },
      };
    },
  };
  return { definition, counters };
}

function injectedCatalog(definitions) {
  return Object.freeze({ definitions: Object.freeze(definitions) });
}

const snapshot = (characterId) => ({
  id: 'peer-1',
  characterId,
  name: 'Mara',
  position: [1, 0, 2],
  flashlight: true,
});

test('invalid definitions, broken factories, and broken create calls fall back and report once', async (t) => {
  const cases = [
    {
      name: 'definition',
      stage: 'definition',
      broken: {
        id: 'broken-definition',
        name: 'Broken Definition',
        version: '1.0.0',
        order: 1,
      },
      attempts: () => 0,
    },
    (() => {
      const value = makeCharacter('broken-factory', { factoryError: true, order: 1 });
      return {
        name: 'factory',
        stage: 'factory',
        broken: value.definition,
        attempts: () => value.counters.factory,
      };
    })(),
    (() => {
      const value = makeCharacter('broken-create', { createError: true, order: 1 });
      return {
        name: 'create',
        stage: 'create',
        broken: value.definition,
        attempts: () => value.counters.create,
      };
    })(),
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, () => {
      const fallback = makeCharacter('threshold-surveyor', { order: 100 });
      const errors = [];
      const scene = new THREE.Scene();
      const manager = createRemotePlayerManager(THREE, scene, {
        characterCatalog: injectedCatalog([fixture.broken, fallback.definition]),
        onCharacterError: (detail) => errors.push(detail),
      });

      const first = assert.doesNotThrow(() => manager.upsert(snapshot(fixture.broken.id)));
      assert.equal(manager.get('peer-1').characterId, 'threshold-surveyor');
      assert.equal(scene.children.length, 1);
      assert.doesNotThrow(() => manager.upsert(snapshot(fixture.broken.id)));
      assert.equal(errors.length, 1);
      assert.equal(errors[0].characterId, fixture.broken.id);
      assert.equal(errors[0].stage, fixture.stage);
      if (fixture.stage !== 'definition') assert.equal(fixture.attempts(), 1);
      assert.equal(first, undefined);
      manager.dispose();
    });
  }
});

test('an animate failure is quarantined and swaps the existing player in place', () => {
  const broken = makeCharacter('glitch-runner', { animateError: true, order: 1 });
  const fallback = makeCharacter('threshold-surveyor', { order: 100 });
  const errors = [];
  const scene = new THREE.Scene();
  const manager = createRemotePlayerManager(THREE, scene, {
    characterCatalog: injectedCatalog([broken.definition, fallback.definition]),
    onCharacterError: (detail) => errors.push(detail),
  });

  const entry = manager.upsert(snapshot('glitch-runner'));
  const brokenRoot = entry.group;
  assert.equal(entry.characterId, 'glitch-runner');
  assert.doesNotThrow(() => manager.update(1 / 60));
  assert.equal(entry.characterId, 'threshold-surveyor');
  assert.equal(entry.characterVersion, '1.0.0-test');
  assert.notEqual(entry.group, brokenRoot);
  assert.equal(brokenRoot.parent, null);
  assert.equal(scene.children.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].stage, 'animate');

  assert.doesNotThrow(() => manager.update(1 / 60));
  assert.equal(errors.length, 1);
  assert.equal(broken.counters.animate, 1);
  manager.dispose();
});

test('all broken plugins degrade to an inert player instead of throwing', () => {
  const broken = makeCharacter('only-broken', { createError: true });
  const errors = [];
  const scene = new THREE.Scene();
  const manager = createRemotePlayerManager(THREE, scene, {
    characterCatalog: injectedCatalog([broken.definition]),
    onCharacterError: (detail) => errors.push(detail),
  });

  assert.doesNotThrow(() => manager.upsert(snapshot('only-broken')));
  assert.equal(manager.get('peer-1').characterId, 'unavailable-character');
  assert.equal(scene.children.length, 1);
  assert.doesNotThrow(() => manager.update(1 / 60));
  assert.equal(errors.length, 1);
  manager.dispose();
});
