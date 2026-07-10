/**
 * THRESHOLD multiplayer room protocol, version 6.
 *
 * Every frame is JSON: { type, requestId?, payload?, serverTime? }.
 *
 * Client -> server
 * - heartbeat { clientTime }
 * - room:create { name, seed?, level?, visibility?: "private" | "public" }
 * - room:join { code, name, resumeToken? }
 * - room:leave {}
 * - room:snapshot:request {}
 * - room:directory:list { limit? }
 * - room:directory:subscribe { enabled?, limit? }
 * - voice:signal { epoch, targetPlayerId, signal }
 * - room:chat { epoch, text }
 * - player:state { sequence, state }
 * - objective:intent { objectiveId, action, state } (any player; delivered to host)
 * - objective:event { objectiveId, action, state } (host authoritative)
 * - monster:event { action, state } (host authoritative)
 * - game:event { action, state } (host authoritative)
 * - world:sync { seed, level, reset? } (host authoritative)
 *
 * Server -> client
 * - server:hello, heartbeat:ack
 * - room:joined { room, self, resumed }, room:left, room:snapshot
 * - room:directory, room:directory:subscription, room:directory:changed
 * - voice:signal { epoch, fromPlayerId, signal }
 * - room:chat { epoch, fromPlayerId, fromName, text, sentAt }
 * - player:joined, player:left, player:removed, player:state
 * - host:changed
 * - objective:intent, objective:event, monster:event, game:event, world:synced
 * - <request-type>:ack, or error { code, message, retryable }
 *
 * A room snapshot is the deterministic handshake. It contains the room seed,
 * level, authority host, revision, players and the latest objective/monster/game
 * state. Resume tokens are private and appear only in that player's join reply.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { loadLevelsFromDisk } from '../src/levels/node-catalog.js';
import { createGameContentFingerprint } from '../src/levels/fingerprint.js';
import { loadCharactersFromDisk } from '../src/characters/node-catalog.js';

export const MULTIPLAYER_PROTOCOL_VERSION = 6;

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_PATH = '/multiplayer';
const MAX_ROOM_PLAYERS = 4;
const DIRECTORY_MAX_RESULTS = 50;
const DIRECTORY_DEFAULT_RESULTS = 20;
const DIRECTORY_TIMESTAMP_GRANULARITY = 60_000;
const DIRECTORY_RATE_BURST = 3;
const DIRECTORY_RATE_REFILL_MS = 1_000;
const VOICE_SIGNAL_RATE_BURST = 64;
const VOICE_SIGNAL_RATE_REFILL_PER_SECOND = 32;
const GAMEPLAY_INTENT_RATE_BURST = 12;
const GAMEPLAY_INTENT_RATE_REFILL_PER_SECOND = 6;
const CHAT_RATE_BURST = 3;
const CHAT_RATE_REFILL_PER_SECOND = 1;
const CHAT_MAX_LENGTH = 120;
const VOICE_SDP_MAX_LENGTH = 32 * 1024;
const VOICE_CANDIDATE_MAX_LENGTH = 2 * 1024;
const VOICE_CANDIDATE_FIELD_MAX_LENGTH = 256;

const now = () => Date.now();

function finiteInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeSeed(value, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number) >>> 0;
}

function normalizeLevel(value, maximum) {
  return clamp(finiteInteger(value, 0), 0, maximum);
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function normalizeName(value) {
  const name = String(value || 'Wanderer').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (name || 'Wanderer').slice(0, 24);
}

function normalizeVisibility(value) {
  return value === 'public' ? 'public' : 'private';
}

function normalizeIdentifier(value, fallback = 'unknown') {
  const identifier = String(value || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64);
  return identifier || fallback;
}

function normalizeVoiceTarget(value) {
  if (typeof value !== 'string') return '';
  const target = value.trim();
  if (!target || target.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(target)) return '';
  return target;
}

function normalizeChatText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX_LENGTH);
}

function normalizeVoiceSignal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = typeof value.type === 'string' ? value.type : '';
  if (type === 'ready' || type === 'hangup') return { type };

  if (type === 'offer' || type === 'answer') {
    const sdp = typeof value.sdp === 'string' ? value.sdp : '';
    if (!sdp || sdp.length > VOICE_SDP_MAX_LENGTH || /[\u0000\u000b\u000c\u000e-\u001f\u007f]/.test(sdp)) {
      return null;
    }
    return { type, sdp };
  }

  if (type !== 'candidate') return null;
  const source = value.candidate && typeof value.candidate === 'object'
    ? value.candidate
    : value;
  if (typeof source.candidate !== 'string') return null;
  const candidate = source.candidate;
  if (candidate.length > VOICE_CANDIDATE_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(candidate)) return null;

  const normalized = { type, candidate };
  if (source.sdpMid != null) {
    if (
      typeof source.sdpMid !== 'string'
      || source.sdpMid.length > VOICE_CANDIDATE_FIELD_MAX_LENGTH
      || /[\u0000-\u001f\u007f]/.test(source.sdpMid)
    ) return null;
    normalized.sdpMid = source.sdpMid;
  }
  if (source.sdpMLineIndex != null) {
    if (!Number.isInteger(source.sdpMLineIndex) || source.sdpMLineIndex < 0 || source.sdpMLineIndex > 65_535) {
      return null;
    }
    normalized.sdpMLineIndex = source.sdpMLineIndex;
  }
  if (source.usernameFragment != null) {
    if (
      typeof source.usernameFragment !== 'string'
      || source.usernameFragment.length > VOICE_CANDIDATE_FIELD_MAX_LENGTH
      || /[\u0000-\u001f\u007f]/.test(source.usernameFragment)
    ) return null;
    normalized.usernameFragment = source.usernameFragment;
  }
  return normalized;
}

function sanitizeJson(value, depth = 0) {
  if (depth > 6 || value == null) return value == null ? null : undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return value.slice(0, 512);
  if (Array.isArray(value)) {
    return value.slice(0, 128).map((item) => sanitizeJson(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;

  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 64)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const clean = sanitizeJson(item, depth + 1);
    if (clean !== undefined) result[String(key).slice(0, 64)] = clean;
  }
  return result;
}

function randomSeed() {
  return randomBytes(4).readUInt32BE(0);
}

function randomToken() {
  return randomBytes(24).toString('base64url');
}

function generateRoomCode(rooms, length) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = randomBytes(length);
    let code = '';
    for (let index = 0; index < length; index += 1) {
      code += ROOM_ALPHABET[bytes[index] % ROOM_ALPHABET.length];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to allocate a unique room code.');
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    connected: player.connected,
    joinedAt: player.joinedAt,
    lastSeen: player.lastSeen,
    disconnectedAt: player.disconnectedAt,
    sequence: player.sequence,
    state: player.state,
    stateUpdatedAt: player.stateUpdatedAt,
  };
}

function canHostAuthority(player, timestamp = now()) {
  return Boolean(
    player.connected
    && player.state?.alive !== false
    && player.state?.playing === true
    && player.state?.authorityAvailable !== false
    && player.stateUpdatedAt
    && timestamp - player.stateUpdatedAt < 3_000
  );
}

function coarseTimestamp(value) {
  return Math.floor(Number(value || 0) / DIRECTORY_TIMESTAMP_GRANULARITY) * DIRECTORY_TIMESTAMP_GRANULARITY;
}

function connectedPlayerCount(room) {
  return [...room.players.values()].filter((player) => player.connected).length;
}

function publicRoomPhase(room) {
  if (room.game?.lastEvent === 'level-complete') return 'complete';
  const gamePhase = String(room.game?.phase || '').toLowerCase();
  if (gamePhase === 'playing' || gamePhase === 'active' || room.game?.lastEvent === 'session-start') {
    return 'playing';
  }
  if ([...room.players.values()].some((player) => player.connected && player.state?.playing === true)) {
    return 'playing';
  }
  if (gamePhase === 'loading') return 'loading';
  return 'lobby';
}

function publicRoomEntry(room, capacity) {
  const playerCount = connectedPlayerCount(room);
  const phase = publicRoomPhase(room);
  const availableSlots = Math.max(0, capacity - room.players.size);
  return {
    code: room.code,
    level: room.level,
    playerCount,
    capacity,
    availableSlots,
    phase,
    joinable: playerCount > 0 && availableSlots > 0 && phase === 'lobby',
  };
}

function publicRoomEntries(rooms, capacity) {
  return [...rooms.values()]
    .filter((room) => (
      room.visibility === 'public'
      && connectedPlayerCount(room) > 0
      && Boolean(room.hostId && room.players.get(room.hostId)?.connected)
    ))
    .sort((left, right) => (
      Number(publicRoomEntry(right, capacity).joinable) - Number(publicRoomEntry(left, capacity).joinable)
      || right.updatedAt - left.updatedAt
      || right.createdAt - left.createdAt
      || left.code.localeCompare(right.code)
    ))
    .map((room) => publicRoomEntry(room, capacity));
}

function roomSnapshot(room) {
  return {
    protocol: MULTIPLAYER_PROTOCOL_VERSION,
    code: room.code,
    visibility: room.visibility,
    capacity: room.capacity,
    seed: room.seed,
    level: room.level,
    epoch: room.epoch,
    hostId: room.hostId,
    revision: room.revision,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    players: [...room.players.values()].map(publicPlayer),
    objectives: Object.fromEntries(room.objectives),
    monster: room.monster,
    game: room.game,
  };
}

function createPlayer(name, socket) {
  const timestamp = now();
  return {
    id: randomUUID(),
    resumeToken: randomToken(),
    name: normalizeName(name),
    socket,
    connected: true,
    joinedAt: timestamp,
    lastSeen: timestamp,
    disconnectedAt: null,
    sequence: -1,
    state: null,
    stateUpdatedAt: null,
  };
}

function directRun() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

export function createMultiplayerServer(options = {}) {
  const config = {
    host: options.host ?? process.env.MULTIPLAYER_HOST ?? '0.0.0.0',
    port: finiteInteger(options.port ?? process.env.MULTIPLAYER_PORT, 8787),
    path: options.path ?? process.env.MULTIPLAYER_PATH ?? DEFAULT_PATH,
    roomCodeLength: clamp(finiteInteger(options.roomCodeLength, 5), 4, 8),
    maxPlayers: clamp(
      finiteInteger(options.maxPlayers ?? process.env.MULTIPLAYER_MAX_PLAYERS, MAX_ROOM_PLAYERS),
      2,
      MAX_ROOM_PLAYERS,
    ),
    maxLevel: clamp(finiteInteger(options.maxLevel, 2), 0, 255),
    levelIds: Array.isArray(options.levelIds)
      ? options.levelIds.map((id) => String(id)).filter(Boolean)
      : null,
    contentFingerprint: typeof options.contentFingerprint === 'string'
      ? options.contentFingerprint
      : null,
    maxPayload: clamp(finiteInteger(options.maxPayload, 64 * 1024), 4096, 1024 * 1024),
    heartbeatMs: clamp(finiteInteger(options.heartbeatMs, 15_000), 2_000, 60_000),
    reconnectGraceMs: clamp(finiteInteger(options.reconnectGraceMs, 25_000), 5_000, 300_000),
    emptyRoomTtlMs: clamp(finiteInteger(options.emptyRoomTtlMs, 5 * 60_000), 10_000, 24 * 60 * 60_000),
    directoryMaxResults: clamp(
      finiteInteger(options.directoryMaxResults, DIRECTORY_MAX_RESULTS),
      1,
      DIRECTORY_MAX_RESULTS,
    ),
    directoryDefaultResults: clamp(
      finiteInteger(options.directoryDefaultResults, DIRECTORY_DEFAULT_RESULTS),
      1,
      DIRECTORY_MAX_RESULTS,
    ),
    directoryBroadcastDebounceMs: clamp(
      finiteInteger(options.directoryBroadcastDebounceMs, 160),
      50,
      2_000,
    ),
    voiceSignalRateBurst: clamp(
      finiteInteger(options.voiceSignalRateBurst, VOICE_SIGNAL_RATE_BURST),
      1,
      100,
    ),
    voiceSignalRatePerSecond: clamp(
      finiteInteger(options.voiceSignalRatePerSecond, VOICE_SIGNAL_RATE_REFILL_PER_SECOND),
      1,
      100,
    ),
    gameplayIntentRateBurst: clamp(
      finiteInteger(options.gameplayIntentRateBurst, GAMEPLAY_INTENT_RATE_BURST),
      1,
      60,
    ),
    gameplayIntentRatePerSecond: clamp(
      finiteInteger(options.gameplayIntentRatePerSecond, GAMEPLAY_INTENT_RATE_REFILL_PER_SECOND),
      1,
      60,
    ),
    chatRateBurst: clamp(finiteInteger(options.chatRateBurst, CHAT_RATE_BURST), 1, 20),
    chatRatePerSecond: clamp(
      finiteInteger(options.chatRatePerSecond, CHAT_RATE_REFILL_PER_SECOND),
      1,
      10,
    ),
  };

  const rooms = new Map();
  const contexts = new WeakMap();
  let directoryBroadcastTimer = null;

  const httpServer = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' && (request.url === '/health' || request.url === '/')) {
      const directoryRooms = publicRoomEntries(rooms, config.maxPlayers);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        protocol: MULTIPLAYER_PROTOCOL_VERSION,
        rooms: rooms.size,
        players: [...rooms.values()].reduce(
          (total, room) => total + [...room.players.values()].filter((player) => player.connected).length,
          0,
        ),
        publicRooms: directoryRooms.length,
        joinableRooms: directoryRooms.filter((room) => room.joinable).length,
        roomCapacity: config.maxPlayers,
        levelCount: config.maxLevel + 1,
        levelIds: config.levelIds,
        contentFingerprint: config.contentFingerprint,
      }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  const wss = new WebSocketServer({
    server: httpServer,
    path: config.path,
    maxPayload: config.maxPayload,
    perMessageDeflate: false,
  });
  // The HTTP server owns listen failures. Keep the WebSocket wrapper from
  // treating the same port-collision error as an unhandled process error.
  wss.on('error', () => {});

  function send(socket, message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      ...message,
      serverTime: message.serverTime ?? now(),
    }));
    return true;
  }

  function reply(socket, request, type, payload = {}) {
    return send(socket, { type, requestId: request.requestId, payload });
  }

  function sendError(socket, request, code, message, retryable = false, details = {}) {
    return send(socket, {
      type: 'error',
      requestId: request?.requestId,
      payload: { code, message, retryable, ...details },
    });
  }

  function broadcast(room, message, { except = null, only = null } = {}) {
    for (const player of room.players.values()) {
      if (!player.connected || !player.socket || player.socket === except) continue;
      if (only && player.id !== only) continue;
      send(player.socket, message);
    }
  }

  function normalizeDirectoryLimit(value) {
    return clamp(
      finiteInteger(value, config.directoryDefaultResults),
      1,
      config.directoryMaxResults,
    );
  }

  function takeDirectoryRateToken(socket, request) {
    const context = contexts.get(socket);
    const timestamp = now();
    const elapsed = Math.max(0, timestamp - context.directoryRateUpdatedAt);
    context.directoryRateTokens = Math.min(
      DIRECTORY_RATE_BURST,
      context.directoryRateTokens + elapsed / DIRECTORY_RATE_REFILL_MS,
    );
    context.directoryRateUpdatedAt = timestamp;
    if (context.directoryRateTokens < 1) {
      const retryAfterMs = Math.ceil((1 - context.directoryRateTokens) * DIRECTORY_RATE_REFILL_MS);
      sendError(
        socket,
        request,
        'DIRECTORY_RATE_LIMITED',
        'Room directory requests are temporarily rate limited.',
        true,
        { retryAfterMs },
      );
      return false;
    }
    context.directoryRateTokens -= 1;
    return true;
  }

  function takeVoiceSignalRateToken(socket, request) {
    const context = contexts.get(socket);
    const timestamp = now();
    const elapsedSeconds = Math.max(0, timestamp - context.voiceSignalRateUpdatedAt) / 1_000;
    context.voiceSignalRateTokens = Math.min(
      config.voiceSignalRateBurst,
      context.voiceSignalRateTokens + elapsedSeconds * config.voiceSignalRatePerSecond,
    );
    context.voiceSignalRateUpdatedAt = timestamp;
    if (context.voiceSignalRateTokens < 1) {
      const retryAfterMs = Math.ceil(
        ((1 - context.voiceSignalRateTokens) / config.voiceSignalRatePerSecond) * 1_000,
      );
      sendError(
        socket,
        request,
        'VOICE_SIGNAL_RATE_LIMITED',
        'Voice negotiation is temporarily rate limited.',
        true,
        { retryAfterMs },
      );
      return false;
    }
    context.voiceSignalRateTokens -= 1;
    return true;
  }

  function takeGameplayIntentRateToken(socket, request) {
    const context = contexts.get(socket);
    const timestamp = now();
    const elapsedSeconds = Math.max(0, timestamp - context.gameplayIntentRateUpdatedAt) / 1_000;
    context.gameplayIntentRateTokens = Math.min(
      config.gameplayIntentRateBurst,
      context.gameplayIntentRateTokens + elapsedSeconds * config.gameplayIntentRatePerSecond,
    );
    context.gameplayIntentRateUpdatedAt = timestamp;
    if (context.gameplayIntentRateTokens < 1) {
      const retryAfterMs = Math.ceil(
        ((1 - context.gameplayIntentRateTokens) / config.gameplayIntentRatePerSecond) * 1_000,
      );
      sendError(
        socket,
        request,
        'GAMEPLAY_INTENT_RATE_LIMITED',
        'Gameplay actions are temporarily rate limited.',
        true,
        { retryAfterMs },
      );
      return false;
    }
    context.gameplayIntentRateTokens -= 1;
    return true;
  }

  function takeChatRateToken(socket, request) {
    const context = contexts.get(socket);
    const timestamp = now();
    const elapsedSeconds = Math.max(0, timestamp - context.chatRateUpdatedAt) / 1_000;
    context.chatRateTokens = Math.min(
      config.chatRateBurst,
      context.chatRateTokens + elapsedSeconds * config.chatRatePerSecond,
    );
    context.chatRateUpdatedAt = timestamp;
    if (context.chatRateTokens < 1) {
      const retryAfterMs = Math.ceil(
        ((1 - context.chatRateTokens) / config.chatRatePerSecond) * 1_000,
      );
      sendError(
        socket,
        request,
        'CHAT_RATE_LIMITED',
        'Room chat is temporarily rate limited.',
        true,
        { retryAfterMs },
      );
      return false;
    }
    context.chatRateTokens -= 1;
    return true;
  }

  function roomDirectoryPayload(context, limit) {
    const entries = publicRoomEntries(rooms, config.maxPlayers);
    const boundedLimit = normalizeDirectoryLimit(limit);
    return {
      rooms: entries.slice(0, boundedLimit),
      total: entries.length,
      limit: boundedLimit,
      truncated: entries.length > boundedLimit,
      generatedAt: coarseTimestamp(now()),
      subscribed: Boolean(context.directorySubscribed),
    };
  }

  function roomDirectorySignature(payload) {
    return JSON.stringify({
      rooms: payload.rooms,
      total: payload.total,
      limit: payload.limit,
      truncated: payload.truncated,
    });
  }

  function listRoomDirectory(socket, request) {
    if (!takeDirectoryRateToken(socket, request)) return;
    const context = contexts.get(socket);
    const payload = roomDirectoryPayload(context, request.payload?.limit);
    if (context.directorySubscribed) context.directorySignature = roomDirectorySignature(payload);
    reply(socket, request, 'room:directory', payload);
  }

  function subscribeRoomDirectory(socket, request) {
    if (!takeDirectoryRateToken(socket, request)) return;
    const context = contexts.get(socket);
    const enabled = request.payload?.enabled !== false;
    context.directorySubscribed = enabled;
    if (!enabled) {
      context.directorySignature = null;
      reply(socket, request, 'room:directory:subscription', { subscribed: false });
      return;
    }
    context.directoryLimit = normalizeDirectoryLimit(request.payload?.limit);
    const payload = roomDirectoryPayload(context, context.directoryLimit);
    context.directorySignature = roomDirectorySignature(payload);
    reply(socket, request, 'room:directory', payload);
  }

  function broadcastRoomDirectory() {
    directoryBroadcastTimer = null;
    for (const socket of wss.clients) {
      const context = contexts.get(socket);
      if (!context?.directorySubscribed || socket.readyState !== WebSocket.OPEN) continue;
      const payload = roomDirectoryPayload(context, context.directoryLimit);
      const signature = roomDirectorySignature(payload);
      if (signature === context.directorySignature) continue;
      context.directorySignature = signature;
      send(socket, { type: 'room:directory:changed', payload });
    }
  }

  function scheduleRoomDirectoryBroadcast() {
    if (directoryBroadcastTimer) return;
    directoryBroadcastTimer = setTimeout(broadcastRoomDirectory, config.directoryBroadcastDebounceMs);
    directoryBroadcastTimer.unref?.();
  }

  function touchRoom(room) {
    room.revision += 1;
    room.updatedAt = now();
  }

  function bind(socket, room, player) {
    const context = contexts.get(socket);
    context.room = room;
    context.player = player;
    player.socket = socket;
    player.connected = true;
    player.disconnectedAt = null;
    player.lastSeen = now();
    room.emptySince = null;
  }

  function electHost(room, reason) {
    const previousHostId = room.hostId;
    const connected = [...room.players.values()]
      .filter((player) => player.connected)
      .sort((left, right) => left.joinedAt - right.joinedAt || left.id.localeCompare(right.id));
    const available = connected.filter((player) => canHostAuthority(player));
    const candidates = available.length ? available : connected;
    room.hostId = candidates[0]?.id ?? null;
    if (room.hostId !== previousHostId) {
      touchRoom(room);
      broadcast(room, {
        type: 'host:changed',
        payload: { hostId: room.hostId, previousHostId, reason, revision: room.revision },
      });
    }
    return room.hostId;
  }

  function joinedPayload(room, player, resumed) {
    return {
      room: roomSnapshot(room),
      self: {
        id: player.id,
        resumeToken: player.resumeToken,
        isHost: room.hostId === player.id,
      },
      resumed,
    };
  }

  function createRoom(socket, request) {
    const context = contexts.get(socket);
    if (context.room) {
      sendError(socket, request, 'ALREADY_IN_ROOM', 'Leave the current room before creating another.');
      return;
    }

    const payload = request.payload || {};
    const code = generateRoomCode(rooms, config.roomCodeLength);
    const timestamp = now();
    const room = {
      code,
      visibility: normalizeVisibility(payload.visibility),
      capacity: config.maxPlayers,
      seed: normalizeSeed(payload.seed, randomSeed()),
      level: normalizeLevel(payload.level, config.maxLevel),
      epoch: 1,
      hostId: null,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      emptySince: null,
      players: new Map(),
      objectives: new Map(),
      monster: null,
      game: { phase: 'lobby' },
    };
    const player = createPlayer(payload.name, socket);
    room.players.set(player.id, player);
    room.hostId = player.id;
    touchRoom(room);
    rooms.set(code, room);
    bind(socket, room, player);
    reply(socket, request, 'room:joined', joinedPayload(room, player, false));
    scheduleRoomDirectoryBroadcast();
  }

  function joinRoom(socket, request) {
    const context = contexts.get(socket);
    if (context.room) {
      sendError(socket, request, 'ALREADY_IN_ROOM', 'Leave the current room before joining another.');
      return;
    }

    const payload = request.payload || {};
    const code = normalizeCode(payload.code);
    const room = rooms.get(code);
    if (!room) {
      sendError(socket, request, 'ROOM_NOT_FOUND', 'That room does not exist or has expired.', true);
      return;
    }

    const requestedToken = typeof payload.resumeToken === 'string' ? payload.resumeToken : '';
    if (requestedToken) {
      const player = [...room.players.values()].find((candidate) => candidate.resumeToken === requestedToken);
      if (!player) {
        sendError(socket, request, 'RESUME_REJECTED', 'The resume token is no longer valid.', false);
        return;
      }

      const previousSocket = player.socket;
      bind(socket, room, player);
      if (payload.name) player.name = normalizeName(payload.name);
      if (previousSocket && previousSocket !== socket && previousSocket.readyState === WebSocket.OPEN) {
        previousSocket.close(4001, 'Session resumed from another connection');
      }
      if (!room.hostId || !room.players.get(room.hostId)?.connected) electHost(room, 'reconnect');
      touchRoom(room);
      reply(socket, request, 'room:joined', joinedPayload(room, player, true));
      broadcast(room, {
        type: 'player:joined',
        payload: { player: publicPlayer(player), resumed: true, revision: room.revision },
      }, { except: socket });
      scheduleRoomDirectoryBroadcast();
      return;
    }

    const phase = publicRoomPhase(room);
    if (phase === 'complete') {
      sendError(socket, request, 'ROOM_COMPLETE', 'That room has already crossed its threshold.', true);
      return;
    }

    if (phase !== 'lobby') {
      sendError(socket, request, 'ROOM_IN_PROGRESS', 'That run has already started.', true);
      return;
    }

    if (room.players.size >= config.maxPlayers) {
      sendError(socket, request, 'ROOM_FULL', 'That room has reached its player limit.', true);
      return;
    }

    const player = createPlayer(payload.name, socket);
    room.players.set(player.id, player);
    bind(socket, room, player);
    if (!room.hostId || !room.players.get(room.hostId)?.connected) electHost(room, 'join');
    touchRoom(room);
    reply(socket, request, 'room:joined', joinedPayload(room, player, false));
    broadcast(room, {
      type: 'player:joined',
      payload: { player: publicPlayer(player), resumed: false, revision: room.revision },
    }, { except: socket });
    scheduleRoomDirectoryBroadcast();
  }

  function leaveRoom(socket, request) {
    const context = contexts.get(socket);
    const { room, player } = context;
    if (!room || !player) {
      sendError(socket, request, 'NOT_IN_ROOM', 'Join a room first.');
      return;
    }

    const wasHost = room.hostId === player.id;
    room.players.delete(player.id);
    player.connected = false;
    player.socket = null;
    context.room = null;
    context.player = null;
    touchRoom(room);
    broadcast(room, {
      type: 'player:left',
      payload: { playerId: player.id, voluntary: true, resumableUntil: null, revision: room.revision },
    });
    if (wasHost) electHost(room, 'leave');
    if (![...room.players.values()].some((candidate) => candidate.connected)) room.emptySince = now();
    reply(socket, request, 'room:left', { code: room.code });
    scheduleRoomDirectoryBroadcast();
  }

  function requireRoom(socket, request) {
    const context = contexts.get(socket);
    if (!context.room || !context.player) {
      sendError(socket, request, 'NOT_IN_ROOM', 'Join a room first.');
      return null;
    }
    return context;
  }

  function requireHost(socket, request) {
    const context = requireRoom(socket, request);
    if (!context) return null;
    if (context.room.hostId !== context.player.id) {
      sendError(socket, request, 'HOST_ONLY', 'Only the current room host may publish authoritative world events.');
      return null;
    }
    return context;
  }

  function requireCurrentEpoch(socket, request, context, { silent = false } = {}) {
    const requestEpoch = finiteInteger(request.payload?.epoch, -1);
    if (requestEpoch === context.room.epoch) return true;
    if (!silent) sendError(
      socket,
      request,
      'STALE_WORLD',
      'That action belongs to an earlier room world.',
      false,
    );
    return false;
  }

  function relayPlayerState(socket, request) {
    const context = requireRoom(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context, { silent: true })) return;
    const previousDirectoryPhase = publicRoomPhase(context.room);
    const payload = request.payload || {};
    const sequence = finiteInteger(payload.sequence, context.player.sequence + 1);
    if (sequence <= context.player.sequence) {
      if (request.requestId) reply(socket, request, 'player:state:ack', { sequence, ignored: true });
      return;
    }

    const state = sanitizeJson(payload.state) || {};
    context.player.sequence = sequence;
    context.player.state = state;
    context.player.lastSeen = now();
    context.player.stateUpdatedAt = context.player.lastSeen;
    const currentHost = context.room.players.get(context.room.hostId);
    const availablePlayers = [...context.room.players.values()].filter((player) => canHostAuthority(player));
    if (
      context.room.game?.lastEvent !== 'level-complete'
      && availablePlayers.length
      && !availablePlayers.some((player) => player.id === currentHost?.id)
    ) electHost(context.room, 'availability');
    broadcast(context.room, {
      type: 'player:state',
      payload: { playerId: context.player.id, sequence, state, epoch: context.room.epoch },
    }, { except: socket });
    if (request.requestId) reply(socket, request, 'player:state:ack', { sequence, ignored: false });
    if (publicRoomPhase(context.room) !== previousDirectoryPhase) scheduleRoomDirectoryBroadcast();
  }

  function relayObjectiveIntent(socket, request) {
    const context = requireRoom(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;
    if (!takeGameplayIntentRateToken(socket, request)) return;
    const host = context.room.players.get(context.room.hostId);
    if (!host?.connected || !host.socket) {
      sendError(socket, request, 'HOST_UNAVAILABLE', 'No authoritative host is currently connected.', true);
      return;
    }
    const payload = request.payload || {};
    const event = {
      objectiveId: normalizeIdentifier(payload.objectiveId, 'objective'),
      action: normalizeIdentifier(payload.action, 'activate'),
      state: sanitizeJson(payload.state) || {},
      playerId: context.player.id,
      epoch: context.room.epoch,
    };
    send(host.socket, { type: 'objective:intent', payload: event });
    reply(socket, request, 'objective:intent:ack', { deliveredTo: host.id });
  }

  function relayVoiceSignal(socket, request) {
    const context = requireRoom(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;
    if (!takeVoiceSignalRateToken(socket, request)) return;

    const targetPlayerId = normalizeVoiceTarget(request.payload?.targetPlayerId);
    if (!targetPlayerId) {
      sendError(socket, request, 'INVALID_VOICE_TARGET', 'A valid voice target is required.');
      return;
    }
    if (targetPlayerId === context.player.id) {
      sendError(socket, request, 'VOICE_SELF_TARGET', 'Voice signaling cannot target the sending player.');
      return;
    }

    const target = context.room.players.get(targetPlayerId);
    if (!target?.connected || !target.socket || target.socket.readyState !== WebSocket.OPEN) {
      sendError(
        socket,
        request,
        'VOICE_TARGET_UNAVAILABLE',
        'That voice target is not connected to this room.',
        true,
      );
      return;
    }

    const signal = normalizeVoiceSignal(request.payload?.signal);
    if (!signal) {
      sendError(socket, request, 'INVALID_VOICE_SIGNAL', 'The voice negotiation message is invalid.');
      return;
    }

    send(target.socket, {
      type: 'voice:signal',
      payload: {
        epoch: context.room.epoch,
        fromPlayerId: context.player.id,
        signal,
      },
    });
    reply(socket, request, 'voice:signal:ack', {
      deliveredTo: target.id,
      signalType: signal.type,
    });
  }

  function relayRoomChat(socket, request) {
    const context = requireRoom(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;

    const text = normalizeChatText(request.payload?.text);
    if (!text) {
      sendError(socket, request, 'INVALID_CHAT', 'Chat messages must contain printable text.');
      return;
    }
    if (!takeChatRateToken(socket, request)) return;

    const event = {
      epoch: context.room.epoch,
      fromPlayerId: context.player.id,
      fromName: context.player.name,
      text,
      sentAt: now(),
    };
    broadcast(context.room, { type: 'room:chat', payload: event });
    reply(socket, request, 'room:chat:ack', {
      delivered: true,
      sentAt: event.sentAt,
    });
  }

  function relayObjectiveEvent(socket, request) {
    const context = requireHost(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;
    const payload = request.payload || {};
    const objectiveId = normalizeIdentifier(payload.objectiveId, 'objective');
    const event = {
      objectiveId,
      action: normalizeIdentifier(payload.action, 'activate'),
      state: sanitizeJson(payload.state) || {},
      playerId: context.player.id,
      updatedAt: now(),
      epoch: context.room.epoch,
    };
    context.room.objectives.set(objectiveId, event);
    touchRoom(context.room);
    broadcast(context.room, {
      type: 'objective:event',
      payload: { ...event, revision: context.room.revision },
    });
    reply(socket, request, 'objective:event:ack', { revision: context.room.revision });
  }

  function relayWorldEvent(kind, socket, request) {
    const context = requireHost(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;
    const payload = request.payload || {};
    const action = normalizeIdentifier(payload.action, 'update');
    if (
      kind === 'game'
      && context.room.game?.lastEvent === 'level-complete'
      && action !== 'level-complete'
    ) {
      reply(socket, request, 'game:event:ack', {
        revision: context.room.revision,
        ignored: true,
      });
      return;
    }
    let state = sanitizeJson(payload.state) || {};
    if (kind === 'game' && action === 'session-start') {
      if (publicRoomPhase(context.room) !== 'lobby') {
        reply(socket, request, 'game:event:ack', {
          revision: context.room.revision,
          ignored: true,
        });
        return;
      }
      const connectedPlayers = [...context.room.players.values()]
        .filter((player) => player.connected);
      if (!connectedPlayers.length || connectedPlayers.some((player) => player.state?.ready !== true)) {
        sendError(
          socket,
          request,
          'PLAYERS_NOT_READY',
          'Every connected player must be ready before the run starts.',
          true,
        );
        return;
      }
      state = {
        ...state,
        phase: 'playing',
        capacity: config.maxPlayers,
        startedAt: finiteInteger(state.startedAt, now()),
      };
    }
    const event = {
      action,
      state,
      playerId: context.player.id,
      updatedAt: now(),
      epoch: context.room.epoch,
    };
    context.room[kind] = {
      ...(context.room[kind] || {}),
      ...event.state,
      lastEvent: event.action,
      updatedAt: event.updatedAt,
      updatedBy: event.playerId,
      epoch: event.epoch,
    };
    touchRoom(context.room);
    broadcast(context.room, {
      type: `${kind}:event`,
      payload: { ...event, revision: context.room.revision },
    });
    reply(socket, request, `${kind}:event:ack`, { revision: context.room.revision });
    if (kind === 'game') scheduleRoomDirectoryBroadcast();
  }

  function syncWorld(socket, request) {
    const context = requireHost(socket, request);
    if (!context) return;
    if (!requireCurrentEpoch(socket, request, context)) return;
    const payload = request.payload || {};
    context.room.seed = normalizeSeed(payload.seed, context.room.seed);
    context.room.level = normalizeLevel(payload.level ?? context.room.level, config.maxLevel);
    const reset = payload.reset !== false;
    if (reset) {
      context.room.epoch += 1;
      context.room.objectives.clear();
      context.room.monster = null;
      context.room.game = { phase: 'loading' };
      for (const player of context.room.players.values()) {
        player.sequence = -1;
        player.state = null;
        player.stateUpdatedAt = null;
      }
    }
    touchRoom(context.room);
    const event = {
      seed: context.room.seed,
      level: context.room.level,
      reset,
      hostId: context.room.hostId,
      revision: context.room.revision,
      epoch: context.room.epoch,
    };
    broadcast(context.room, { type: 'world:synced', payload: event });
    reply(socket, request, 'world:sync:ack', event);
    scheduleRoomDirectoryBroadcast();
  }

  function handleMessage(socket, raw) {
    const context = contexts.get(socket);
    context.lastSeen = now();
    if (context.player) context.player.lastSeen = context.lastSeen;

    let request;
    try {
      request = JSON.parse(raw.toString());
    } catch {
      sendError(socket, null, 'INVALID_JSON', 'Messages must be valid JSON objects.');
      return;
    }
    if (!request || typeof request !== 'object' || typeof request.type !== 'string') {
      sendError(socket, request, 'INVALID_MESSAGE', 'A message type is required.');
      return;
    }

    switch (request.type) {
      case 'heartbeat':
        reply(socket, request, 'heartbeat:ack', { clientTime: request.payload?.clientTime ?? null });
        break;
      case 'room:create':
        createRoom(socket, request);
        break;
      case 'room:join':
        joinRoom(socket, request);
        break;
      case 'room:leave':
        leaveRoom(socket, request);
        break;
      case 'room:snapshot:request': {
        const joined = requireRoom(socket, request);
        if (joined) reply(socket, request, 'room:snapshot', { room: roomSnapshot(joined.room) });
        break;
      }
      case 'room:directory:list':
        listRoomDirectory(socket, request);
        break;
      case 'room:directory:subscribe':
        subscribeRoomDirectory(socket, request);
        break;
      case 'player:state':
        relayPlayerState(socket, request);
        break;
      case 'voice:signal':
        relayVoiceSignal(socket, request);
        break;
      case 'room:chat':
        relayRoomChat(socket, request);
        break;
      case 'objective:intent':
        relayObjectiveIntent(socket, request);
        break;
      case 'objective:event':
        relayObjectiveEvent(socket, request);
        break;
      case 'monster:event':
        relayWorldEvent('monster', socket, request);
        break;
      case 'game:event':
        relayWorldEvent('game', socket, request);
        break;
      case 'world:sync':
        syncWorld(socket, request);
        break;
      default:
        sendError(socket, request, 'UNKNOWN_MESSAGE', `Unknown message type: ${request.type}`);
    }
  }

  function disconnect(socket, reason = 'connection-lost') {
    const context = contexts.get(socket);
    if (!context?.room || !context.player || context.player.socket !== socket) return;
    const { room, player } = context;
    player.connected = false;
    player.socket = null;
    player.disconnectedAt = now();
    player.lastSeen = player.disconnectedAt;
    context.room = null;
    context.player = null;
    touchRoom(room);
    broadcast(room, {
      type: 'player:left',
      payload: {
        playerId: player.id,
        voluntary: false,
        reason,
        resumableUntil: player.disconnectedAt + config.reconnectGraceMs,
        revision: room.revision,
      },
    });
    if (room.hostId === player.id) electHost(room, 'disconnect');
    if (![...room.players.values()].some((candidate) => candidate.connected)) room.emptySince = now();
    scheduleRoomDirectoryBroadcast();
  }

  wss.on('connection', (socket) => {
    contexts.set(socket, {
      room: null,
      player: null,
      lastSeen: now(),
      alive: true,
      directorySubscribed: false,
      directoryLimit: config.directoryDefaultResults,
      directorySignature: null,
      directoryRateTokens: DIRECTORY_RATE_BURST,
      directoryRateUpdatedAt: now(),
      voiceSignalRateTokens: config.voiceSignalRateBurst,
      voiceSignalRateUpdatedAt: now(),
      gameplayIntentRateTokens: config.gameplayIntentRateBurst,
      gameplayIntentRateUpdatedAt: now(),
      chatRateTokens: config.chatRateBurst,
      chatRateUpdatedAt: now(),
    });
    socket.on('pong', () => {
      const context = contexts.get(socket);
      if (context) context.alive = true;
    });
    socket.on('message', (data) => handleMessage(socket, data));
    socket.on('close', (code) => disconnect(socket, `socket-${code}`));
    socket.on('error', () => disconnect(socket, 'socket-error'));
    send(socket, {
      type: 'server:hello',
      payload: {
        protocol: MULTIPLAYER_PROTOCOL_VERSION,
        heartbeatMs: config.heartbeatMs,
        reconnectGraceMs: config.reconnectGraceMs,
        maxPlayers: config.maxPlayers,
        capabilities: ['room-directory', 'voice-signaling', 'text-chat-v1', 'survival-v1', 'waiting-room-v1'],
        directoryMaxResults: config.directoryMaxResults,
        levelIds: config.levelIds,
        contentFingerprint: config.contentFingerprint,
      },
    });
  });

  function cleanup() {
    const timestamp = now();
    let directoryChanged = false;
    for (const [code, room] of rooms) {
      for (const [playerId, player] of room.players) {
        if (player.connected || !player.disconnectedAt) continue;
        if (timestamp - player.disconnectedAt < config.reconnectGraceMs) continue;
        room.players.delete(playerId);
        directoryChanged = true;
        touchRoom(room);
        broadcast(room, {
          type: 'player:removed',
          payload: { playerId, revision: room.revision },
        });
      }
      if (!room.players.size && room.emptySince && timestamp - room.emptySince >= config.emptyRoomTtlMs) {
        rooms.delete(code);
        directoryChanged = true;
      }
    }
    if (directoryChanged) scheduleRoomDirectoryBroadcast();

    for (const socket of wss.clients) {
      const context = contexts.get(socket);
      if (!context) continue;
      if (!context.alive) {
        socket.terminate();
        continue;
      }
      context.alive = false;
      socket.ping();
    }
  }

  const maintenance = setInterval(cleanup, config.heartbeatMs);
  maintenance.unref?.();

  return {
    config,
    rooms,
    httpServer,
    wss,
    listen() {
      if (httpServer.listening) return Promise.resolve(httpServer.address());
      return new Promise((resolveListen, rejectListen) => {
        const onError = (error) => {
          httpServer.off('listening', onListening);
          rejectListen(error);
        };
        const onListening = () => {
          httpServer.off('error', onError);
          resolveListen(httpServer.address());
        };
        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(config.port, config.host);
      });
    },
    async close() {
      clearInterval(maintenance);
      clearTimeout(directoryBroadcastTimer);
      directoryBroadcastTimer = null;
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolveClose) => wss.close(() => resolveClose()));
      if (httpServer.listening) {
        await new Promise((resolveClose) => httpServer.close(() => resolveClose()));
      }
    },
    snapshot(code) {
      const room = rooms.get(normalizeCode(code));
      return room ? roomSnapshot(room) : null;
    },
  };
}

if (directRun()) {
  const discoveredLevels = await loadLevelsFromDisk();
  const discoveredCharacters = await loadCharactersFromDisk();
  const multiplayerServer = createMultiplayerServer({
    maxLevel: discoveredLevels.length - 1,
    levelIds: discoveredLevels.map((level) => level.id),
    contentFingerprint: createGameContentFingerprint(discoveredLevels, discoveredCharacters.definitions),
  });
  multiplayerServer.listen().then((address) => {
    const host = typeof address === 'object' && address ? address.address : multiplayerServer.config.host;
    const port = typeof address === 'object' && address ? address.port : multiplayerServer.config.port;
    console.log(`THRESHOLD multiplayer server listening on ws://${host}:${port}${multiplayerServer.config.path}`);
    console.log(`Auto-loaded levels: ${discoveredLevels.length}`);
    console.log(`Auto-loaded characters: ${discoveredCharacters.definitions.length}`);
  }).catch((error) => {
    console.error(`Unable to start multiplayer server: ${error.message}`);
    process.exitCode = 1;
  });

  const shutdown = async () => {
    await multiplayerServer.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
