import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { MultiplayerClient } from '../src/multiplayer.js';
import { createMultiplayerServer } from './multiplayer-server.js';

function waitFor(client, type, predicate = () => true, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.removeEventListener(type, listener);
      reject(new Error(`Timed out waiting for ${type}.`));
    }, timeoutMs);
    const listener = (event) => {
      if (!predicate(event.detail)) return;
      clearTimeout(timeout);
      client.removeEventListener(type, listener);
      resolve(event.detail);
    };
    client.addEventListener(type, listener);
  });
}

test('public room directory is private-by-default, bounded, safe, and live', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    maxPlayers: 2,
    heartbeatMs: 60_000,
    directoryBroadcastDebounceMs: 50,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const clients = [];
  const makeClient = () => {
    const client = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
    clients.push(client);
    return client;
  };

  try {
    const browser = makeClient();
    const privateHost = makeClient();
    const publicHost = makeClient();
    await privateHost.createRoom({ name: 'Hidden Host', visibility: 'private' });
    const publicJoin = await publicHost.createRoom({ name: 'Listed Host', level: 2, visibility: 'public' });
    assert.equal(publicJoin.room.capacity, 2);

    const firstDirectory = await browser.listRooms({ limit: 50 });
    assert.equal(firstDirectory.total, 1);
    assert.equal(firstDirectory.rooms[0].code, publicJoin.room.code);
    assert.deepEqual(
      Object.keys(firstDirectory.rooms[0]).sort(),
      ['availableSlots', 'capacity', 'code', 'joinable', 'level', 'phase', 'playerCount'].sort(),
    );
    assert.equal(firstDirectory.rooms[0].playerCount, 1);
    assert.equal(firstDirectory.rooms[0].availableSlots, 1);
    assert.equal(firstDirectory.rooms[0].joinable, true);

    const subscription = await browser.subscribeRoomDirectory({ limit: 50 });
    assert.equal(subscription.subscribed, true);
    const fullUpdate = waitFor(
      browser,
      'room:directory:updated',
      (directory) => directory.rooms[0]?.playerCount === 2,
    );
    const guest = makeClient();
    await guest.joinRoom(publicJoin.room.code, { name: 'Guest' });
    const fullDirectory = await fullUpdate;
    assert.equal(fullDirectory.rooms[0].availableSlots, 0);
    assert.equal(fullDirectory.rooms[0].joinable, false);

    const completeUpdate = waitFor(
      browser,
      'room:directory:updated',
      (directory) => directory.rooms[0]?.phase === 'complete',
    );
    await publicHost.sendGameEvent({ action: 'level-complete', state: { level: 2 } });
    const completeDirectory = await completeUpdate;
    assert.equal(completeDirectory.rooms[0].joinable, false);

    const lateGuest = makeClient();
    await assert.rejects(
      lateGuest.joinRoom(publicJoin.room.code, { name: 'Late Guest' }),
      (error) => error.code === 'ROOM_COMPLETE',
    );

    const health = await fetch(`http://127.0.0.1:${address.port}/health`).then((response) => response.json());
    assert.equal(health.protocol, 6);
    assert.equal(health.publicRooms, 1);
  } finally {
    for (const client of clients) client.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('waiting rooms cap at four, require every connected player to be ready, and close after start', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    maxPlayers: 12,
    heartbeatMs: 60_000,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const clients = [];
  const makeClient = () => {
    const client = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
    clients.push(client);
    return client;
  };

  try {
    assert.equal(server.config.maxPlayers, 4);
    const host = makeClient();
    const guests = [makeClient(), makeClient(), makeClient()];
    const hostJoin = await host.createRoom({ name: 'Host', visibility: 'public' });
    assert.equal(hostJoin.room.capacity, 4);
    const guestJoins = [];
    for (let index = 0; index < guests.length; index += 1) {
      guestJoins.push(await guests[index].joinRoom(hostJoin.room.code, { name: `Guest ${index + 1}` }));
    }

    const fifth = makeClient();
    await assert.rejects(
      fifth.joinRoom(hostJoin.room.code, { name: 'Fifth' }),
      (error) => error.code === 'ROOM_FULL',
    );

    host.sendPlayerState({ ready: true, look: 'mustard', playing: false });
    const unreadySignal = waitFor(
      host,
      'player:state',
      (event) => event.playerId === guestJoins[0].self.id && event.state?.ready === false,
    );
    guests[0].sendPlayerState({ ready: false, look: 'moss', playing: false });
    await unreadySignal;
    await assert.rejects(
      host.sendGameEvent({ action: 'session-start', state: { phase: 'playing' } }),
      (error) => error.code === 'PLAYERS_NOT_READY',
    );

    const readySignals = guests.map((guest, index) => waitFor(
      host,
      'player:state',
      (event) => event.playerId === guestJoins[index].self.id && event.state?.ready === true,
    ));
    guests.forEach((guest, index) => {
      guest.sendPlayerState({ ready: true, look: ['moss', 'rust', 'flood'][index], playing: false });
    });
    await Promise.all(readySignals);

    const sessionStarted = waitFor(
      guests[0],
      'game:event',
      (event) => event.action === 'session-start',
    );
    const startAck = await host.sendGameEvent({
      action: 'session-start',
      state: { phase: 'playing', startedAt: 1234 },
    });
    const startEvent = await sessionStarted;
    assert.ok(startAck.revision > 0);
    assert.equal(startEvent.state.phase, 'playing');
    assert.equal(startEvent.state.capacity, 4);

    const directory = await fifth.listRooms({ limit: 10 });
    assert.equal(directory.rooms[0].phase, 'playing');
    assert.equal(directory.rooms[0].joinable, false);
    await assert.rejects(
      fifth.joinRoom(hostJoin.room.code, { name: 'Late Signal' }),
      (error) => error.code === 'ROOM_IN_PROGRESS',
    );

    const resumed = makeClient();
    const resumedJoin = await resumed.joinRoom(hostJoin.room.code, {
      name: 'Guest 1',
      resumeToken: guestJoins[0].self.resumeToken,
    });
    assert.equal(resumedJoin.resumed, true);
    assert.equal(resumedJoin.room.game.phase, 'playing');
  } finally {
    for (const client of clients) client.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('clients reject a server with a different auto-discovered level catalog', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    heartbeatMs: 60_000,
    maxLevel: 1,
    levelIds: ['level-a', 'level-b'],
    contentFingerprint: 'catalog-a',
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const matching = new MultiplayerClient({
    url,
    WebSocketImpl: WebSocket,
    autoReconnect: false,
    expectedLevelIds: ['level-a', 'level-b'],
    expectedContentFingerprint: 'catalog-a',
  });
  const mismatched = new MultiplayerClient({
    url,
    WebSocketImpl: WebSocket,
    autoReconnect: false,
    expectedLevelIds: ['level-a', 'level-b'],
    expectedContentFingerprint: 'catalog-b',
  });

  try {
    const joined = await matching.createRoom({ name: 'Matching build', level: 1 });
    assert.equal(joined.room.level, 1);

    const mismatchError = waitFor(
      mismatched,
      'protocol:error',
      (error) => error.code === 'CONTENT_MISMATCH',
    );
    const mismatchClosed = waitFor(mismatched, 'socket:closed', (event) => event.code === 4003);
    await assert.rejects(
      mismatched.connect(),
      (error) => error.code === 'CONTENT_MISMATCH',
    );
    const error = await mismatchError;
    await mismatchClosed;
    assert.equal(error.code, 'CONTENT_MISMATCH');
    assert.equal(mismatched.status, 'incompatible');
  } finally {
    matching.disconnect({ forgetRoom: true });
    mismatched.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('voice signaling is directed, normalized, private, and room-scoped', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    maxPlayers: 4,
    heartbeatMs: 60_000,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const clients = [];
  const makeClient = () => {
    const client = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
    clients.push(client);
    return client;
  };

  try {
    const host = makeClient();
    const receiver = makeClient();
    const roomObserver = makeClient();
    const outsider = makeClient();
    const hostJoin = await host.createRoom({ name: 'Caller' });
    assert.equal(host.serverCapabilities.includes('voice-signaling'), true);
    const receiverJoin = await receiver.joinRoom(hostJoin.room.code, { name: 'Receiver' });
    await roomObserver.joinRoom(hostJoin.room.code, { name: 'Observer' });
    const outsiderJoin = await outsider.createRoom({ name: 'Other room' });

    const leakedSignals = [];
    const stopObserving = roomObserver.on('voice:signal', (payload) => leakedSignals.push(payload));
    const incomingOffer = waitFor(receiver, 'voice:signal');
    const offerAck = await host.sendVoiceSignal(receiverJoin.self.id, {
      type: 'offer',
      sdp: 'v=0\r\no=threshold 1 1 IN IP4 127.0.0.1\r\n',
      arbitrary: 'must not cross the server',
    });
    const offer = await incomingOffer;
    await new Promise((resolve) => setTimeout(resolve, 30));
    stopObserving();

    assert.deepEqual(Object.keys(offerAck).sort(), ['deliveredTo', 'signalType']);
    assert.equal(offerAck.deliveredTo, receiverJoin.self.id);
    assert.equal(offerAck.signalType, 'offer');
    assert.deepEqual(Object.keys(offer).sort(), ['epoch', 'fromPlayerId', 'signal']);
    assert.equal(offer.epoch, hostJoin.room.epoch);
    assert.equal(offer.fromPlayerId, hostJoin.self.id);
    assert.deepEqual(Object.keys(offer.signal).sort(), ['sdp', 'type']);
    assert.equal(offer.signal.type, 'offer');
    assert.equal(leakedSignals.length, 0);

    const incomingCandidate = waitFor(host, 'voice:signal');
    await receiver.sendVoiceSignal(hostJoin.self.id, {
      type: 'candidate',
      candidate: {
        candidate: 'candidate:1 1 UDP 2122260223 192.0.2.1 54400 typ host',
        sdpMid: 'audio',
        sdpMLineIndex: 0,
        usernameFragment: 'threshold',
        privateField: 'discard me',
      },
      arbitrary: true,
    });
    const candidate = await incomingCandidate;
    assert.deepEqual(
      Object.keys(candidate.signal).sort(),
      ['candidate', 'sdpMLineIndex', 'sdpMid', 'type', 'usernameFragment'].sort(),
    );

    await assert.rejects(
      host.sendVoiceSignal('', { type: 'ready' }),
      (error) => error.code === 'INVALID_VOICE_TARGET',
    );
    await assert.rejects(
      host.sendVoiceSignal(hostJoin.self.id, { type: 'ready' }),
      (error) => error.code === 'VOICE_SELF_TARGET',
    );
    await assert.rejects(
      host.sendVoiceSignal(outsiderJoin.self.id, { type: 'ready' }),
      (error) => error.code === 'VOICE_TARGET_UNAVAILABLE',
    );
    await assert.rejects(
      host.sendVoiceSignal(receiverJoin.self.id, { type: 'script', source: 'arbitrary data' }),
      (error) => error.code === 'INVALID_VOICE_SIGNAL',
    );
    await assert.rejects(
      host.sendVoiceSignal(receiverJoin.self.id, { type: 'offer', sdp: 'x'.repeat(32 * 1024 + 1) }),
      (error) => error.code === 'INVALID_VOICE_SIGNAL',
    );
  } finally {
    for (const client of clients) client.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('voice signaling uses a per-socket token bucket', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    heartbeatMs: 60_000,
    voiceSignalRateBurst: 1,
    voiceSignalRatePerSecond: 1,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const host = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
  const receiver = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });

  try {
    const hostJoin = await host.createRoom({ name: 'Caller' });
    const receiverJoin = await receiver.joinRoom(hostJoin.room.code, { name: 'Receiver' });
    await host.sendVoiceSignal(receiverJoin.self.id, { type: 'ready' });
    await assert.rejects(
      host.sendVoiceSignal(receiverJoin.self.id, { type: 'hangup' }),
      (error) => error.code === 'VOICE_SIGNAL_RATE_LIMITED' && error.retryable === true,
    );
  } finally {
    host.disconnect({ forgetRoom: true });
    receiver.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('survival intents use a gameplay bucket without consuming voice signaling capacity', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    heartbeatMs: 60_000,
    gameplayIntentRateBurst: 1,
    gameplayIntentRatePerSecond: 1,
    voiceSignalRateBurst: 1,
    voiceSignalRatePerSecond: 1,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const host = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
  const guest = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });

  try {
    const hostJoin = await host.createRoom({ name: 'Authority' });
    const guestJoin = await guest.joinRoom(hostJoin.room.code, { name: 'Collector' });

    const incomingIntent = waitFor(host, 'objective:intent');
    const intentAck = await guest.sendObjectiveIntent({
      objectiveId: 'evidence:0',
      action: 'collect',
      state: { cellIndex: 17 },
    });
    const intent = await incomingIntent;
    assert.equal(intentAck.deliveredTo, hostJoin.self.id);
    assert.deepEqual(intent, {
      objectiveId: 'evidence:0',
      action: 'collect',
      state: { cellIndex: 17 },
      playerId: guestJoin.self.id,
      epoch: hostJoin.room.epoch,
    });

    await assert.rejects(
      guest.sendObjectiveIntent({
        objectiveId: 'evidence:1',
        action: 'collect',
        state: { cellIndex: 23 },
      }),
      (error) => (
        error.code === 'GAMEPLAY_INTENT_RATE_LIMITED'
        && error.retryable === true
        && Number.isFinite(error.details?.retryAfterMs)
        && error.details.retryAfterMs > 0
      ),
    );

    const incomingVoiceSignal = waitFor(host, 'voice:signal');
    const voiceAck = await guest.sendVoiceSignal(hostJoin.self.id, { type: 'ready' });
    const voiceSignal = await incomingVoiceSignal;
    assert.equal(voiceAck.deliveredTo, hostJoin.self.id);
    assert.equal(voiceAck.signalType, 'ready');
    assert.equal(voiceSignal.fromPlayerId, guestJoin.self.id);
    assert.deepEqual(voiceSignal.signal, { type: 'ready' });
  } finally {
    host.disconnect({ forgetRoom: true });
    guest.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('host-authoritative evidence state wins and survives broadcasts and late snapshots', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    maxPlayers: 4,
    heartbeatMs: 60_000,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const clients = [];
  const makeClient = () => {
    const client = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
    clients.push(client);
    return client;
  };

  try {
    const host = makeClient();
    const collector = makeClient();
    const hostJoin = await host.createRoom({ name: 'Authority' });
    const collectorJoin = await collector.joinRoom(hostJoin.room.code, { name: 'Collector' });

    await assert.rejects(
      collector.sendObjectiveEvent({
        objectiveId: 'evidence:0',
        action: 'collect',
        state: { cellIndex: 31, collectedBy: collectorJoin.self.id },
      }),
      (error) => error.code === 'HOST_ONLY',
    );

    const incomingEvidence = waitFor(
      collector,
      'objective:event',
      (event) => event.objectiveId === 'evidence:0' && event.action === 'collect',
    );
    const evidenceAck = await host.sendObjectiveEvent({
      objectiveId: 'evidence:0',
      action: 'collect',
      state: {
        cellIndex: 31,
        collectedBy: collectorJoin.self.id,
        archive: { entry: 0, chargeAwarded: true },
      },
    });
    const evidenceEvent = await incomingEvidence;
    assert.equal(evidenceEvent.playerId, hostJoin.self.id);
    assert.equal(evidenceEvent.revision, evidenceAck.revision);
    assert.deepEqual(evidenceEvent.state, {
      cellIndex: 31,
      collectedBy: collectorJoin.self.id,
      archive: { entry: 0, chargeAwarded: true },
    });

    const incomingObjective = waitFor(
      collector,
      'objective:event',
      (event) => event.objectiveId === 'fuse:2' && event.action === 'activate',
    );
    const objectiveAck = await host.sendObjectiveEvent({
      objectiveId: 'fuse:2',
      action: 'activate',
      state: { cellIndex: 47, activatedBy: collectorJoin.self.id },
    });
    const objectiveEvent = await incomingObjective;
    assert.equal(objectiveEvent.revision, objectiveAck.revision);
    assert.ok(objectiveAck.revision > evidenceAck.revision);

    const lateJoiner = makeClient();
    const lateJoin = await lateJoiner.joinRoom(hostJoin.room.code, { name: 'Late Signal' });
    assert.deepEqual(lateJoin.room.objectives['evidence:0'].state, evidenceEvent.state);
    assert.equal(lateJoin.room.objectives['evidence:0'].playerId, hostJoin.self.id);
    assert.deepEqual(lateJoin.room.objectives['fuse:2'].state, objectiveEvent.state);
    assert.equal(lateJoin.room.revision, objectiveAck.revision + 1);

    const refreshed = await collector.requestSnapshot();
    assert.deepEqual(refreshed.objectives, lateJoin.room.objectives);
    assert.equal(refreshed.revision, lateJoin.room.revision);
  } finally {
    for (const client of clients) client.disconnect({ forgetRoom: true });
    await server.close();
  }
});

test('text chat is room-scoped, identity-stamped, sanitized, and rate limited', async () => {
  const server = createMultiplayerServer({
    host: '127.0.0.1',
    port: 0,
    maxPlayers: 4,
    heartbeatMs: 60_000,
    chatRateBurst: 2,
    chatRatePerSecond: 1,
  });
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}${server.config.path}`;
  const clients = [];
  const makeClient = () => {
    const client = new MultiplayerClient({ url, WebSocketImpl: WebSocket, autoReconnect: false });
    clients.push(client);
    return client;
  };

  try {
    const host = makeClient();
    const teammate = makeClient();
    const outsider = makeClient();
    const hostJoin = await host.createRoom({ name: 'Caller' });
    assert.equal(host.serverCapabilities.includes('text-chat-v1'), true);
    const teammateJoin = await teammate.joinRoom(hostJoin.room.code, { name: 'Receiver' });
    await outsider.createRoom({ name: 'Other room' });

    const leaked = [];
    const stopLeak = outsider.on('room:chat', (payload) => leaked.push(payload));
    const incoming = waitFor(teammate, 'room:chat');
    const ack = await host.sendChat('  hallway clear\u0007  ');
    const message = await incoming;
    await new Promise((resolve) => setTimeout(resolve, 20));
    stopLeak();

    assert.equal(ack.delivered, true);
    assert.equal(typeof ack.sentAt, 'number');
    assert.equal(message.epoch, hostJoin.room.epoch);
    assert.equal(message.fromPlayerId, hostJoin.self.id);
    assert.equal(message.fromName, 'Caller');
    assert.equal(message.text, 'hallway clear');
    assert.equal(leaked.length, 0);

    await assert.rejects(host.sendChat('   '), (error) => error.code === 'INVALID_CHAT');

    const longIncoming = waitFor(teammate, 'room:chat');
    const longAck = await host.sendChat(`a${'b'.repeat(200)}`);
    const longMessage = await longIncoming;
    assert.equal(longAck.delivered, true);
    assert.equal(longMessage.text.length, 120);
    assert.equal(longMessage.text, `a${'b'.repeat(119)}`);

    await assert.rejects(
      host.sendChat('too fast'),
      (error) => error.code === 'CHAT_RATE_LIMITED' && error.retryable === true,
    );

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const stamped = waitFor(teammate, 'room:chat');
    await host._request('room:chat', {
      epoch: host.room?.epoch,
      text: 'still me',
      fromPlayerId: teammateJoin.self.id,
      fromName: 'Impostor',
    });
    const stampedMessage = await stamped;
    assert.equal(stampedMessage.fromPlayerId, hostJoin.self.id);
    assert.equal(stampedMessage.fromName, 'Caller');
    assert.equal(stampedMessage.text, 'still me');
  } finally {
    for (const client of clients) client.disconnect({ forgetRoom: true });
    await server.close();
  }
});
