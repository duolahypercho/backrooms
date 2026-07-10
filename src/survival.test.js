import assert from 'node:assert/strict';
import test from 'node:test';
import {
  perceptionProfile,
  spendFlash,
  stepBattery,
  stepFear,
  stepHiding,
  stepNoiseImpulse,
} from './survival.js';

test('flashlight charge drains, cuts off, and only recovers an emergency reserve while off', () => {
  assert.deepEqual(stepBattery({ charge: 0.5, on: true, playing: true }, 10, {
    drainPerSecond: 0.01,
  }), { charge: 0.4, on: true });
  assert.deepEqual(stepBattery({ charge: 0.005, on: true, playing: true }, 1, {
    drainPerSecond: 0.01,
  }), { charge: 0, on: false });
  assert.deepEqual(stepBattery({ charge: 0.1, on: false }, 10, {
    emergencyRechargePerSecond: 0.01,
    emergencyReserve: 0.12,
  }), { charge: 0.12, on: false });
  assert.equal(spendFlash(0.27, 0.28).fired, false);
  const flash = spendFlash(0.6, 0.28);
  assert.equal(flash.fired, true);
  assert.ok(Math.abs(flash.charge - 0.32) < 1e-9);
});

test('darkness hiding requires stillness, a broken light, a dark flashlight, and settling time', () => {
  let hiding = { settle: 0, hidden: false };
  hiding = stepHiding(hiding, 0.5, {
    shadowed: true,
    stationary: true,
    flashlightOn: false,
    noise: 0,
    crouching: false,
  });
  assert.equal(hiding.hidden, false);
  hiding = stepHiding(hiding, 0.3, {
    shadowed: true,
    stationary: true,
    flashlightOn: false,
    noise: 0,
    crouching: false,
  });
  assert.equal(hiding.hidden, true);
  assert.equal(stepHiding(hiding, 0.1, {
    shadowed: true,
    stationary: false,
    flashlightOn: false,
    noise: 0,
  }).hidden, false);
});

test('noise impulses decay and hidden players are much harder to see than lit players', () => {
  assert.equal(stepNoiseImpulse(1, 0.5, 0.8), 0.6);
  assert.ok(perceptionProfile({ hidden: true }).sightRange < perceptionProfile({ crouching: true }).sightRange);
  assert.ok(perceptionProfile({ flashlight: true }).awarenessRate > perceptionProfile({}).awarenessRate);
});

test('fear rises under pursuit and recovers in reliable light after the monster hides', () => {
  const afraid = stepFear(0.1, 3, {
    monsterMode: 'chase',
    entityDistance: 4,
    awareness: 1,
    flashlightOn: false,
    reliableLight: false,
    charge: 0.08,
  });
  const recovering = stepFear(afraid, 8, {
    monsterMode: 'hidden',
    entityDistance: Infinity,
    awareness: 0,
    flashlightOn: true,
    reliableLight: true,
    charge: 0.8,
    nearTeammate: true,
  });
  assert.ok(afraid > 0.5);
  assert.ok(recovering < afraid);
});
