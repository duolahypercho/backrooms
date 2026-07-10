import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOM_CAPACITY, survivorLook, waitingRoomModel } from './waiting-room.js';

const players = [
  { id: 'host', name: 'HOST', connected: true, state: { ready: true, look: 'moss', characterId: 'host-rig' } },
  { id: 'guest', name: 'GUEST', connected: true, state: { ready: true, look: 'rust', characterId: 'guest-rig' } },
];

test('waiting room exposes four slots and host can start only when everyone is ready', () => {
  const waiting = waitingRoomModel({
    players,
    selfId: 'host',
    hostId: 'host',
    localReady: true,
    localLook: 'flood',
    localCharacterId: 'local-rig',
  });
  assert.equal(waiting.capacity, ROOM_CAPACITY);
  assert.equal(waiting.emptySlots, 2);
  assert.equal(waiting.allReady, true);
  assert.equal(waiting.action, 'start');
  assert.equal(waiting.players[0].look.id, 'flood');
  assert.equal(waiting.players[0].characterId, 'local-rig');
  assert.equal(waiting.players[1].characterId, 'guest-rig');

  const notReady = waitingRoomModel({
    players: [{ ...players[1], state: { ready: false, look: 'rust' } }, players[0]],
    selfId: 'host',
    hostId: 'host',
    localReady: true,
  });
  assert.equal(notReady.allReady, false);
  assert.equal(notReady.action, 'cancel');
});

test('missing character ids remain undefined for deterministic player-id selection', () => {
  const waiting = waitingRoomModel({
    players: [{ id: 'auto', connected: true, state: { ready: false, look: 'moss' } }],
    selfId: 'someone-else',
  });
  assert.equal(waiting.players[0].characterId, undefined);
});

test('started rooms give every player an enter action and normalize unknown looks', () => {
  const started = waitingRoomModel({
    players,
    selfId: 'guest',
    hostId: 'host',
    localReady: true,
    localLook: 'unknown',
    started: true,
  });
  assert.equal(started.action, 'enter');
  assert.equal(started.actionLabel, 'ENTER LEVEL');
  assert.equal(survivorLook('unknown').id, 'mustard');
});
