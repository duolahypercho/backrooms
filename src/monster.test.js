import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { animateMonster, buildMonster } from './monster.js';

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
