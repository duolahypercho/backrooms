import assert from 'node:assert/strict';
import test from 'node:test';
import { createLevelCatalog, parseLevelIndex } from './catalog.js';
import { loadLevelsFromDisk } from './node-catalog.js';
import { createGameContentFingerprint, createLevelFingerprint } from './fingerprint.js';
import { planIncidents } from '../incidents.js';

const diskLevels = await loadLevelsFromDisk();

test('level folders are discovered automatically and form a contiguous campaign', async () => {
  const levels = diskLevels;
  assert.ok(levels.length >= 3);
  assert.deepEqual(levels.map((level) => level.index), levels.map((_, index) => index));
  assert.equal(new Set(levels.map((level) => level.id)).size, levels.length);
});

test('discovered level definitions are deeply immutable after fingerprinting', () => {
  const level = diskLevels[0];
  assert.equal(Object.isFrozen(level), true);
  assert.equal(Object.isFrozen(level.maze), true);
  assert.equal(Object.isFrozen(level.props), true);
  assert.throws(() => { level.maze.loopRatio = 0.7; }, TypeError);
});

test('level catalog rejects duplicates and index gaps with actionable errors', () => {
  const base = structuredClone(diskLevels[0]);
  assert.throws(
    () => createLevelCatalog({ a: { default: base }, b: { default: { ...base } } }),
    /duplicate id/,
  );
  assert.throws(
    () => createLevelCatalog({ a: { default: { ...base, index: 1 } } }),
    /leaves a gap/,
  );
});

test('level catalog rejects malformed nested runtime contracts with a precise path', () => {
  const badLighting = structuredClone(diskLevels[0]);
  badLighting.lighting.fixture.pool.desktop = 0;
  assert.throws(
    () => createLevelCatalog({ bad: { default: badLighting } }),
    /lighting\.fixture\.pool\.desktop/,
  );

  const badCopy = structuredClone(diskLevels[0]);
  delete badCopy.copy.start.button;
  assert.throws(
    () => createLevelCatalog({ bad: { default: badCopy } }),
    /copy\.start\.button/,
  );
});

test('validated incident profiles stay inside planner limits on desktop and mobile', () => {
  const candidates = Array.from({ length: 360 }, (_, cellIndex) => cellIndex);
  for (const level of diskLevels) {
    for (const mobile of [false, true]) {
      const plan = planIncidents({
        ...level.incidents,
        seed: 42,
        candidateCells: candidates,
        columns: 20,
        mobile,
      });
      assert.ok(plan.length >= level.incidents.minCount);
      assert.ok(plan.length <= (mobile ? 6 : 12));
    }
  }

  const invalid = structuredClone(diskLevels[0]);
  invalid.incidents.minCount = 7;
  assert.throws(() => createLevelCatalog({ invalid: { default: invalid } }), /incidents\.minCount/);

  const unknownOverride = structuredClone(diskLevels[0]);
  unknownOverride.incidents.count = 0;
  assert.throws(() => createLevelCatalog({ invalid: { default: unknownOverride } }), /incidents\.count/);

  const disabledSubset = structuredClone(diskLevels[0]);
  disabledSubset.incidents.types = ['collapsed-wanderer'];
  disabledSubset.incidents.weights['collapsed-wanderer'] = 0;
  assert.throws(() => createLevelCatalog({ invalid: { default: disabledSubset } }), /positive weight/);
});

test('level query parsing clamps to the discovered campaign', () => {
  assert.equal(parseLevelIndex('?level=2', 3), 2);
  assert.equal(parseLevelIndex({ level: 99 }, 3), 2);
  assert.equal(parseLevelIndex({ level: -3 }, 3), 0);
  assert.equal(parseLevelIndex('', 3), 0);
});

test('level fingerprints ignore object key order but change with shared content', () => {
  const first = createLevelFingerprint([{ id: 'a', maze: { rows: 9, cols: 7 } }]);
  const reordered = createLevelFingerprint([{ maze: { cols: 7, rows: 9 }, id: 'a' }]);
  const changed = createLevelFingerprint([{ id: 'a', maze: { rows: 10, cols: 7 } }]);
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('game fingerprints include character versions as well as level content', () => {
  const levels = [{ id: 'a' }];
  const first = createGameContentFingerprint(levels, [{ id: 'survivor', name: 'Survivor', version: '1.0.0' }]);
  const changed = createGameContentFingerprint(levels, [{ id: 'survivor', name: 'Survivor', version: '1.1.0' }]);
  assert.notEqual(first, changed);
});
