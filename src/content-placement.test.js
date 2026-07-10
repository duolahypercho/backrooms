import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSpacedCells, enumerateCellIndexes } from './content-placement.js';

test('large typed-array mazes expose every cell index without byte wrapping', () => {
  const indexes = enumerateCellIndexes(new Uint8Array(441));
  assert.equal(indexes.length, 441);
  assert.equal(indexes.at(-1), 440);
  assert.equal(new Set(indexes).size, 441);
});

test('required placement stays exact across seeds and uses fallback only when needed', () => {
  const fallback = Array.from({ length: 49 }, (_, index) => index);
  for (let seed = 1; seed <= 64; seed += 1) {
    let state = seed;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state) >>> 0;
      return state / 4294967296;
    };
    const selected = chooseSpacedCells(
      [10, 20, 30, 40],
      fallback,
      7,
      random,
      8,
      (left, right) => Math.abs(left - right),
    );
    assert.equal(selected.length, 7);
    assert.equal(new Set(selected).size, 7);
    assert.ok(selected.every((cell) => fallback.includes(cell)));
  }
});
