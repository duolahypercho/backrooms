import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { animateMonster, buildMonster } from './monster.js';

const MODEL_CLIPS = ['Idle', 'Glimpse', 'Stalk', 'Search', 'Chase', 'Attack'];

function createModelFixture({ clips = MODEL_CLIPS } = {}) {
  const scene = new THREE.Group();
  scene.name = 'PaleEntity_Scene';
  const armature = new THREE.Object3D();
  armature.name = 'PaleEntity_Armature';
  const modelNode = new THREE.Group();
  modelNode.name = 'PaleEntity_Mesh';
  const root = new THREE.Bone();
  root.name = 'ROOT';
  const geometry = new THREE.BoxGeometry(2, 4, 2);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'PaleEntity_Body';
  mesh.position.set(3, 3, -2);
  modelNode.add(mesh);
  armature.add(modelNode, root);
  scene.add(armature);
  return {
    gltf: {
      scene,
      animations: clips.map((name) => new THREE.AnimationClip(name, 1, [])),
    },
    scene,
    geometry,
    material,
    texture,
    mesh,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('The Still keeps its wire-rib reference silhouette and animated rig', () => {
  const monster = buildMonster(THREE, {
    identity: 'still',
    name: 'The Still',
    detail: 'medium',
    eyeGlow: false,
    seed: 42,
  });

  const ribMeshes = [];
  const neckLoops = [];
  monster.traverse((node) => {
    if (node.name.startsWith('still_open_rib_')) ribMeshes.push(node);
    if (node.name.startsWith('still_neck_loop_')) neckLoops.push(node);
  });

  assert.equal(monster.userData.identity, 'still');
  assert.equal(monster.userData.horror.presentation.silhouette, 'wire-rib-sentinel');
  assert.equal(ribMeshes.length, 5);
  assert.equal(neckLoops.length, 3);
  assert.ok(monster.getObjectByName('still_head_lobe_left'));
  assert.ok(monster.getObjectByName('still_head_lobe_right'));
  assert.equal(monster.getObjectByName('face').visible, false);
  assert.equal(monster.getObjectByName('mouth_cavity').visible, false);
  assert.ok(monster.userData.rig.left.upperArmMesh.scale.x < 0.4);

  animateMonster(monster, { time: 2.4, speed: 1.1, mode: 'stalk', distance: 7 });
  assert.ok(Number.isFinite(monster.userData.rig.head.rotation.x));
  assert.ok(Number.isFinite(monster.userData.rig.left.wrist.rotation.z));

  monster.userData.dispose();
});

test('The Still swaps from its invisible gameplay proxy to a normalized Blender model', async () => {
  const pending = deferred();
  const fixture = createModelFixture();
  const monster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: () => pending.promise,
    castShadow: false,
    receiveShadow: true,
  });

  assert.equal(monster.userData.model.status, 'loading');
  assert.equal(monster.userData.rig.rigRoot.visible, false);
  pending.resolve(fixture.gltf);
  assert.equal(await monster.userData.modelReady, true);

  const controller = monster.userData.model.controller;
  assert.equal(monster.userData.model.status, 'ready');
  assert.equal(monster.userData.rig.rigRoot.visible, false);
  assert.equal(controller.wrapper.parent, monster);
  assert.deepEqual(controller.wrapper.position.toArray(), [0, 0, 0]);
  assert.deepEqual(controller.wrapper.rotation.toArray().slice(0, 3), [0, 0, 0]);
  assert.deepEqual(controller.wrapper.scale.toArray(), [1, 1, 1]);
  assert.equal(fixture.mesh.castShadow, false);
  assert.equal(fixture.mesh.receiveShadow, true);

  controller.wrapper.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(controller.wrapper);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(bounds.min.y) < 1e-6, `model floor was ${bounds.min.y}`);
  assert.ok(Math.abs(size.y - 2.48) < 1e-6, `model height was ${size.y}`);
  assert.ok(Math.abs(center.x) < 1e-6, `model center x was ${center.x}`);
  assert.ok(Math.abs(center.z) < 1e-6, `model center z was ${center.z}`);

  monster.userData.dispose();
});

test('Blender clips cover every gameplay mode while the actor root remains in place', async () => {
  const fixture = createModelFixture();
  const monster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => fixture.gltf,
  });
  await monster.userData.modelReady;

  const expectations = [
    ['hidden', 'idle'],
    ['glimpse', 'glimpse'],
    ['stalk', 'stalk'],
    ['walk', 'stalk'],
    ['search', 'search'],
    ['chase', 'chase'],
    ['run', 'chase'],
    ['attack', 'attack'],
  ];
  expectations.forEach(([mode, activeMode], index) => {
    animateMonster(monster, {
      time: index * 0.2,
      speed: mode === 'chase' || mode === 'run' ? 3.2 : 1,
      mode,
      distance: 4,
    });
    assert.equal(monster.userData.model.activeMode, activeMode);
    assert.equal(monster.userData.animation.mode, mode);
    assert.deepEqual(monster.userData.model.controller.wrapper.position.toArray(), [0, 0, 0]);
    assert.deepEqual(monster.userData.model.controller.wrapper.rotation.toArray().slice(0, 3), [0, 0, 0]);
  });
  assert.equal(monster.userData.model.controller.actions.attack.loop, THREE.LoopOnce);
  assert.equal(monster.userData.model.controller.actions.chase.loop, THREE.LoopRepeat);

  monster.userData.dispose();
});

test('A missing or rejected Blender asset never exposes the primitive gameplay proxy', async () => {
  const missingClipFixture = createModelFixture({ clips: MODEL_CLIPS.filter((name) => name !== 'Attack') });
  const missingClipMonster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => missingClipFixture.gltf,
  });
  assert.equal(await missingClipMonster.userData.modelReady, false);
  assert.equal(missingClipMonster.userData.model.status, 'error');
  assert.match(missingClipMonster.userData.model.error.message, /Attack/);
  assert.equal(missingClipMonster.userData.rig.rigRoot.visible, false);
  animateMonster(missingClipMonster, { time: 1, speed: 1, mode: 'stalk', distance: 5 });
  assert.equal(missingClipMonster.userData.animation.mode, 'stalk');
  missingClipMonster.userData.dispose();

  const rejectedMonster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => { throw new Error('offline'); },
  });
  assert.equal(await rejectedMonster.userData.modelReady, false);
  assert.equal(rejectedMonster.userData.model.status, 'error');
  assert.equal(rejectedMonster.userData.rig.rigRoot.visible, false);
  rejectedMonster.userData.dispose();
});

test('A mixer failure removes the loaded model without revealing the primitive proxy', async () => {
  const fixture = createModelFixture();
  const monster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => fixture.gltf,
  });
  await monster.userData.modelReady;
  monster.userData.model.controller.animate = () => { throw new Error('mixer failed'); };

  animateMonster(monster, { time: 2, speed: 1.2, mode: 'search', distance: 5 });

  assert.equal(monster.userData.model.status, 'error');
  assert.match(monster.userData.model.error.message, /mixer failed/);
  assert.equal(monster.userData.rig.rigRoot.visible, false);
  assert.equal(monster.getObjectByName('pale_entity_visual_root'), undefined);
  assert.equal(monster.userData.animation.mode, 'search');
  monster.userData.dispose();
});

test('Model loading stays browser-only unless a test loader is supplied', async () => {
  const monster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
  });
  assert.equal(monster.userData.model.status, 'unavailable');
  assert.equal(await monster.userData.modelReady, false);
  assert.equal(monster.userData.rig.rigRoot.visible, false);
  monster.userData.dispose();

  let foremanLoads = 0;
  const foreman = buildMonster(THREE, {
    identity: 'foreman',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => {
      foremanLoads += 1;
      return createModelFixture().gltf;
    },
  });
  assert.equal(await foreman.userData.modelReady, true);
  assert.equal(foreman.userData.model.status, 'ready');
  assert.equal(foreman.userData.rig.rigRoot.visible, false);
  assert.equal(foremanLoads, 1);
  foreman.userData.dispose();
});

test('Model disposal is idempotent and safely releases a late load', async () => {
  const readyFixture = createModelFixture();
  let geometryDisposals = 0;
  let materialDisposals = 0;
  let textureDisposals = 0;
  readyFixture.geometry.addEventListener('dispose', () => { geometryDisposals += 1; });
  readyFixture.material.addEventListener('dispose', () => { materialDisposals += 1; });
  readyFixture.texture.addEventListener('dispose', () => { textureDisposals += 1; });
  const readyMonster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: async () => readyFixture.gltf,
  });
  await readyMonster.userData.modelReady;
  readyMonster.userData.dispose();
  readyMonster.userData.dispose();
  assert.equal(readyMonster.userData.model.status, 'disposed');
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(textureDisposals, 1);

  const pending = deferred();
  const lateFixture = createModelFixture();
  let lateGeometryDisposals = 0;
  lateFixture.geometry.addEventListener('dispose', () => { lateGeometryDisposals += 1; });
  const lateMonster = buildMonster(THREE, {
    identity: 'still',
    modelUrl: '/models/monsters/pale-entity.glb',
    modelLoader: () => pending.promise,
  });
  lateMonster.userData.dispose();
  pending.resolve(lateFixture.gltf);
  assert.equal(await lateMonster.userData.modelReady, false);
  assert.equal(lateMonster.userData.model.status, 'disposed');
  assert.equal(lateGeometryDisposals, 1);
  assert.equal(lateMonster.getObjectByName('pale_entity_visual_root'), undefined);
});
