import assert from 'node:assert/strict';
import test from 'node:test';
import { createAtmosphereDirector, validateAtmosphereProfile } from './atmosphere.js';
import { loadLevelsFromDisk } from './levels/node-catalog.js';

const LEVELS = await loadLevelsFromDisk();

test('every chapter has a valid and distinct atmosphere profile', () => {
  assert.ok(LEVELS.length >= 3);
  const identities = new Set();
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.index, index);
    assert.deepEqual(validateAtmosphereProfile(level.atmosphere), []);
    assert.ok(level.atmosphere.events.length >= 4);
    assert.ok(level.atmosphere.environmentalStory.length >= 3);
    assert.ok(!identities.has(level.atmosphere.identity));
    identities.add(level.atmosphere.identity);
  }
});

test('atmosphere scheduling is deterministic and milestones fire once', () => {
  const profile = {
    cadence: { first: [1, 1], interval: [2, 2] },
    maxEvents: 2,
    events: [{ id: 'knock', cue: 'distant-knock', tension: [0, 1], maxRepeats: 2 }],
    milestones: [{ id: 'halfway', progress: 0.5, message: 'HALFWAY' }],
  };
  const first = createAtmosphereDirector(profile, { seed: 42 });
  const second = createAtmosphereDirector(profile, { seed: 42 });
  const inputs = [
    { elapsed: 1, tension: 0.4, objectivesCompleted: 0, objectiveTotal: 2 },
    { elapsed: 3, tension: 0.6, objectivesCompleted: 1, objectiveTotal: 2 },
    { elapsed: 5, tension: 0.6, objectivesCompleted: 1, objectiveTotal: 2 },
  ];
  const firstOutput = inputs.flatMap((input) => first.update(input));
  const secondOutput = inputs.flatMap((input) => second.update(input));
  assert.deepEqual(firstOutput, secondOutput);
  assert.equal(firstOutput.filter((event) => event.id === 'halfway').length, 1);
  assert.equal(firstOutput.filter((event) => event.id === 'knock').length, 2);
});

test('every chapter exposes a complete survival and monster behavior contract', () => {
  for (const level of LEVELS) {
    const flashlight = level.equipment?.flashlight;
    assert.ok(flashlight?.drainPerSecond > 0);
    assert.ok(flashlight?.flashCost > 0 && flashlight.flashCost < 1);
    assert.equal(level.evidence?.entries.length, 3);
    assert.ok(level.evidence.recharge > 0);
    assert.ok(level.monster.identity);
    assert.ok(level.monster.behavior.sight.range > 0);
    assert.ok(level.monster.behavior.hearing.noiseCells > 0);
    assert.equal(level.monster.behavior.chase.recovery.length, 2);
    assert.equal(level.monster.behavior.wanderCells.length, 2);
  }
});
