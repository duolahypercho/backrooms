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
