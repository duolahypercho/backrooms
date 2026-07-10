import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import character from './character.js';

const options = {
  avatarScale: 1,
  defaultColor: 0x596653,
  castShadow: true,
  receiveShadow: false,
  nameTags: true,
  nameTagHeight: 1.94,
  crouchNameTagHeight: 1.7,
  flashlights: true,
  flashlightBeams: true,
  flashlightColor: 0xffedbd,
  flashlightIntensity: 34,
  flashlightDistance: 15,
  flashlightAngle: 0.34,
  beamOpacity: 0.032,
};

function bootSoleClearance(avatar) {
  avatar.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  avatar.root.traverse((node) => {
    if (!node.isMesh || !node.name.endsWith('_boot_sole')) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  return bounds.min.y;
}

test('Threshold Surveyor factory creates a complete animated avatar in Node', () => {
  const factory = character.createFactory({ THREE, options });
  const avatar = factory.create({ id: 'peer-1', name: 'Mara', flashlight: true });
  const entry = {
    avatar,
    targetSpeed: 2,
    displaySpeed: 0,
    crouching: false,
    crouchAmount: 0,
    running: false,
    gaitPhase: 0,
    animationTime: 0.1,
    displayPitch: 0.2,
  };

  assert.equal(avatar.root.name, 'remote_player_peer-1');
  assert.equal(avatar.rig.flashlight.visible, true);
  avatar.animate(entry, 1 / 60);
  assert.ok(entry.displaySpeed > 0);
  assert.ok(Number.isFinite(avatar.rig.head.rotation.x));
  avatar.setFlashlightEnabled(false);
  assert.equal(avatar.rig.flashlight.visible, false);

  avatar.dispose();
  factory.dispose();
  assert.throws(() => factory.create({ id: 'late' }), /disposed/);
});

test('Threshold Surveyor keeps a planted boot at the floor while walking', () => {
  const factory = character.createFactory({ THREE, options });
  const avatar = factory.create({ id: 'peer-floor', name: 'Mara', flashlight: false });
  const entry = {
    avatar,
    targetSpeed: 0,
    displaySpeed: 0,
    crouching: false,
    crouchAmount: 0,
    running: false,
    gaitPhase: 0,
    animationTime: 0,
    displayPitch: 0,
  };

  avatar.animate(entry, 0);
  assert.ok(Math.abs(bootSoleClearance(avatar) - 0.0025) < 0.001);

  let minimumClearance = Infinity;
  let maximumClearance = -Infinity;
  for (const speed of [0.575, 1, 1.5, 2, 2.3]) {
    for (let sample = 0; sample < 32; sample += 1) {
      entry.targetSpeed = speed;
      entry.displaySpeed = speed;
      entry.gaitPhase = sample / 32 * Math.PI * 2;
      entry.animationTime = sample / 10;
      avatar.animate(entry, 0);
      const clearance = bootSoleClearance(avatar);
      minimumClearance = Math.min(minimumClearance, clearance);
      maximumClearance = Math.max(maximumClearance, clearance);
    }
  }
  assert.ok(minimumClearance >= -0.006, `boot penetrated floor by ${-minimumClearance}m`);
  assert.ok(maximumClearance <= 0.012, `both boots floated ${maximumClearance}m above floor`);

  avatar.dispose();
  factory.dispose();
});

test('Threshold Surveyor equipment panels remain visible above the suit and pack shells', () => {
  const factory = character.createFactory({ THREE, options });
  const avatar = factory.create({ id: 'peer-details', name: 'Mara', flashlight: false });
  avatar.root.updateMatrixWorld(true);

  const chestRay = new THREE.Raycaster(
    new THREE.Vector3(0, 1.385, 1),
    new THREE.Vector3(0, 0, -1),
  );
  const chestHits = chestRay.intersectObjects([
    avatar.root.getObjectByName('torso_flesh'),
    avatar.root.getObjectByName('chest_panel'),
  ]);
  assert.equal(chestHits[0]?.object.name, 'chest_panel');

  const packRay = new THREE.Raycaster(
    new THREE.Vector3(0, 1.405, -1),
    new THREE.Vector3(0, 0, 1),
  );
  const packHits = packRay.intersectObjects([
    avatar.root.getObjectByName('backpack'),
    avatar.root.getObjectByName('backpack_access_panel'),
  ]);
  assert.equal(packHits[0]?.object.name, 'backpack_access_panel');

  avatar.dispose();
  factory.dispose();
});
