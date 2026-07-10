const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function normalizeIceUrl(value) {
  const url = String(value || '').trim();
  return /^(stun|turn|turns):/i.test(url) && url.length <= 512 ? url : '';
}

function normalizeIceServer(value) {
  if (typeof value === 'string') {
    const url = normalizeIceUrl(value);
    return url ? { urls: url } : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sourceUrls = Array.isArray(value.urls) ? value.urls : [value.urls];
  const urls = sourceUrls.map(normalizeIceUrl).filter(Boolean).slice(0, 8);
  if (!urls.length) return null;
  const server = { urls: urls.length === 1 ? urls[0] : urls };
  if (typeof value.username === 'string') server.username = value.username.slice(0, 256);
  if (typeof value.credential === 'string') server.credential = value.credential.slice(0, 512);
  return server;
}

export function parseVoiceIceServers(value) {
  if (!value) return [];
  let entries;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    entries = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    entries = String(value).split(',');
  }
  return entries.map(normalizeIceServer).filter(Boolean).slice(0, 8);
}

export const DEFAULT_VOICE_ICE_SERVERS = Object.freeze([
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]);

export function resolveVoiceIceServers(value) {
  const parsed = parseVoiceIceServers(value);
  return parsed.length ? parsed : DEFAULT_VOICE_ICE_SERVERS.map((server) => ({ ...server }));
}

function defaultAudioContext() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) track.stop?.();
}

function playerIdsFrom(players) {
  return new Set(
    (players || [])
      .filter((player) => player?.connected !== false && player?.id)
      .map((player) => String(player.id)),
  );
}

export class VoiceChat {
  constructor(options = {}) {
    this.sendSignal = options.sendSignal || (() => Promise.resolve());
    this.RTCPeerConnectionImpl = options.RTCPeerConnectionImpl
      ?? globalThis.RTCPeerConnection
      ?? null;
    this.mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
    this.AudioContextImpl = options.AudioContextImpl === undefined
      ? defaultAudioContext()
      : options.AudioContextImpl;
    this.document = options.documentImpl ?? globalThis.document ?? null;
    this.MediaStreamImpl = options.MediaStreamImpl ?? globalThis.MediaStream ?? null;
    this.iceServers = resolveVoiceIceServers(options.iceServers);
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});

    this.state = 'off';
    this.enabled = false;
    this.muted = false;
    this.paused = false;
    this.selfId = '';
    this.playerIds = new Set();
    this.remoteReady = new Set();
    this.peers = new Map();
    this.localStream = null;
    this.audioContext = null;
    this.generation = 0;
  }

  get supported() {
    return Boolean(
      this.RTCPeerConnectionImpl
      && this.mediaDevices
      && typeof this.mediaDevices.getUserMedia === 'function',
    );
  }

  get peerCount() {
    return this.peers.size;
  }

  snapshot(error = null) {
    return {
      state: this.state,
      enabled: this.enabled,
      muted: this.muted,
      paused: this.paused,
      supported: this.supported,
      peerCount: this.peerCount,
      error,
    };
  }

  emitState(state = this.state, error = null) {
    this.state = state;
    this.onStateChange(this.snapshot(error));
  }

  bindSession({ selfId, players = [] } = {}) {
    const nextSelfId = String(selfId || '');
    const changedIdentity = nextSelfId !== this.selfId;
    if (changedIdentity) this.closePeers({ announce: false, forgetReady: true });
    this.selfId = nextSelfId;
    this.syncPlayers(players);
    if (changedIdentity && this.enabled) this.announceReady();
  }

  syncPlayers(players = []) {
    const nextIds = playerIdsFrom(players);
    nextIds.delete(this.selfId);
    for (const playerId of this.playerIds) {
      if (!nextIds.has(playerId)) this.removePlayer(playerId);
    }
    for (const playerId of nextIds) this.addPlayer(playerId);
    this.playerIds = nextIds;
  }

  addPlayer(playerId) {
    const id = String(playerId || '');
    if (!id || id === this.selfId) return;
    const isNew = !this.playerIds.has(id);
    this.playerIds.add(id);
    if (isNew && this.enabled) this.signal(id, { type: 'ready' });
  }

  removePlayer(playerId) {
    const id = String(playerId || '');
    this.playerIds.delete(id);
    this.remoteReady.delete(id);
    this.closePeer(id);
  }

  async enable({ muted = false, paused = false } = {}) {
    if (this.enabled && this.localStream) return this.snapshot();
    if (!this.supported) {
      const error = new Error('Voice chat is not supported by this browser.');
      error.code = 'VOICE_UNSUPPORTED';
      this.emitState('unsupported', error);
      throw error;
    }
    if (!this.selfId) {
      const error = new Error('Join a multiplayer room before enabling voice chat.');
      error.code = 'VOICE_ROOM_REQUIRED';
      this.emitState('error', error);
      throw error;
    }

    const generation = ++this.generation;
    this.emitState('requesting');
    const audioContextReady = this.ensureAudioContext({ resume: !paused }).catch(() => null);
    let stream;
    try {
      stream = await this.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
    } catch (error) {
      if (generation !== this.generation) return this.snapshot();
      this.enabled = false;
      this.localStream = null;
      await audioContextReady;
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await Promise.resolve(this.audioContext.close?.()).catch(() => {});
      }
      this.audioContext = null;
      this.emitState('blocked', error);
      throw error;
    }
    if (generation !== this.generation) {
      stopStream(stream);
      return this.snapshot();
    }

    this.localStream = stream;
    this.enabled = true;
    this.muted = Boolean(muted);
    this.paused = Boolean(paused);
    this.setLocalTrackEnabled(!this.muted && !this.paused);
    await audioContextReady;
    if (this.paused) await Promise.resolve(this.audioContext?.suspend?.()).catch(() => {});
    this.emitState(this.paused ? 'paused' : 'live');
    this.announceReady();
    for (const playerId of this.remoteReady) this.maybeOffer(playerId);
    return this.snapshot();
  }

  disable({ announce = true } = {}) {
    ++this.generation;
    if (announce && this.enabled) {
      for (const playerId of this.playerIds) this.signal(playerId, { type: 'hangup' });
    }
    this.enabled = false;
    this.muted = false;
    this.paused = false;
    this.closePeers({ announce: false, forgetReady: false });
    stopStream(this.localStream);
    this.localStream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      Promise.resolve(this.audioContext.close?.()).catch(() => {});
    }
    this.audioContext = null;
    this.emitState('off');
  }

  destroy() {
    this.disable();
    this.playerIds.clear();
    this.remoteReady.clear();
    this.selfId = '';
  }

  setMuted(muted) {
    if (!this.enabled) return false;
    this.muted = Boolean(muted);
    this.setLocalTrackEnabled(!this.muted && !this.paused);
    this.emitState(this.paused ? 'paused' : 'live');
    return this.muted;
  }

  setPaused(paused) {
    if (!this.enabled) return;
    this.paused = Boolean(paused);
    this.setLocalTrackEnabled(!this.muted && !this.paused);
    if (this.paused) Promise.resolve(this.audioContext?.suspend?.()).catch(() => {});
    else Promise.resolve(this.audioContext?.resume?.()).catch(() => {});
    this.emitState(this.paused ? 'paused' : 'live');
  }

  setLocalTrackEnabled(enabled) {
    for (const track of this.localStream?.getAudioTracks?.() || []) track.enabled = Boolean(enabled);
  }

  async ensureAudioContext({ resume = true } = {}) {
    if (!this.AudioContextImpl) return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new this.AudioContextImpl();
    }
    if (resume && this.audioContext.state === 'suspended') await this.audioContext.resume?.();
    return this.audioContext;
  }

  announceReady() {
    if (!this.enabled) return;
    for (const playerId of this.playerIds) this.signal(playerId, { type: 'ready' });
  }

  async signal(playerId, signal) {
    if (!this.selfId || !playerId || playerId === this.selfId) return null;
    try {
      return await this.sendSignal(playerId, signal);
    } catch (error) {
      if (!['VOICE_TARGET_UNAVAILABLE', 'CONNECTION_CLOSED'].includes(error?.code)) this.onError(error);
      return null;
    }
  }

  shouldOffer(playerId) {
    return Boolean(this.selfId && this.selfId.localeCompare(String(playerId)) < 0);
  }

  ensurePeer(playerId) {
    const id = String(playerId || '');
    if (!this.enabled || !id || id === this.selfId || !this.playerIds.has(id)) return null;
    const existing = this.peers.get(id);
    if (existing && existing.connection.connectionState !== 'closed') return existing;

    const connection = new this.RTCPeerConnectionImpl({ iceServers: this.iceServers });
    const peer = {
      id,
      connection,
      candidateQueue: [],
      hasOffered: false,
      negotiating: false,
      mediaSource: null,
      gainNode: null,
      panNode: null,
      audioElement: null,
    };
    this.peers.set(id, peer);
    for (const track of this.localStream?.getAudioTracks?.() || []) {
      connection.addTrack(track, this.localStream);
    }
    connection.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const value = typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate;
      this.signal(id, { type: 'candidate', candidate: value });
    };
    connection.ontrack = (event) => this.attachRemoteStream(peer, event);
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed') {
        const error = new Error('Voice peer connection failed. STUN/TURN may be required on this network.');
        error.code = 'VOICE_ICE_FAILED';
        this.onError(error);
        this.closePeer(id);
        if (this.enabled && this.remoteReady.has(id)) this.signal(id, { type: 'ready' });
      }
      this.emitState(this.paused ? 'paused' : this.enabled ? 'live' : 'off');
    };
    return peer;
  }

  async maybeOffer(playerId) {
    const id = String(playerId || '');
    if (!this.enabled || !this.remoteReady.has(id) || !this.shouldOffer(id)) return;
    const peer = this.ensurePeer(id);
    if (!peer || peer.negotiating || peer.hasOffered || peer.connection.signalingState !== 'stable') return;
    peer.negotiating = true;
    peer.hasOffered = true;
    try {
      const offer = await peer.connection.createOffer({ offerToReceiveAudio: true });
      await peer.connection.setLocalDescription(offer);
      const local = peer.connection.localDescription || offer;
      await this.signal(id, { type: 'offer', sdp: local.sdp });
    } catch (error) {
      peer.hasOffered = false;
      this.onError(error);
    } finally {
      peer.negotiating = false;
    }
  }

  async handleSignal(payload = {}) {
    const playerId = String(payload.fromPlayerId || '');
    const signal = payload.signal || {};
    if (!playerId || playerId === this.selfId || !this.playerIds.has(playerId)) return false;
    if (signal.type === 'ready') {
      this.remoteReady.add(playerId);
      if (this.enabled) await this.maybeOffer(playerId);
      return true;
    }
    if (signal.type === 'hangup') {
      this.remoteReady.delete(playerId);
      this.closePeer(playerId);
      return true;
    }
    if (!this.enabled) return false;

    const peer = this.ensurePeer(playerId);
    if (!peer) return false;
    try {
      if (signal.type === 'offer') {
        await peer.connection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        await this.flushCandidates(peer);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        const local = peer.connection.localDescription || answer;
        await this.signal(playerId, { type: 'answer', sdp: local.sdp });
      } else if (signal.type === 'answer') {
        await peer.connection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.flushCandidates(peer);
      } else if (signal.type === 'candidate') {
        const candidate = {
          candidate: signal.candidate,
          sdpMid: signal.sdpMid ?? null,
          sdpMLineIndex: signal.sdpMLineIndex ?? null,
          usernameFragment: signal.usernameFragment ?? null,
        };
        if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(candidate);
        else peer.candidateQueue.push(candidate);
      } else return false;
      return true;
    } catch (error) {
      this.onError(error);
      return false;
    }
  }

  async flushCandidates(peer) {
    while (peer.candidateQueue.length) {
      await peer.connection.addIceCandidate(peer.candidateQueue.shift());
    }
  }

  async attachRemoteStream(peer, event) {
    let stream = event.streams?.[0];
    if (!stream && event.track && this.MediaStreamImpl) stream = new this.MediaStreamImpl([event.track]);
    if (!stream) return;
    const context = await this.ensureAudioContext({ resume: !this.paused }).catch(() => null);
    if (context?.createMediaStreamSource) {
      try {
        peer.mediaSource = context.createMediaStreamSource(stream);
        peer.gainNode = context.createGain();
        peer.gainNode.gain.value = 0.92;
        if (context.createStereoPanner) {
          peer.panNode = context.createStereoPanner();
          peer.mediaSource.connect(peer.gainNode).connect(peer.panNode).connect(context.destination);
        } else peer.mediaSource.connect(peer.gainNode).connect(context.destination);
        return;
      } catch (error) {
        this.onError(error);
      }
    }
    if (!this.document) return;
    const audio = this.document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = stream;
    audio.dataset.voicePeer = peer.id;
    audio.style.display = 'none';
    this.document.body?.append(audio);
    peer.audioElement = audio;
    Promise.resolve(audio.play?.()).catch(() => {});
  }

  setPeerSpatialState(playerId, { distance = 0, pan = 0 } = {}) {
    const peer = this.peers.get(String(playerId || ''));
    if (!peer) return;
    const attenuation = clamp(1 - Math.max(0, Number(distance) - 3) / 55, 0.18, 1) * 0.92;
    const stereo = clamp(Number(pan) || 0, -0.85, 0.85);
    const context = this.audioContext;
    if (peer.gainNode && context) {
      peer.gainNode.gain.setTargetAtTime(attenuation, context.currentTime, 0.08);
    }
    if (peer.panNode && context) peer.panNode.pan.setTargetAtTime(stereo, context.currentTime, 0.08);
    if (peer.audioElement) peer.audioElement.volume = attenuation;
  }

  closePeer(playerId) {
    const id = String(playerId || '');
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close?.();
    peer.mediaSource?.disconnect?.();
    peer.gainNode?.disconnect?.();
    peer.panNode?.disconnect?.();
    if (peer.audioElement) {
      peer.audioElement.pause?.();
      peer.audioElement.srcObject = null;
      peer.audioElement.remove?.();
    }
    this.peers.delete(id);
  }

  closePeers({ announce = false, forgetReady = false } = {}) {
    if (announce && this.enabled) {
      for (const playerId of this.peers.keys()) this.signal(playerId, { type: 'hangup' });
    }
    for (const playerId of [...this.peers.keys()]) this.closePeer(playerId);
    if (forgetReady) this.remoteReady.clear();
  }
}

export function createVoiceChat(options) {
  return new VoiceChat(options);
}
