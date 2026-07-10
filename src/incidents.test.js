import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  buildIncidentGroup,
  disposeIncidentGroup,
  INCIDENT_TYPES,
  planIncidents,
} from './incidents.js';

const CELLS = Array.from({ length: 360 }, (_, cellIndex) => cellIndex);

test('incident plans are deterministic, unique, protected-cell safe, and JSON-safe', () => {
  const options = {
    seed: 0x51a7f00d,
    candidateCells: [...CELLS, 40, 41],
    protectedCells: [0, 40, 41, 359],
    columns: 20,
  };
  const first = planIncidents(options);
  const second = planIncidents(options);

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.ok(first.length > 0);
  assert.ok(first.length <= 8);
  assert.equal(new Set(first.map(({ cellIndex }) => cellIndex)).size, first.length);
  assert.ok(first.every(({ cellIndex }) => !options.protectedCells.includes(cellIndex)));
  assert.ok(first.every(({ type }) => INCIDENT_TYPES.includes(type)));
});

test('different seeds vary placement or presentation', () => {
  const first = planIncidents({ seed: 101, candidateCells: CELLS, columns: 20 });
  const second = planIncidents({ seed: 202, candidateCells: CELLS, columns: 20 });
  assert.notDeepEqual(first, second);
});

test('mobile and caller counts remain hard bounded', () => {
  const mobile = planIncidents({
    seed: 'mobile',
    candidateCells: CELLS,
    mobile: true,
    density: 1,
    count: 999,
    maxCount: 999,
  });
  const desktop = planIncidents({
    seed: 'desktop',
    candidateCells: CELLS,
    density: 1,
    count: 999,
    maxCount: 999,
  });
  assert.equal(mobile.length, 6);
  assert.equal(desktop.length, 12);
});

test('minimum incident counts survive impossible spacing without duplicating cells', () => {
  const plan = planIncidents({
    seed: 'cramped',
    candidateCells: [0, 1, 2, 3],
    columns: 4,
    minCount: 4,
    maxCount: 4,
    minCellDistance: 64,
  });
  assert.equal(plan.length, 4);
  assert.equal(new Set(plan.map(({ cellIndex }) => cellIndex)).size, 4);
});

test('explicit planner counts cannot undercut the configured minimum', () => {
  const plan = planIncidents({
    seed: 'minimum-contract',
    candidateCells: CELLS,
    columns: 20,
    count: 0,
    minCount: 2,
    maxCount: 4,
  });
  assert.equal(plan.length, 2);
});

test('requested incident subsets never fall back to unrelated default types', () => {
  assert.throws(() => planIncidents({
    seed: 'disabled-subset',
    candidateCells: CELLS,
    types: ['collapsed-wanderer'],
    weights: { 'collapsed-wanderer': 0, 'chair-pile': 1 },
  }), /positive weight/);
});

test('candidate records can carry stable IDs and ready-to-render positions', () => {
  const plan = planIncidents({
    seed: 7,
    count: 2,
    minCellDistance: 0,
    candidateCells: [
      { id: 'room-a', position: { x: 4, z: -8 } },
      { id: 'room-b', x: -3, z: 12 },
      { id: 'room-c', x: 9, z: 2 },
    ],
    protectedCells: ['room-b'],
  });
  assert.equal(plan.length, 2);
  assert.ok(plan.every(({ cellIndex }) => cellIndex !== 'room-b'));
  assert.ok(plan.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.z)));
});

test('renderer builds every built-in scene and disposes shared resources once', () => {
  const plan = INCIDENT_TYPES.map((type, index) => ({
    version: 1,
    id: `manual-${type}`,
    type,
    cellIndex: index,
    rotation: index * 0.4,
    offsetX: 0.1,
    offsetZ: -0.2,
    scale: 1,
    variant: index % 4,
    detailSeed: 400 + index,
  }));
  const group = buildIncidentGroup(THREE, plan, {
    cellToWorld: (cellIndex) => new THREE.Vector3(cellIndex * 4, 0, -cellIndex * 2),
    shadows: false,
  });

  assert.equal(group.name, 'procedural_incidents');
  assert.equal(group.children.length, INCIDENT_TYPES.length);
  assert.equal(group.userData.incidentCount, INCIDENT_TYPES.length);
  assert.ok(group.children.every((child) => Number.isFinite(child.position.x)));
  assert.ok(group.children.every((child) => INCIDENT_TYPES.includes(child.userData.incidentType)));
  assert.equal(disposeIncidentGroup(group), true);
  assert.equal(group.children.length, 0);
  assert.equal(group.userData.disposed, true);
  assert.equal(disposeIncidentGroup(group), false);
});

test('an empty plan creates an inert but disposable root', () => {
  const group = buildIncidentGroup(THREE, []);
  assert.equal(group.userData.incidentCount, 0);
  assert.equal(group.userData.dispose(), true);
  assert.equal(group.userData.dispose(), false);
});
