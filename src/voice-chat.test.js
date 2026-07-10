import assert from 'node:assert/strict';
import test from 'node:test';
import { VoiceChat, parseVoiceIceServers, resolveVoiceIceServers, DEFAULT_VOICE_ICE_SERVERS } from './voice-chat.js';

class FakeTrack {
  constructor() {
    this.enabled = true;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(track = new FakeTrack()) {
    this.track = track;
  }

  getTracks() {
    return [this.track];
  }

  getAudioTracks() {
    return [this.track];
  }
}

class FakePeerConnection {
  static instances = [];

  constructor(config) {
    this.config = config;
    this.connectionState = 'new';
    this.signalingState = 'stable';
    this.remoteDescription = null;
    this.localDescription = null;
    this.candidates = [];
    this.tracks = [];
    FakePeerConnection.instances.push(this);
  }

  addTrack(track, stream) {
    this.tracks.push({ track, stream });
  }

  async createOffer() {
    return { type: 'offer', sdp: 'test-offer' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'test-answer' };
  }

  async setLocalDescription(description) {
    this.localDescription = description;
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }

  async addIceCandidate(candidate) {
    this.candidates.push(candidate);
  }

  close() {
    this.connectionState = 'closed';
  }
}

test('ICE server parsing accepts configured STUN/TURN and rejects other URLs', () => {
  assert.deepEqual(
    parseVoiceIceServers('["stun:stun.example.test:3478",{"urls":"turns:turn.example.test","username":"u","credential":"p"}]'),
    [
      { urls: 'stun:stun.example.test:3478' },
      { urls: 'turns:turn.example.test', username: 'u', credential: 'p' },
    ],
  );
  assert.deepEqual(parseVoiceIceServers('https://example.test,stun:valid.test'), [
    { urls: 'stun:valid.test' },
  ]);
});

test('empty ICE config falls back to public STUN defaults', () => {
  assert.deepEqual(parseVoiceIceServers([]), []);
  assert.deepEqual(resolveVoiceIceServers([]), [...DEFAULT_VOICE_ICE_SERVERS]);
  assert.deepEqual(resolveVoiceIceServers(''), [...DEFAULT_VOICE_ICE_SERVERS]);
  assert.deepEqual(
    resolveVoiceIceServers('["stun:stun.example.test:3478"]'),
    [{ urls: 'stun:stun.example.test:3478' }],
  );
  const voice = new VoiceChat({
    RTCPeerConnectionImpl: FakePeerConnection,
    AudioContextImpl: null,
    mediaDevices: { getUserMedia: async () => new FakeStream() },
    iceServers: [],
  });
  assert.deepEqual(voice.iceServers, [...DEFAULT_VOICE_ICE_SERVERS]);
});

test('voice restore applies mute and hidden-tab pause before announcing readiness', async () => {
  const track = new FakeTrack();
  const signals = [];
  const voice = new VoiceChat({
    RTCPeerConnectionImpl: FakePeerConnection,
    AudioContextImpl: null,
    mediaDevices: { getUserMedia: async () => new FakeStream(track) },
    sendSignal: async (playerId, signal) => signals.push({ playerId, signal }),
  });

  voice.bindSession({ selfId: 'A', players: [{ id: 'A' }, { id: 'B' }] });
  await voice.enable({ muted: true, paused: true });
  assert.equal(voice.enabled, true);
  assert.equal(voice.muted, true);
  assert.equal(voice.paused, true);
  assert.equal(voice.state, 'paused');
  assert.equal(track.enabled, false);
  assert.deepEqual(signals, [{ playerId: 'B', signal: { type: 'ready' } }]);

  voice.setPaused(false);
  assert.equal(track.enabled, false, 'leaving the hidden state must preserve the mute preference');
  voice.setMuted(false);
  assert.equal(track.enabled, true);
  voice.disable();
});

test('voice chat is opt-in, negotiates deterministically, mutes, and releases the microphone', async () => {
  FakePeerConnection.instances = [];
  const track = new FakeTrack();
  const stream = new FakeStream(track);
  let mediaRequests = 0;
  const signals = [];
  const states = [];
  const voice = new VoiceChat({
    RTCPeerConnectionImpl: FakePeerConnection,
    AudioContextImpl: null,
    mediaDevices: {
      async getUserMedia(constraints) {
        mediaRequests += 1;
        assert.equal(constraints.video, false);
        assert.equal(constraints.audio.echoCancellation, true);
        return stream;
      },
    },
    sendSignal: async (playerId, signal) => signals.push({ playerId, signal }),
    onStateChange: (state) => states.push(state.state),
  });

  voice.bindSession({ selfId: 'A', players: [{ id: 'A' }, { id: 'B' }] });
  assert.equal(mediaRequests, 0, 'binding a room must not request microphone permission');
  await voice.enable();
  assert.equal(mediaRequests, 1);
  assert.equal(voice.state, 'live');
  assert.deepEqual(signals.shift(), { playerId: 'B', signal: { type: 'ready' } });

  await voice.handleSignal({ fromPlayerId: 'B', signal: { type: 'ready' } });
  assert.equal(FakePeerConnection.instances.length, 1);
  assert.equal(FakePeerConnection.instances[0].tracks[0].track, track);
  assert.deepEqual(signals.shift(), {
    playerId: 'B',
    signal: { type: 'offer', sdp: 'test-offer' },
  });

  await voice.handleSignal({ fromPlayerId: 'B', signal: {
    type: 'candidate',
    candidate: 'candidate:test',
    sdpMid: 'audio',
    sdpMLineIndex: 0,
  } });
  assert.equal(FakePeerConnection.instances[0].candidates.length, 0, 'early ICE is queued');
  await voice.handleSignal({ fromPlayerId: 'B', signal: { type: 'answer', sdp: 'test-answer' } });
  assert.equal(FakePeerConnection.instances[0].candidates.length, 1);

  voice.setMuted(true);
  assert.equal(track.enabled, false);
  voice.setMuted(false);
  assert.equal(track.enabled, true);
  voice.setPaused(true);
  assert.equal(track.enabled, false);
  voice.setPaused(false);
  assert.equal(track.enabled, true);

  voice.disable();
  assert.equal(track.stopped, true);
  assert.equal(FakePeerConnection.instances[0].connectionState, 'closed');
  assert.equal(signals.some(({ signal }) => signal.type === 'hangup'), true);
  assert.equal(states.includes('requesting'), true);
  assert.equal(states.at(-1), 'off');
});

test('voice chat surfaces microphone denial and remains off', async () => {
  const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
  const voice = new VoiceChat({
    RTCPeerConnectionImpl: FakePeerConnection,
    AudioContextImpl: null,
    mediaDevices: { getUserMedia: async () => { throw denied; } },
  });
  voice.bindSession({ selfId: 'A', players: [{ id: 'A' }] });
  await assert.rejects(voice.enable(), (error) => error === denied);
  assert.equal(voice.state, 'blocked');
  assert.equal(voice.enabled, false);
});

test('leaving during a microphone prompt stops a late-granted stream', async () => {
  const track = new FakeTrack();
  const stream = new FakeStream(track);
  const signals = [];
  let resolveMedia;
  const voice = new VoiceChat({
    RTCPeerConnectionImpl: FakePeerConnection,
    AudioContextImpl: null,
    mediaDevices: {
      getUserMedia: () => new Promise((resolve) => { resolveMedia = resolve; }),
    },
    sendSignal: async (playerId, signal) => signals.push({ playerId, signal }),
  });
  voice.bindSession({ selfId: 'A', players: [{ id: 'A' }, { id: 'B' }] });
  const enabling = voice.enable();
  assert.equal(voice.state, 'requesting');
  voice.disable({ announce: false });
  resolveMedia(stream);
  await enabling;
  assert.equal(track.stopped, true);
  assert.equal(voice.enabled, false);
  assert.equal(voice.state, 'off');
  assert.deepEqual(signals, []);
});
