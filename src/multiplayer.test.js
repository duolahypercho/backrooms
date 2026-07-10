import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MULTIPLAYER_PROTOCOL_VERSION,
  MultiplayerClient,
} from './multiplayer.js';

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

function eventWith(type, properties = {}) {
  const event = new Event(type);
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, { value, enumerable: true });
  }
  return event;
}

class FakeWebSocket extends EventTarget {
  static instances = [];

  static reset() {
    FakeWebSocket.instances.length = 0;
  }

  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.closeCalls = [];
    FakeWebSocket.instances.push(this);
  }

  open() {
    assert.equal(this.readyState, 0);
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  receive(message) {
    assert.equal(this.readyState, 1);
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.dispatchEvent(eventWith('message', { data }));
  }

  send(raw) {
    if (this.readyState !== 1) throw new Error('Fake socket is not open.');
    this.sent.push(JSON.parse(raw));
  }

  close(code = 1000, reason = '') {
    if (this.readyState >= 2) return;
    this.closeCalls.push({ code, reason });
    this.readyState = 2;
    queueMicrotask(() => {
      this.readyState = 3;
      this.dispatchEvent(eventWith('close', {
        code,
        reason,
        wasClean: code === 1000,
      }));
    });
  }
}

function serverHello(overrides = {}) {
  return {
    type: 'server:hello',
    payload: {
      protocol: MULTIPLAYER_PROTOCOL_VERSION,
      capabilities: ['room-directory', 'voice-signaling'],
      levelIds: ['level-0', 'level-1'],
      contentFingerprint: 'content-a',
      ...overrides,
    },
  };
}

function makeClient(options = {}) {
  return new MultiplayerClient({
    url: 'ws://fake.test/multiplayer',
    WebSocketImpl: FakeWebSocket,
    autoReconnect: false,
    requestTimeout: 1_000,
    heartbeatInterval: 60_000,
    ...options,
  });
}

function joinedResponse(request, { code = 'ABCDE', playerId = 'player-1' } = {}) {
  return {
    type: 'room:joined',
    requestId: request.requestId,
    payload: {
      room: {
        code,
        epoch: 1,
        hostId: playerId,
        players: [{ id: playerId, sequence: 0 }],
      },
      self: { id: playerId, resumeToken: `resume-${playerId}` },
    },
  };
}

test('connect stays pending after WebSocket open and resolves only after a compatible hello', async () => {
  FakeWebSocket.reset();
  const client = makeClient({
    expectedLevelIds: ['level-0', 'level-1'],
    expectedContentFingerprint: 'content-a',
  });
  const connection = client.connect();
  const socket = FakeWebSocket.instances[0];
  let resolved = false;
  connection.then(() => { resolved = true; });

  socket.open();
  await nextTurn();
  assert.equal(resolved, false);
  assert.equal(client.isConnected, false);
  assert.equal(client.status, 'connecting');
  assert.strictEqual(client.connect(), connection);
  assert.deepEqual(socket.sent, []);

  socket.receive(serverHello());
  await connection;
  assert.equal(resolved, true);
  assert.equal(client.isConnected, true);
  assert.equal(client.status, 'connected');
  assert.deepEqual(client.serverCapabilities, ['room-directory', 'voice-signaling']);

  client.disconnect();
  await nextTurn();
});

test('protocol and content mismatches reject connect and survive the close as incompatible', async (t) => {
  const cases = [
    {
      name: 'protocol mismatch',
      client: {},
      hello: { protocol: MULTIPLAYER_PROTOCOL_VERSION + 1 },
      code: 'PROTOCOL_MISMATCH',
      closeCode: 4002,
    },
    {
      name: 'level catalog mismatch',
      client: { expectedLevelIds: ['level-0', 'level-x'] },
      hello: {},
      code: 'CONTENT_MISMATCH',
      closeCode: 4003,
    },
    {
      name: 'content fingerprint mismatch',
      client: {
        expectedLevelIds: ['level-0', 'level-1'],
        expectedContentFingerprint: 'content-b',
      },
      hello: {},
      code: 'CONTENT_MISMATCH',
      closeCode: 4003,
    },
  ];

  for (const mismatch of cases) {
    await t.test(mismatch.name, async () => {
      FakeWebSocket.reset();
      const client = makeClient(mismatch.client);
      const protocolErrors = [];
      client.on('protocol:error', (error) => protocolErrors.push(error));
      const connection = client.connect();
      const socket = FakeWebSocket.instances[0];
      socket.open();
      socket.receive(serverHello(mismatch.hello));

      await assert.rejects(connection, (error) => error.code === mismatch.code);
      await nextTurn();
      assert.equal(client.isConnected, false);
      assert.equal(client.status, 'incompatible');
      assert.equal(protocolErrors.at(-1)?.code, mismatch.code);
      assert.equal(socket.closeCalls[0]?.code, mismatch.closeCode);

      client.disconnect({ forgetRoom: true });
      assert.equal(client.status, 'incompatible');
    });
  }
});

test('createRoom and joinRoom send nothing until the compatible hello is accepted', async (t) => {
  const cases = [
    {
      name: 'create room',
      begin: (client) => client.createRoom({ name: 'Host', seed: 42, level: 1 }),
      requestType: 'room:create',
      expectedPayload: { name: 'Host', seed: 42, level: 1, visibility: 'private' },
      response: { code: 'HOST1', playerId: 'host' },
    },
    {
      name: 'join room',
      begin: (client) => client.joinRoom('join2', { name: 'Guest' }),
      requestType: 'room:join',
      expectedPayload: { code: 'JOIN2', name: 'Guest' },
      response: { code: 'JOIN2', playerId: 'guest' },
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      FakeWebSocket.reset();
      const client = makeClient({
        expectedLevelIds: ['level-0', 'level-1'],
        expectedContentFingerprint: 'content-a',
      });
      const operation = scenario.begin(client);
      const socket = FakeWebSocket.instances[0];
      socket.open();
      await nextTurn();
      assert.deepEqual(socket.sent, []);

      socket.receive(serverHello());
      await nextTurn();
      assert.equal(socket.sent.length, 1);
      const request = socket.sent[0];
      assert.equal(request.type, scenario.requestType);
      for (const [key, value] of Object.entries(scenario.expectedPayload)) {
        assert.deepEqual(request.payload[key], value);
      }

      socket.receive(joinedResponse(request, scenario.response));
      const payload = await operation;
      assert.equal(payload.room.code, scenario.response.code);
      assert.equal(client.status, 'joined');

      client.disconnect({ forgetRoom: true });
      await nextTurn();
    });
  }
});
