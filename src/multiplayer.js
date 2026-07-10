/**
 * Browser client for the THRESHOLD multiplayer protocol.
 *
 * Public lifecycle:
 *   const multiplayer = new MultiplayerClient({ url });
 *   await multiplayer.createRoom({ name, seed, level });
 *   // or: await multiplayer.joinRoom(code, { name, resumeToken });
 *
 * MultiplayerClient extends EventTarget. `on(type, handler)` is a convenience
 * wrapper that passes event.detail and returns an unsubscribe function.
 * High-frequency player state is fire-and-forget; authoritative world methods
 * return promises and reject with MultiplayerProtocolError on server denial.
 * `connect()` resolves only after a compatible `server:hello`; an open socket
 * is never treated as room-ready before protocol and content validation.
 * The instance keeps its private resume token across transient disconnects and
 * automatically rejoins before emitting `resumed`.
 */

export const MULTIPLAYER_PROTOCOL_VERSION = 6;

export class MultiplayerProtocolError extends Error {
  constructor(code, message, { retryable = false, cause, details = {} } = {}) {
    super(message, { cause });
    this.name = 'MultiplayerProtocolError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function randomRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeRoomCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function normalizeDirectoryLimit(limit) {
  const number = Number(limit);
  return Math.max(1, Math.min(50, Number.isFinite(number) ? Math.trunc(number) : 20));
}

function dispatchDetail(target, type, detail) {
  let event;
  if (typeof CustomEvent === 'function') event = new CustomEvent(type, { detail });
  else {
    event = new Event(type);
    Object.defineProperty(event, 'detail', { value: detail, enumerable: true });
  }
  target.dispatchEvent(event);
}

export function defaultMultiplayerUrl({ port = 8787, path = '/multiplayer' } = {}) {
  const configured = import.meta.env?.VITE_MULTIPLAYER_URL;
  if (configured) return configured;
  if (typeof window === 'undefined') return `ws://127.0.0.1:${port}${path}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname || '127.0.0.1'}:${port}${path}`;
}

function upsertPlayer(room, player) {
  if (!room || !player?.id) return;
  const players = Array.isArray(room.players) ? room.players : [];
  const index = players.findIndex((candidate) => candidate.id === player.id);
  if (index === -1) players.push(player);
  else players[index] = { ...players[index], ...player };
  room.players = players;
}

export class MultiplayerClient extends EventTarget {
  constructor(options = {}) {
    super();
    this.url = options.url || defaultMultiplayerUrl(options);
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    if (!this.WebSocketImpl) throw new Error('WebSocket is not available in this environment.');

    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectMinDelay = Math.max(100, Number(options.reconnectMinDelay) || 500);
    this.reconnectMaxDelay = Math.max(this.reconnectMinDelay, Number(options.reconnectMaxDelay) || 8_000);
    this.heartbeatInterval = Math.max(2_000, Number(options.heartbeatInterval) || 10_000);
    this.requestTimeout = Math.max(1_000, Number(options.requestTimeout) || 10_000);
    this.expectedLevelIds = Array.isArray(options.expectedLevelIds)
      ? options.expectedLevelIds.map((id) => String(id))
      : null;
    this.expectedContentFingerprint = typeof options.expectedContentFingerprint === 'string'
      ? options.expectedContentFingerprint
      : null;

    this.socket = null;
    this.status = 'disconnected';
    this.room = null;
    this.self = null;
    this.roomCode = null;
    this.resumeToken = null;
    this.playerName = 'Wanderer';
    this.serverCapabilities = [];
    this.roomDirectory = {
      rooms: [],
      total: 0,
      limit: 20,
      truncated: false,
      generatedAt: null,
      subscribed: false,
    };

    this._manualClose = false;
    this._connectPromise = null;
    this._handshake = null;
    this._helloAccepted = false;
    this._reconnectTimer = null;
    this._reconnectAttempt = 0;
    this._heartbeatTimer = null;
    this._lastInboundAt = 0;
    this._pending = new Map();
    this._sequence = 0;
    this._resuming = false;
    this._directorySubscriptionLimit = null;
  }

  get isConnected() {
    return Boolean(this._helloAccepted && this.socket && this.socket.readyState === 1);
  }

  get isHost() {
    return Boolean(this.self?.id && this.room?.hostId === this.self.id);
  }

  on(type, handler, options) {
    const listener = (event) => handler(event.detail, event);
    this.addEventListener(type, listener, options);
    return () => this.removeEventListener(type, listener, options);
  }

  _setStatus(status, detail = {}) {
    if (this.status === status && !Object.keys(detail).length) return;
    this.status = status;
    dispatchDetail(this, 'status', { status, ...detail });
  }

  connect() {
    if (this._connectPromise) return this._connectPromise;
    if (this.isConnected) return Promise.resolve();

    this._manualClose = false;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._setStatus(this._reconnectAttempt ? 'reconnecting' : 'connecting', {
      attempt: this._reconnectAttempt,
    });

    let resolveConnect;
    let rejectConnect;
    const connectPromise = new Promise((resolve, reject) => {
      resolveConnect = resolve;
      rejectConnect = reject;
    });
    this._connectPromise = connectPromise;

    let socket;
    try {
      socket = new this.WebSocketImpl(this.url);
    } catch (error) {
      this._connectPromise = null;
      rejectConnect(error);
      this._scheduleReconnect();
      return connectPromise;
    }

    this.socket = socket;
    this._helloAccepted = false;
    this.serverCapabilities = [];
    let settled = false;
    const settleHandshake = (error = null) => {
      if (settled || this._handshake?.socket !== socket) return false;
      settled = true;
      clearTimeout(this._handshake.timer);
      this._handshake = null;
      if (this._connectPromise === connectPromise) this._connectPromise = null;
      if (error) rejectConnect(error);
      else resolveConnect();
      return true;
    };
    const acceptHandshake = () => {
      if (settled || this.socket !== socket) return false;
      if (!settleHandshake()) return false;
      this._helloAccepted = true;
      this._lastInboundAt = Date.now();
      this._reconnectAttempt = 0;
      this._setStatus('connected');
      this._startHeartbeat();
      if (this.roomCode && this.resumeToken) this._resumeAfterReconnect();
      if (this._directorySubscriptionLimit != null) this._restoreDirectorySubscription();
      return true;
    };
    const rejectHandshake = (error) => settleHandshake(error);
    this._handshake = {
      socket,
      accept: acceptHandshake,
      reject: rejectHandshake,
      timer: setTimeout(() => {
        if (this._handshake?.socket !== socket) return;
        const error = new MultiplayerProtocolError(
          'HANDSHAKE_TIMEOUT',
          'The room server did not send a compatible handshake in time.',
          { retryable: true },
        );
        dispatchDetail(this, 'protocol:error', error);
        rejectHandshake(error);
        if (this.socket === socket && socket.readyState < 2) socket.close(4004, 'Handshake timeout');
      }, this.requestTimeout),
    };

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this._lastInboundAt = Date.now();
    });

    socket.addEventListener('message', (event) => {
      void this._consumeMessage(event.data, socket);
    });

    socket.addEventListener('error', (event) => {
      if (this.socket !== socket) return;
      dispatchDetail(this, 'socket:error', { event });
      if (this._handshake?.socket === socket) {
        rejectHandshake(new MultiplayerProtocolError(
          'CONNECTION_FAILED',
          'Unable to connect to the room server.',
          { retryable: true },
        ));
        if (socket.readyState < 2) socket.close(4004, 'Handshake failed');
      }
    });

    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      const sessionReplaced = event.code === 4001;
      const preserveIncompatible = this.status === 'incompatible';
      const closeError = new MultiplayerProtocolError(
        'CONNECTION_CLOSED',
        this._helloAccepted
          ? 'The room connection closed.'
          : 'The room connection closed before a compatible server handshake.',
        { retryable: !this._manualClose && !sessionReplaced && !preserveIncompatible },
      );
      if (this._handshake?.socket === socket) rejectHandshake(closeError);
      this.socket = null;
      this._helloAccepted = false;
      if (this._connectPromise === connectPromise) this._connectPromise = null;
      this._stopHeartbeat();
      if (this.roomDirectory.subscribed) {
        this.roomDirectory = { ...this.roomDirectory, subscribed: false };
        dispatchDetail(this, 'room:directory:updated', this.roomDirectory);
      }
      this._rejectPending(closeError);
      dispatchDetail(this, 'socket:closed', {
        code: event.code,
        reason: event.reason,
        clean: event.wasClean,
      });
      if (sessionReplaced) {
        this._manualClose = true;
        this._setStatus('replaced');
        dispatchDetail(this, 'session:replaced', { code: event.code, reason: event.reason });
      } else if (preserveIncompatible) {
        this._manualClose = true;
      } else if (this._manualClose) this._setStatus('disconnected');
      else {
        this._setStatus('reconnecting', { attempt: this._reconnectAttempt + 1 });
        this._scheduleReconnect();
      }
    });

    return connectPromise;
  }

  async createRoom({ name = 'Wanderer', seed, level = 0, visibility = 'private' } = {}) {
    this.playerName = String(name || 'Wanderer').slice(0, 24);
    await this.connect();
    const message = await this._request('room:create', {
      name: this.playerName,
      seed,
      level,
      visibility: visibility === 'public' ? 'public' : 'private',
    });
    return message.payload;
  }

  async joinRoom(code, { name = 'Wanderer', resumeToken } = {}) {
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) throw new MultiplayerProtocolError('INVALID_CODE', 'A room code is required.');
    this.playerName = String(name || 'Wanderer').slice(0, 24);
    await this.connect();
    const message = await this._request('room:join', {
      code: roomCode,
      name: this.playerName,
      resumeToken,
    });
    return message.payload;
  }

  async leaveRoom() {
    if (!this.roomCode) return null;
    const message = await this._request('room:leave', {});
    this._forgetRoom();
    return message.payload;
  }

  async requestSnapshot() {
    const message = await this._request('room:snapshot:request', {});
    return message.payload.room;
  }

  async listRooms({ limit = 20 } = {}) {
    await this.connect();
    const message = await this._request('room:directory:list', {
      limit: normalizeDirectoryLimit(limit),
    });
    return message.payload;
  }

  async subscribeRoomDirectory({ limit = 20 } = {}) {
    await this.connect();
    this._directorySubscriptionLimit = normalizeDirectoryLimit(limit);
    try {
      const message = await this._request('room:directory:subscribe', {
        enabled: true,
        limit: this._directorySubscriptionLimit,
      });
      return message.payload;
    } catch (error) {
      this._directorySubscriptionLimit = null;
      throw error;
    }
  }

  async unsubscribeRoomDirectory() {
    this._directorySubscriptionLimit = null;
    if (!this.isConnected) {
      this.roomDirectory = { ...this.roomDirectory, subscribed: false };
      dispatchDetail(this, 'room:directory:updated', this.roomDirectory);
      return { subscribed: false };
    }
    const message = await this._request('room:directory:subscribe', { enabled: false });
    return message.payload;
  }

  sendPlayerState(state, sequence = null) {
    if (!this.isConnected || !this.roomCode) return false;
    const nextSequence = sequence == null ? ++this._sequence : Number(sequence);
    this._sequence = Math.max(this._sequence, Number.isFinite(nextSequence) ? nextSequence : this._sequence + 1);
    this._send({
      type: 'player:state',
      payload: { epoch: this.room?.epoch, sequence: this._sequence, state },
    });
    return true;
  }

  async sendObjectiveIntent({ objectiveId, action = 'activate', state = {} }) {
    return (await this._request('objective:intent', {
      epoch: this.room?.epoch,
      objectiveId,
      action,
      state,
    })).payload;
  }

  async sendVoiceSignal(targetPlayerId, signal) {
    return (await this._request('voice:signal', {
      epoch: this.room?.epoch,
      targetPlayerId: String(targetPlayerId || '').trim().slice(0, 64),
      signal,
    })).payload;
  }

  async sendObjectiveEvent({ objectiveId, action = 'activate', state = {} }) {
    return (await this._request('objective:event', {
      epoch: this.room?.epoch,
      objectiveId,
      action,
      state,
    })).payload;
  }

  async sendMonsterEvent({ action = 'update', state = {} } = {}) {
    return (await this._request('monster:event', { epoch: this.room?.epoch, action, state })).payload;
  }

  async sendGameEvent({ action = 'update', state = {} } = {}) {
    return (await this._request('game:event', { epoch: this.room?.epoch, action, state })).payload;
  }

  async syncWorld({ seed = this.room?.seed, level = this.room?.level, reset = true } = {}) {
    return (await this._request('world:sync', {
      epoch: this.room?.epoch,
      seed,
      level,
      reset,
    })).payload;
  }

  disconnect({ forgetRoom = false } = {}) {
    const preserveIncompatible = this.status === 'incompatible';
    this._manualClose = true;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._stopHeartbeat();
    if (forgetRoom) this._forgetRoom();
    if (this.socket && this.socket.readyState < 2) this.socket.close(1000, 'Client disconnect');
    else if (!preserveIncompatible) this._setStatus('disconnected');
  }

  _send(message) {
    if (!this.isConnected) {
      throw new MultiplayerProtocolError('NOT_CONNECTED', 'Connect to the room server first.', { retryable: true });
    }
    this.socket.send(JSON.stringify(message));
  }

  _request(type, payload) {
    const requestId = randomRequestId();
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this._pending.delete(requestId);
        rejectRequest(new MultiplayerProtocolError('REQUEST_TIMEOUT', `${type} timed out.`, { retryable: true }));
      }, this.requestTimeout);
      this._pending.set(requestId, { resolve: resolveRequest, reject: rejectRequest, timeout, type });
      try {
        this._send({ type, requestId, payload });
      } catch (error) {
        clearTimeout(timeout);
        this._pending.delete(requestId);
        rejectRequest(error);
      }
    });
  }

  async _consumeMessage(raw, sourceSocket = this.socket) {
    if (sourceSocket && this.socket !== sourceSocket) return;
    let text = raw;
    if (typeof Blob !== 'undefined' && raw instanceof Blob) text = await raw.text();
    else if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(raw);
    else if (typeof raw !== 'string') text = raw.toString();
    if (sourceSocket && this.socket !== sourceSocket) return;

    let message;
    try {
      message = JSON.parse(text);
    } catch {
      const error = new MultiplayerProtocolError('INVALID_JSON', 'The server sent invalid JSON.');
      if (!this._helloAccepted && sourceSocket) {
        this._rejectIncompatibleHandshake(sourceSocket, error, 4002, 'Invalid handshake');
      } else dispatchDetail(this, 'protocol:error', error);
      return;
    }
    this._lastInboundAt = Date.now();

    if (message.type === 'server:hello') {
      if (!this._acceptServerHello(message.payload || {}, sourceSocket)) return;
      dispatchDetail(this, message.type, message.payload || {});
      dispatchDetail(this, 'message', message);
      return;
    }

    if (!this._helloAccepted) {
      this._rejectIncompatibleHandshake(
        sourceSocket,
        new MultiplayerProtocolError(
          'HANDSHAKE_REQUIRED',
          'The room server sent data before a compatible server handshake.',
        ),
        4002,
        'Handshake required',
      );
      return;
    }

    if (message.type === 'error') {
      const payload = message.payload || {};
      const error = new MultiplayerProtocolError(payload.code || 'SERVER_ERROR', payload.message || 'Room server error.', {
        retryable: Boolean(payload.retryable),
        details: payload,
      });
      const pending = this._pending.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this._pending.delete(message.requestId);
        pending.reject(error);
      }
      dispatchDetail(this, 'protocol:error', error);
      return;
    }

    this._applyMessage(message);
    const pending = this._pending.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this._pending.delete(message.requestId);
      pending.resolve(message);
    }
    dispatchDetail(this, message.type, message.payload || {});
    dispatchDetail(this, 'message', message);
  }

  _acceptServerHello(payload, sourceSocket) {
    if (!sourceSocket || this.socket !== sourceSocket) return false;
    let error = null;
    let closeCode = 4002;
    let closeReason = 'Protocol mismatch';
    if (payload.protocol !== MULTIPLAYER_PROTOCOL_VERSION) {
      error = new MultiplayerProtocolError(
        'PROTOCOL_MISMATCH',
        `Server protocol ${payload.protocol} does not match client protocol ${MULTIPLAYER_PROTOCOL_VERSION}.`,
      );
    } else if (
      this.expectedLevelIds
      && JSON.stringify(payload.levelIds || []) !== JSON.stringify(this.expectedLevelIds)
    ) {
      error = new MultiplayerProtocolError(
        'CONTENT_MISMATCH',
        'Server level catalog does not match this game build.',
      );
      closeCode = 4003;
      closeReason = 'Content mismatch';
    } else if (
      this.expectedContentFingerprint
      && payload.contentFingerprint !== this.expectedContentFingerprint
    ) {
      error = new MultiplayerProtocolError(
        'CONTENT_MISMATCH',
        'Server content fingerprint does not match this game build.',
      );
      closeCode = 4003;
      closeReason = 'Content mismatch';
    }

    if (error) {
      this._rejectIncompatibleHandshake(sourceSocket, error, closeCode, closeReason);
      return false;
    }

    this.serverCapabilities = Array.isArray(payload.capabilities) ? [...payload.capabilities] : [];
    if (this._helloAccepted) return true;
    const handshake = this._handshake;
    if (!handshake || handshake.socket !== sourceSocket || !handshake.accept()) {
      this._rejectIncompatibleHandshake(
        sourceSocket,
        new MultiplayerProtocolError('HANDSHAKE_STATE', 'The server handshake arrived in an invalid client state.'),
        4002,
        'Invalid handshake state',
      );
      return false;
    }
    return true;
  }

  _rejectIncompatibleHandshake(sourceSocket, error, closeCode, closeReason) {
    if (!sourceSocket || this.socket !== sourceSocket) return;
    this._manualClose = true;
    this._setStatus('incompatible');
    dispatchDetail(this, 'protocol:error', error);
    if (this._handshake?.socket === sourceSocket) this._handshake.reject(error);
    if (sourceSocket.readyState < 2) sourceSocket.close(closeCode, closeReason);
  }

  _applyMessage(message) {
    const payload = message.payload || {};
    if (message.type === 'room:directory' || message.type === 'room:directory:changed') {
      this.roomDirectory = {
        rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
        total: Number(payload.total) || 0,
        limit: Number(payload.limit) || this.roomDirectory.limit,
        truncated: Boolean(payload.truncated),
        generatedAt: Number(payload.generatedAt) || null,
        subscribed: Boolean(payload.subscribed),
      };
      dispatchDetail(this, 'room:directory:updated', this.roomDirectory);
    } else if (message.type === 'room:directory:subscription') {
      this.roomDirectory = { ...this.roomDirectory, subscribed: Boolean(payload.subscribed) };
      dispatchDetail(this, 'room:directory:updated', this.roomDirectory);
    } else if (message.type === 'room:joined') {
      this.room = payload.room;
      this.self = payload.self;
      this.roomCode = payload.room?.code || null;
      this.resumeToken = payload.self?.resumeToken || null;
      this._sequence = this.room?.players?.find((player) => player.id === this.self?.id)?.sequence ?? 0;
      this._setStatus('joined', { code: this.roomCode, resumed: Boolean(payload.resumed) });
    } else if (message.type === 'room:snapshot') {
      this.room = payload.room;
      if (this.self) this.self.isHost = this.isHost;
    } else if (message.type === 'room:left') {
      this._forgetRoom();
    } else if (message.type === 'host:changed') {
      if (this.room) {
        this.room.hostId = payload.hostId;
        this.room.revision = payload.revision ?? this.room.revision;
      }
      if (this.self) this.self.isHost = this.isHost;
    } else if (message.type === 'player:joined') {
      upsertPlayer(this.room, payload.player);
      if (this.room && payload.revision != null) this.room.revision = payload.revision;
    } else if (message.type === 'player:left') {
      const player = this.room?.players?.find((candidate) => candidate.id === payload.playerId);
      if (payload.voluntary && this.room) {
        this.room.players = this.room.players.filter((candidate) => candidate.id !== payload.playerId);
      }
      else if (player) {
        player.connected = false;
        player.disconnectedAt = message.serverTime;
      }
      if (this.room && payload.revision != null) this.room.revision = payload.revision;
    } else if (message.type === 'player:removed') {
      if (this.room) {
        this.room.players = this.room.players.filter((candidate) => candidate.id !== payload.playerId);
        if (payload.revision != null) this.room.revision = payload.revision;
      }
    } else if (message.type === 'player:state' && payload.epoch === this.room?.epoch) {
      const player = this.room?.players?.find((candidate) => candidate.id === payload.playerId);
      if (player && payload.sequence > (player.sequence ?? -1)) {
        player.sequence = payload.sequence;
        player.state = payload.state;
      }
    } else if (message.type === 'objective:event' && payload.epoch === this.room?.epoch) {
      if (this.room) {
        this.room.objectives ||= {};
        this.room.objectives[payload.objectiveId] = payload;
        this.room.revision = payload.revision ?? this.room.revision;
      }
    } else if (
      (message.type === 'monster:event' || message.type === 'game:event')
      && payload.epoch === this.room?.epoch
    ) {
      if (this.room) {
        const key = message.type.startsWith('monster') ? 'monster' : 'game';
        this.room[key] = {
          ...(this.room[key] || {}),
          ...(payload.state || {}),
          lastEvent: payload.action,
          updatedAt: payload.updatedAt,
          updatedBy: payload.playerId,
        };
        this.room.revision = payload.revision ?? this.room.revision;
      }
    } else if (message.type === 'world:synced') {
      if (this.room) {
        this.room.seed = payload.seed;
        this.room.level = payload.level;
        this.room.epoch = payload.epoch;
        this.room.hostId = payload.hostId;
        this.room.revision = payload.revision;
        if (payload.reset) {
          this.room.objectives = {};
          this.room.monster = null;
          this.room.game = { phase: 'loading' };
          for (const player of this.room.players || []) {
            player.sequence = -1;
            player.state = null;
          }
          this._sequence = 0;
        }
      }
    }
  }

  async _resumeAfterReconnect() {
    if (this._resuming || !this.roomCode || !this.resumeToken) return;
    this._resuming = true;
    this._setStatus('resuming', { code: this.roomCode });
    try {
      const message = await this._request('room:join', {
        code: this.roomCode,
        name: this.playerName,
        resumeToken: this.resumeToken,
      });
      dispatchDetail(this, 'resumed', message.payload);
    } catch (error) {
      const failedCode = this.roomCode;
      this._forgetRoom();
      this._setStatus('connected');
      dispatchDetail(this, 'reconnect:failed', { error, code: failedCode });
    } finally {
      this._resuming = false;
    }
  }

  async _restoreDirectorySubscription() {
    const limit = this._directorySubscriptionLimit;
    if (limit == null || !this.isConnected) return;
    try {
      await this._request('room:directory:subscribe', { enabled: true, limit });
    } catch (error) {
      dispatchDetail(this, 'room:directory:subscription:error', { error });
    }
  }

  _scheduleReconnect() {
    if (!this.autoReconnect || this._manualClose || this._reconnectTimer) return;
    const attempt = this._reconnectAttempt++;
    const baseDelay = Math.min(this.reconnectMaxDelay, this.reconnectMinDelay * (2 ** attempt));
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    dispatchDetail(this, 'reconnecting', { attempt: attempt + 1, delay });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect().catch(() => this._scheduleReconnect());
    }, delay);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      if (Date.now() - this._lastInboundAt > this.heartbeatInterval * 3) {
        this.socket.close(4000, 'Heartbeat timeout');
        return;
      }
      this._send({
        type: 'heartbeat',
        payload: { clientTime: Date.now() },
      });
    }, this.heartbeatInterval);
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
  }

  _rejectPending(error) {
    for (const pending of this._pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this._pending.clear();
  }

  _forgetRoom() {
    this.room = null;
    this.self = null;
    this.roomCode = null;
    this.resumeToken = null;
    this._sequence = 0;
    if (this.isConnected) this._setStatus('connected');
  }
}

export function createMultiplayerClient(options) {
  return new MultiplayerClient(options);
}
