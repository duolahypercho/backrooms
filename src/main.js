import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { LEVELS, getLevelIndex } from './levels.js';
import { animateMonster, buildMonster } from './monster.js';
import './style.css';

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRECTIONS = [
  { bit: N, opposite: S, dc: 0, dr: -1 },
  { bit: E, opposite: W, dc: 1, dr: 0 },
  { bit: S, opposite: N, dc: 0, dr: 1 },
  { bit: W, opposite: E, dc: -1, dr: 0 },
];

const CELL_SIZE = 4;
const WALL_HEIGHT = 3.05;
const WALL_THICKNESS = 0.17;
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.31;

const dom = {
  game: document.querySelector('#game'),
  viewport: document.querySelector('#viewport'),
  overlay: document.querySelector('#overlay'),
  classification: document.querySelector('#classification'),
  overlayKicker: document.querySelector('#overlay-kicker'),
  overlayTitle: document.querySelector('#overlay-title'),
  overlayBody: document.querySelector('#overlay-body'),
  enterButton: document.querySelector('#enter-button'),
  enterLabel: document.querySelector('#enter-label'),
  controlsCopy: document.querySelector('#controls-copy'),
  status: document.querySelector('#status'),
  levelLabel: document.querySelector('#level-label'),
  objective: document.querySelector('#objective'),
  soundToggle: document.querySelector('#sound-toggle'),
  interact: document.querySelector('#interact'),
  message: document.querySelector('#message'),
  stamina: document.querySelector('#stamina'),
  staminaFill: document.querySelector('#stamina span'),
  threat: document.querySelector('#threat'),
  grain: document.querySelector('#grain'),
  touchUi: document.querySelector('#touch-ui'),
  movePad: document.querySelector('#move-pad'),
  moveStick: document.querySelector('#move-stick'),
  touchLook: document.querySelector('#touch-look'),
  touchSprint: document.querySelector('#touch-sprint'),
  touchAction: document.querySelector('#touch-action'),
  unsupported: document.querySelector('#unsupported'),
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const rgbInt = ([red, green, blue]) => (red << 16) | (green << 8) | blue;
const randomBetween = ([minimum, maximum], random) => minimum + random() * (maximum - minimum);

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

class Maze {
  constructor(cols, rows, seed, options = {}) {
    this.cols = cols;
    this.rows = rows;
    this.seed = seed;
    this.options = options;
    this.random = mulberry32(seed);
    this.cells = new Uint8Array(cols * rows);
    this.cells.fill(N | E | S | W);
    this.generate();
  }

  index(col, row) {
    return row * this.cols + col;
  }

  coords(index) {
    return { col: index % this.cols, row: Math.floor(index / this.cols) };
  }

  valid(col, row) {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  generate() {
    const visited = new Uint8Array(this.cells.length);
    const start = this.index(Math.floor(this.cols / 2), Math.floor(this.rows / 2));
    const stack = [start];
    visited[start] = 1;

    while (stack.length) {
      const current = stack[stack.length - 1];
      const { col, row } = this.coords(current);
      const choices = [];

      for (const direction of DIRECTIONS) {
        const nextCol = col + direction.dc;
        const nextRow = row + direction.dr;
        if (!this.valid(nextCol, nextRow)) continue;
        const next = this.index(nextCol, nextRow);
        if (!visited[next]) choices.push({ direction, next });
      }

      if (!choices.length) {
        stack.pop();
        continue;
      }

      const choice = choices[Math.floor(this.random() * choices.length)];
      this.cells[current] &= ~choice.direction.bit;
      this.cells[choice.next] &= ~choice.direction.opposite;
      visited[choice.next] = 1;
      stack.push(choice.next);
    }

    const extraOpenings = Math.floor(this.cells.length * (this.options.loopRatio ?? 0.19));
    for (let i = 0; i < extraOpenings; i += 1) {
      const col = Math.floor(this.random() * this.cols);
      const row = Math.floor(this.random() * this.rows);
      const internalDirections = DIRECTIONS.filter((direction) =>
        this.valid(col + direction.dc, row + direction.dr),
      );
      const direction = internalDirections[Math.floor(this.random() * internalDirections.length)];
      this.removeWall(col, row, direction);
    }

    const roomCount = Math.max(
      this.options.minRooms ?? 8,
      Math.floor(this.cells.length / (this.options.roomDivisor ?? 54)),
    );
    for (let i = 0; i < roomCount; i += 1) {
      const width = 2 + Math.floor(this.random() * 3);
      const height = 2 + Math.floor(this.random() * 3);
      const originCol = 1 + Math.floor(this.random() * (this.cols - width - 2));
      const originRow = 1 + Math.floor(this.random() * (this.rows - height - 2));

      for (let row = originRow; row < originRow + height; row += 1) {
        for (let col = originCol; col < originCol + width; col += 1) {
          if (col < originCol + width - 1) this.removeWall(col, row, DIRECTIONS[1]);
          if (row < originRow + height - 1) this.removeWall(col, row, DIRECTIONS[2]);
        }
      }
    }
  }

  removeWall(col, row, direction) {
    const nextCol = col + direction.dc;
    const nextRow = row + direction.dr;
    if (!this.valid(col, row) || !this.valid(nextCol, nextRow)) return;
    const current = this.index(col, row);
    const next = this.index(nextCol, nextRow);
    this.cells[current] &= ~direction.bit;
    this.cells[next] &= ~direction.opposite;
  }

  hasWall(index, bit) {
    return Boolean(this.cells[index] & bit);
  }

  neighbors(index) {
    const { col, row } = this.coords(index);
    const result = [];
    for (const direction of DIRECTIONS) {
      if (this.hasWall(index, direction.bit)) continue;
      const nextCol = col + direction.dc;
      const nextRow = row + direction.dr;
      if (this.valid(nextCol, nextRow)) result.push(this.index(nextCol, nextRow));
    }
    return result;
  }

  distanceMap(startIndex) {
    const distances = new Int16Array(this.cells.length);
    distances.fill(-1);
    const queue = [startIndex];
    distances[startIndex] = 0;
    let cursor = 0;

    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const next of this.neighbors(current)) {
        if (distances[next] !== -1) continue;
        distances[next] = distances[current] + 1;
        queue.push(next);
      }
    }
    return distances;
  }

  farthestFrom(startIndex) {
    const distances = this.distanceMap(startIndex);
    let farthest = startIndex;
    for (let i = 0; i < distances.length; i += 1) {
      if (distances[i] > distances[farthest]) farthest = i;
    }
    return farthest;
  }

  shortestPath(startIndex, targetIndex) {
    if (startIndex === targetIndex) return [startIndex];
    const previous = new Int32Array(this.cells.length);
    previous.fill(-1);
    const queue = [startIndex];
    previous[startIndex] = startIndex;
    let cursor = 0;

    while (cursor < queue.length) {
      const current = queue[cursor++];
      if (current === targetIndex) break;
      for (const next of this.neighbors(current)) {
        if (previous[next] !== -1) continue;
        previous[next] = current;
        queue.push(next);
      }
    }

    if (previous[targetIndex] === -1) return [];
    const path = [];
    let current = targetIndex;
    while (current !== startIndex) {
      path.push(current);
      current = previous[current];
    }
    path.push(startIndex);
    return path.reverse();
  }

  cellToWorld(index) {
    const { col, row } = this.coords(index);
    return new THREE.Vector3(
      (col - (this.cols - 1) / 2) * CELL_SIZE,
      0,
      (row - (this.rows - 1) / 2) * CELL_SIZE,
    );
  }

  worldToCell(x, z) {
    const col = clamp(Math.round(x / CELL_SIZE + (this.cols - 1) / 2), 0, this.cols - 1);
    const row = clamp(Math.round(z / CELL_SIZE + (this.rows - 1) / 2), 0, this.rows - 1);
    return this.index(col, row);
  }

  wallSegments() {
    const segments = [];
    const half = CELL_SIZE / 2;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const index = this.index(col, row);
        const center = this.cellToWorld(index);
        if (this.hasWall(index, N)) {
          segments.push({ x: center.x, z: center.z - half, horizontal: true });
        }
        if (this.hasWall(index, W)) {
          segments.push({ x: center.x - half, z: center.z, horizontal: false });
        }
        if (row === this.rows - 1 && this.hasWall(index, S)) {
          segments.push({ x: center.x, z: center.z + half, horizontal: true });
        }
        if (col === this.cols - 1 && this.hasWall(index, E)) {
          segments.push({ x: center.x + half, z: center.z, horizontal: false });
        }
      }
    }
    return segments;
  }

  randomCellAtDistance(originIndex, minDistance, maxDistance, random = Math.random) {
    const distances = this.distanceMap(originIndex);
    const options = [];
    for (let i = 0; i < distances.length; i += 1) {
      if (distances[i] >= minDistance && distances[i] <= maxDistance) options.push(i);
    }
    if (!options.length) return this.farthestFrom(originIndex);
    return options[Math.floor(random() * options.length)];
  }
}

class AudioEngine {
  constructor(profile = {}) {
    this.profile = profile;
    this.context = null;
    this.master = null;
    this.hum = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.dipUntil = 0;
    this.nextBeat = 0;
    this.nextThreatSound = 0;
    this.nextAmbientSound = 0;
  }

  async start() {
    if (this.context) {
      if (this.context.state !== 'running') await this.context.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : (this.profile.masterGain ?? 0.72);
    this.master.connect(this.context.destination);

    this.hum = this.context.createGain();
    this.hum.gain.value = this.profile.humGain ?? 0.055;
    this.hum.connect(this.master);

    const oscillators = this.profile.oscillators || [
      { frequency: 60, type: 'sine', gain: 0.22 },
      { frequency: 120, type: 'triangle', gain: 0.065 },
      { frequency: 180, type: 'sine', gain: 0.025 },
      { frequency: 31, type: 'sine', gain: 0.09 },
    ];

    for (const config of oscillators) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = config.type;
      oscillator.frequency.value = config.frequency;
      oscillator.detune.value = (Math.random() - 0.5) * 5;
      gain.gain.value = config.gain;
      oscillator.connect(gain).connect(this.hum);
      oscillator.start();
    }

    this.noiseBuffer = this.createNoiseBuffer(2.4);
    const noise = this.context.createBufferSource();
    const bandpass = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    bandpass.type = this.profile.noise?.filter || 'bandpass';
    bandpass.frequency.value = this.profile.noise?.frequency || 580;
    bandpass.Q.value = this.profile.noise?.q ?? 0.46;
    noiseGain.gain.value = this.profile.noise?.gain ?? 0.025;
    noise.connect(bandpass).connect(noiseGain).connect(this.hum);
    noise.start();
  }

  createNoiseBuffer(duration) {
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      channel[i] = last;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(muted ? 0 : (this.profile.masterGain ?? 0.72), this.context.currentTime, 0.025);
  }

  suspend() {
    if (this.context?.state === 'running') this.context.suspend();
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume();
  }

  update(tension, elapsed, threat = null) {
    if (!this.context || !this.hum) return;
    const now = this.context.currentTime;
    const dipped = elapsed < this.dipUntil;
    const baseHum = this.profile.humGain ?? 0.055;
    const target = dipped ? 0.004 : baseHum - 0.003 + tension * 0.016 + Math.sin(elapsed * 0.81) * 0.0025;
    this.hum.gain.setTargetAtTime(target, now, dipped ? 0.03 : 0.18);

    if (tension > 0.56 && now > this.nextBeat) {
      this.heartbeat(0.15 + tension * 0.24);
      this.nextBeat = now + lerp(1.25, 0.54, tension);
    }

    if (threat && threat.distance < 19 && now > this.nextThreatSound) {
      this.monsterBreath(threat.pan, threat.distance, threat.mode === 'chase');
      this.nextThreatSound = now + (threat.mode === 'chase' ? 1.2 : 2.4) + Math.random() * 0.8;
    }

    if (this.profile.drips && now > this.nextAmbientSound) {
      this.drip(Math.random() * 2 - 1);
      this.nextAmbientSound = now + 3 + Math.random() * 7;
    }
  }

  powerDip(elapsed, duration = 1.1) {
    this.dipUntil = Math.max(this.dipUntil, elapsed + duration);
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.16);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  }

  footstep(running = false) {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = running ? 1.28 : 0.92 + Math.random() * 0.14;
    filter.type = 'lowpass';
    filter.frequency.value = running
      ? (this.profile.footstep?.runLowpass || 310)
      : (this.profile.footstep?.walkLowpass || 240);
    filter.Q.value = 0.9;
    gain.gain.setValueAtTime(running ? 0.18 : 0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (running ? 0.11 : 0.15));
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now, Math.random() * 1.6, 0.18);
    source.stop(now + 0.2);
  }

  scare(pan = 0) {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.22 + Math.random() * 0.14;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(170, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 1.15);
    filter.Q.value = 3.4;
    panner.pan.value = clamp(pan, -1, 1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    source.connect(filter).connect(panner).connect(gain).connect(this.master);
    source.start(now, Math.random() * 0.8, 1.6);
    source.stop(now + 1.65);
  }

  heartbeat(gainValue) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const offset of [0, 0.16]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(this.profile.heartbeat?.startFrequency || 64, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(this.profile.heartbeat?.endFrequency || 36, now + offset + 0.12);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.18);
    }
  }

  impact() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(this.profile.impact?.startFrequency || 51, now);
    oscillator.frequency.exponentialRampToValueAtTime(this.profile.impact?.endFrequency || 19, now + 0.75);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.95);
  }

  monsterStep(pan, distance, running = false) {
    if (!this.context || !this.noiseBuffer || distance > 22) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    const proximity = clamp(1 - distance / 22, 0, 1);
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = running ? 0.54 : 0.39;
    filter.type = 'lowpass';
    filter.frequency.value = running ? 155 : 112;
    panner.pan.value = clamp(pan, -1, 1);
    gain.gain.setValueAtTime(0.2 * proximity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    source.connect(filter).connect(panner).connect(gain).connect(this.master);
    source.start(now, Math.random() * 1.4, 0.3);
    source.stop(now + 0.32);
  }

  monsterBreath(pan, distance, chasing) {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    const proximity = clamp(1 - distance / 20, 0, 1);
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = chasing ? 0.2 : 0.14;
    filter.type = 'bandpass';
    filter.frequency.value = chasing ? 145 : 92;
    filter.Q.value = 1.4;
    panner.pan.value = clamp(pan, -1, 1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime((chasing ? 0.2 : 0.12) * proximity, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    source.connect(filter).connect(panner).connect(gain).connect(this.master);
    source.start(now, Math.random() * 0.8, 1.1);
    source.stop(now + 1.12);
  }

  objectiveComplete() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const [index, frequency] of [196, 247, 330].entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.055, now + index * 0.08 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.42);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + index * 0.08 + 0.45);
    }
  }

  drip(pan) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const panner = this.context.createStereoPanner();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1160 + Math.random() * 500, now);
    oscillator.frequency.exponentialRampToValueAtTime(310, now + 0.09);
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(panner).connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }
}

function buildTexture(kind, size, repeatX, repeatY, anisotropy, profile = {}) {
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const colorContext = colorCanvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');
  const colorImage = colorContext.createImageData(size, size);
  const bumpImage = bumpContext.createImageData(size, size);
  const pattern = profile.pattern || (kind === 'wall' ? 'wallpaper' : kind === 'floor' ? 'carpet' : 'tile');
  const defaults = kind === 'wall' ? [183, 174, 91] : kind === 'floor' ? [92, 83, 48] : [178, 176, 148];
  const base = profile.base || defaults;
  const patternSeed = Array.from(pattern).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const random = mulberry32(kind.charCodeAt(0) * 991 + size + patternSeed * 17);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const noise = random() * 2 - 1;
      let r;
      let g;
      let b;
      let height;

      if (kind === 'wall') {
        const bottomGrime = Math.pow(y / size, 4) * (profile.bottomGrime ?? 17);
        if (pattern.includes('concrete') && !pattern.includes('seeping')) {
          const seam = x < 3 || y < 3 ? -16 : 0;
          const pore = random() > 0.987 ? -34 : 0;
          const cloud = Math.sin(x * 0.021) * Math.sin(y * 0.017) * 5;
          r = base[0] + cloud + noise * 11 + seam + pore - bottomGrime;
          g = base[1] + cloud + noise * 10 + seam + pore - bottomGrime;
          b = base[2] + cloud * 0.7 + noise * 9 + seam + pore - bottomGrime;
          height = 126 + noise * 28 + seam * 1.5 + pore;
        } else if (pattern.includes('seeping') || pattern.includes('runoff')) {
          const drip = Math.max(0, Math.sin(x * 0.083) + Math.sin(x * 0.029 + 1.8)) * (y / size) * 8;
          const mineral = Math.sin(y * 0.12 + x * 0.014) * 3;
          r = base[0] + noise * 9 - drip + mineral - bottomGrime;
          g = base[1] + noise * 10 - drip * 0.65 + mineral - bottomGrime;
          b = base[2] + noise * 8 - drip * 0.38 + mineral * 0.5 - bottomGrime;
          height = 122 + noise * 22 + drip * 2;
        } else {
          const stripe = Math.sin((x / size) * Math.PI * 20) * 3.8;
          const fiber = Math.sin((y / size) * Math.PI * 170) * 1.1;
          r = base[0] + stripe + fiber + noise * 8 - bottomGrime;
          g = base[1] + stripe * 0.72 + noise * 7 - bottomGrime;
          b = base[2] + stripe * 0.3 + noise * 5 - bottomGrime * 0.42;
          height = 128 + stripe * 2 + noise * 18;
        }
      } else if (kind === 'floor') {
        if (pattern.includes('oil') || pattern === 'tile') {
          const gridX = x % 64 < 4;
          const gridY = y % 64 < 4;
          const grout = gridX || gridY ? -28 : 0;
          const wear = Math.sin(x * 0.031) * Math.sin(y * 0.023) * 5;
          r = base[0] + wear + noise * 10 + grout;
          g = base[1] + wear + noise * 9 + grout;
          b = base[2] + wear * 0.6 + noise * 8 + grout;
          height = 132 + noise * 16 + grout * 1.8;
        } else if (pattern.includes('flooded') || pattern === 'wet') {
          const ripple = Math.sin(x * 0.045 + Math.sin(y * 0.018)) * 3;
          const stain = Math.sin(x * 0.019) * Math.sin(y * 0.027) * 9;
          r = base[0] + ripple + stain + noise * 12;
          g = base[1] + ripple + stain + noise * 13;
          b = base[2] + ripple + stain * 0.7 + noise * 11;
          height = 126 + ripple * 3 + noise * 15;
        } else {
          const fibers = Math.sin((x + y * 0.28) * 1.7) * 4;
          const stain = Math.sin(x * 0.037) * Math.sin(y * 0.031) * 6;
          r = base[0] + fibers + stain + noise * 18;
          g = base[1] + fibers * 0.75 + stain + noise * 15;
          b = base[2] + stain * 0.35 + noise * 10;
          height = 118 + fibers * 2 + noise * 30;
        }
      } else {
        const corrugated = pattern === 'corrugated' || pattern.includes('service');
        const edgeSize = corrugated ? 8 : 4;
        const tileEdge = x < edgeSize || y < edgeSize || x > size - edgeSize - 1 || y > size - edgeSize - 1 ? -23 : 0;
        const corrugation = corrugated ? Math.sin(x * 0.16) * 9 : 0;
        const speckle = random() > 0.985 ? -28 : 0;
        r = base[0] + noise * 8 + tileEdge + speckle + corrugation;
        g = base[1] + noise * 7 + tileEdge + speckle + corrugation;
        b = base[2] + noise * 6 + tileEdge + speckle + corrugation * 0.7;
        height = 142 + noise * 13 + tileEdge * 2 + corrugation * 2;
      }

      colorImage.data[index] = clamp(r, 0, 255);
      colorImage.data[index + 1] = clamp(g, 0, 255);
      colorImage.data[index + 2] = clamp(b, 0, 255);
      colorImage.data[index + 3] = 255;
      bumpImage.data[index] = clamp(height, 0, 255);
      bumpImage.data[index + 1] = clamp(height, 0, 255);
      bumpImage.data[index + 2] = clamp(height, 0, 255);
      bumpImage.data[index + 3] = 255;
    }
  }

  colorContext.putImageData(colorImage, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = anisotropy;
  }
  return { map, bumpMap };
}

function buildObjectiveModel(type, color) {
  const group = new THREE.Group();
  const casingMaterial = new THREE.MeshStandardMaterial({ color: 0x282c28, roughness: 0.68, metalness: 0.34 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x5b6158, roughness: 0.74, metalness: 0.22 });
  const controlMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.2 });
  const indicatorMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f160f,
    emissive: 0x7d160e,
    emissiveIntensity: 1.2,
    roughness: 0.38,
  });

  let control;
  if (type === 'valve') {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 14), casingMaterial);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = -0.03;
    group.add(pipe);
    control = new THREE.Group();
    control.position.z = 0.26;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 9, 24), controlMaterial);
    control.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 12), casingMaterial);
    hub.rotation.x = Math.PI / 2;
    control.add(hub);
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.035), controlMaterial);
      spoke.rotation.z = i * Math.PI / 4;
      control.add(spoke);
    }
    group.add(control);
  } else {
    const casing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.18), casingMaterial);
    group.add(casing);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.07), faceMaterial);
    face.position.z = 0.125;
    group.add(face);
    control = new THREE.Group();
    control.position.set(0, -0.02, 0.2);
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.38, 12), controlMaterial);
    fuse.rotation.z = Math.PI / 2;
    control.add(fuse);
    for (const x of [-0.22, 0.22]) {
      const clampMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), casingMaterial);
      clampMesh.position.x = x;
      control.add(clampMesh);
    }
    group.add(control);
  }

  const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.05), indicatorMaterial);
  indicator.position.set(type === 'valve' ? 0.38 : 0.19, type === 'valve' ? 0.24 : 0.27, 0.21);
  group.add(indicator);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.userData.control = control;
  group.userData.indicator = indicator;
  group.userData.activationProgress = 0;
  group.userData.type = type;
  return group;
}

function buildEnvironmentProps(level, maze, random, mobile) {
  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (const definition of level.props) {
    const count = Math.max(1, Math.floor(maze.cells.length * definition.density * (mobile ? 0.55 : 1)));
    let geometry;
    let material;

    if (definition.type === 'wall-pipe' || definition.type === 'hanging-chain') {
      geometry = new THREE.CylinderGeometry(
        definition.type === 'hanging-chain' ? 0.018 : 0.055,
        definition.type === 'hanging-chain' ? 0.018 : 0.055,
        definition.type === 'hanging-chain' ? 1.6 : 2.8,
        8,
      );
      material = new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.68, metalness: 0.42 });
    } else if (definition.type === 'standing-water') {
      geometry = new THREE.CircleGeometry(1, 20);
      material = new THREE.MeshPhysicalMaterial({
        color: definition.color,
        roughness: 0.18,
        metalness: 0.04,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        clearcoat: 0.72,
      });
    } else if (definition.type === 'ceiling-vent' || definition.type === 'cable-tray' || definition.type === 'drain-grate') {
      geometry = new THREE.BoxGeometry(1, 0.045, definition.type === 'cable-tray' ? 0.24 : 0.72);
      material = new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.74, metalness: 0.32 });
    } else continue;

    const instances = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i += 1) {
      const cell = maze.cellToWorld(Math.floor(random() * maze.cells.length));
      if (definition.type === 'wall-pipe') {
        position.set(cell.x + (random() - 0.5) * 1.5, WALL_HEIGHT - 0.42, cell.z + (random() - 0.5) * 1.5);
        quaternion.setFromEuler(new THREE.Euler(random() > 0.5 ? Math.PI / 2 : 0, 0, random() > 0.5 ? Math.PI / 2 : 0));
      } else if (definition.type === 'hanging-chain') {
        position.set(cell.x + (random() - 0.5) * 1.6, WALL_HEIGHT - 0.8, cell.z + (random() - 0.5) * 1.6);
        quaternion.identity();
      } else if (definition.type === 'standing-water') {
        position.set(cell.x + (random() - 0.5), 0.018, cell.z + (random() - 0.5));
        quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        const puddleScale = 0.35 + random() * 1.15;
        scale.set(puddleScale, puddleScale * (0.55 + random() * 0.35), 1);
      } else if (definition.type === 'drain-grate') {
        position.set(cell.x + (random() - 0.5) * 1.5, 0.025, cell.z + (random() - 0.5) * 1.5);
        quaternion.identity();
        scale.set(0.68, 1, 0.68);
      } else {
        position.set(cell.x + (random() - 0.5), WALL_HEIGHT - 0.08, cell.z + (random() - 0.5));
        quaternion.identity();
        scale.set(definition.type === 'cable-tray' ? 2.4 : 0.8, 1, 1);
      }
      matrix.compose(position, quaternion, scale);
      instances.setMatrixAt(i, matrix);
      scale.set(1, 1, 1);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = definition.type !== 'standing-water';
    instances.receiveShadow = true;
    group.add(instances);
  }
  return group;
}

function hasWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function init() {
  if (!hasWebGL2()) {
    dom.unsupported.classList.add('is-visible');
    return;
  }

  const query = new URLSearchParams(window.location.search);
  const qaMode = query.has('qa');
  const qaAutowalk = query.has('autowalk');
  const qaComplete = query.has('complete');
  const levelIndex = getLevelIndex(query);
  const level = LEVELS[levelIndex];
  const mobile = query.has('touch') || window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mazeSize = mobile ? level.maze.mobile : level.maze.desktop;
  const cols = mazeSize.cols;
  const rows = mazeSize.rows;
  let campaignSeed = Number(sessionStorage.getItem('threshold-campaign-seed'));
  if (!Number.isFinite(campaignSeed) || campaignSeed <= 0) {
    campaignSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    sessionStorage.setItem('threshold-campaign-seed', String(campaignSeed));
  }
  const seed = (campaignSeed ^ level.maze.seedSalt) >>> 0;
  const random = mulberry32(seed ^ 0x9e3779b9);
  const maze = new Maze(cols, rows, seed, {
    loopRatio: level.maze.loopRatio,
    roomDivisor: level.maze.roomDivisor,
    minRooms: level.maze.minimumRooms,
  });

  dom.classification.textContent = level.copy.classification;
  dom.levelLabel.textContent = `LEVEL ${levelIndex}`;
  dom.status.textContent = level.copy.status;
  dom.objective.textContent = level.objective.labels.hud;
  dom.overlayKicker.textContent = level.copy.start.kicker;
  dom.overlayTitle.innerHTML = level.copy.start.title;
  dom.overlayBody.textContent = level.copy.start.body;
  dom.enterLabel.textContent = level.copy.start.button;
  dom.game.setAttribute('aria-label', `${level.copy.classification} first-person horror game`);
  dom.game.dataset.level = String(levelIndex);
  document.title = `${level.name.toUpperCase()} / THRESHOLD`;
  document.documentElement.style.setProperty('--sick', new THREE.Color(level.objective.color).getStyle());
  const startIndex = maze.index(Math.floor(cols / 2), Math.floor(rows / 2));
  const exitDistances = maze.distanceMap(startIndex);
  let exitIndex = startIndex;
  for (let i = 0; i < exitDistances.length; i += 1) {
    if (maze.cells[i] !== 0 && exitDistances[i] > exitDistances[exitIndex]) exitIndex = i;
  }
  const startPosition = maze.cellToWorld(startIndex);

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(level.fog.color);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, mobile ? level.fog.density.mobile : level.fog.density.desktop);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, mobile ? 42 : 58);
  camera.position.set(startPosition.x, EYE_HEIGHT, startPosition.z);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: !mobile,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = level.lighting.exposure;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.viewport.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    dom.unsupported.classList.add('is-visible');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    dom.unsupported.classList.remove('is-visible');
    renderer.compileAsync(scene, camera).catch(() => {});
  });

  const controls = new PointerLockControls(camera, renderer.domElement);
  controls.pointerSpeed = 0.78;

  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const worldWidth = cols * CELL_SIZE;
  const worldDepth = rows * CELL_SIZE;
  const wallTextures = buildTexture('wall', 512, 1, 1, anisotropy, level.surfaces.wall);
  const floorTextures = buildTexture('floor', 512, worldWidth / 3.1, worldDepth / 3.1, anisotropy, level.surfaces.floor);
  const ceilingTextures = buildTexture('ceiling', 256, cols, rows, anisotropy, level.surfaces.ceiling);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTextures.map,
    bumpMap: wallTextures.bumpMap,
    bumpScale: level.surfaces.wall.bumpScale,
    color: 0xffffff,
    roughness: level.surfaces.wall.roughness,
    metalness: level.surfaces.wall.metalness,
  });
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTextures.map,
    bumpMap: floorTextures.bumpMap,
    bumpScale: level.surfaces.floor.bumpScale,
    color: 0xffffff,
    roughness: level.surfaces.floor.roughness,
    metalness: level.surfaces.floor.metalness,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTextures.map,
    bumpMap: ceilingTextures.bumpMap,
    bumpScale: level.surfaces.ceiling.bumpScale,
    color: 0xffffff,
    emissive: level.surfaces.ceiling.emissive,
    emissiveIntensity: level.surfaces.ceiling.emissiveIntensity,
    roughness: level.surfaces.ceiling.roughness,
    metalness: level.surfaces.ceiling.metalness,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldDepth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldDepth), ceilingMaterial);
  ceiling.position.y = WALL_HEIGHT;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  const segments = maze.wallSegments();
  const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
  const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, segments.length);
  const baseMaterial = new THREE.MeshStandardMaterial(level.surfaces.trim);
  const baseboards = new THREE.InstancedMesh(wallGeometry, baseMaterial, segments.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const colliders = [];

  segments.forEach((segment, index) => {
    const width = segment.horizontal ? CELL_SIZE : WALL_THICKNESS;
    const depth = segment.horizontal ? WALL_THICKNESS : CELL_SIZE;
    const baseWidth = segment.horizontal ? CELL_SIZE : WALL_THICKNESS + 0.045;
    const baseDepth = segment.horizontal ? WALL_THICKNESS + 0.045 : CELL_SIZE;
    position.set(segment.x, WALL_HEIGHT / 2, segment.z);
    scale.set(width, WALL_HEIGHT, depth);
    matrix.compose(position, quaternion, scale);
    walls.setMatrixAt(index, matrix);

    position.set(segment.x, 0.105, segment.z);
    scale.set(baseWidth, 0.21, baseDepth);
    matrix.compose(position, quaternion, scale);
    baseboards.setMatrixAt(index, matrix);

    colliders.push({
      minX: segment.x - width / 2,
      maxX: segment.x + width / 2,
      minZ: segment.z - depth / 2,
      maxZ: segment.z + depth / 2,
    });
  });
  walls.instanceMatrix.needsUpdate = true;
  baseboards.instanceMatrix.needsUpdate = true;
  walls.castShadow = true;
  walls.receiveShadow = true;
  baseboards.castShadow = true;
  baseboards.receiveShadow = true;
  scene.add(walls, baseboards);

  const stainGeometry = new THREE.CircleGeometry(1, 18);
  const stainMaterial = new THREE.MeshStandardMaterial({
    color: rgbInt(level.surfaces.floor.grime),
    roughness: level.surfaces.floor.roughness,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const stains = new THREE.InstancedMesh(stainGeometry, stainMaterial, mobile ? 10 : 22);
  const floorQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < stains.count; i += 1) {
    const cell = Math.floor(random() * maze.cells.length);
    const center = maze.cellToWorld(cell);
    position.set(center.x + (random() - 0.5) * 2.1, 0.012, center.z + (random() - 0.5) * 2.1);
    scale.set(0.35 + random() * 1.45, 0.2 + random() * 0.8, 1);
    matrix.compose(position, floorQuaternion, scale);
    stains.setMatrixAt(i, matrix);
  }
  stains.instanceMatrix.needsUpdate = true;
  scene.add(stains);

  const grimeCanvas = document.createElement('canvas');
  grimeCanvas.width = grimeCanvas.height = 128;
  const grimeContext = grimeCanvas.getContext('2d');
  grimeContext.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i += 1) {
    const centerX = 28 + random() * 72;
    const centerY = 28 + random() * 72;
    const radius = 12 + random() * 34;
    const gradient = grimeContext.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${0.3 + random() * 0.38})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    grimeContext.fillStyle = gradient;
    grimeContext.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }
  const grimeTexture = new THREE.CanvasTexture(grimeCanvas);
  const wallGrime = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      alphaMap: grimeTexture,
      color: rgbInt(level.surfaces.wall.grime),
      opacity: levelIndex === 2 ? 0.27 : 0.19,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    mobile ? 12 : 28,
  );
  for (let i = 0; i < wallGrime.count; i += 1) {
    const segment = segments[Math.floor(random() * segments.length)];
    const side = random() > 0.5 ? 1 : -1;
    position.set(
      segment.x + (segment.horizontal ? (random() - 0.5) * 2.2 : side * (WALL_THICKNESS / 2 + 0.004)),
      0.48 + random() * 1.55,
      segment.z + (segment.horizontal ? side * (WALL_THICKNESS / 2 + 0.004) : (random() - 0.5) * 2.2),
    );
    quaternion.setFromEuler(new THREE.Euler(0, segment.horizontal ? 0 : Math.PI / 2, 0));
    scale.set(0.42 + random() * 1.18, 0.22 + random() * 0.72, 1);
    matrix.compose(position, quaternion, scale);
    wallGrime.setMatrixAt(i, matrix);
  }
  wallGrime.instanceMatrix.needsUpdate = true;
  scene.add(wallGrime);
  scene.add(buildEnvironmentProps(level, maze, random, mobile));

  const fixtureStates = [];
  const activeFixtures = [];
  const deadFixtures = [];
  for (let i = 0; i < maze.cells.length; i += 1) {
    const broken = i === startIndex ? false : random() < level.lighting.fixture.brokenChance;
    fixtureStates[i] = { broken, phase: random() * Math.PI * 2 };
    (broken ? deadFixtures : activeFixtures).push(i);
  }

  const panelGeometry = new THREE.BoxGeometry(1.62, 0.035, 0.44);
  const frameGeometry = new THREE.BoxGeometry(1.86, 0.075, 0.65);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: level.lighting.fixture.panelColor,
    emissive: level.lighting.fixture.panelColor,
    emissiveIntensity: 3.1,
    roughness: 0.38,
  });
  const deadPanelMaterial = new THREE.MeshStandardMaterial({
    color: level.lighting.fixture.deadPanelColor,
    emissive: level.lighting.fixture.deadPanelColor,
    emissiveIntensity: 0.08,
    roughness: 0.8,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: level.surfaces.trim.color,
    roughness: level.surfaces.trim.roughness,
    metalness: Math.max(0.1, level.surfaces.trim.metalness),
  });
  const activePanels = new THREE.InstancedMesh(panelGeometry, panelMaterial, activeFixtures.length);
  const deadPanels = new THREE.InstancedMesh(panelGeometry, deadPanelMaterial, deadFixtures.length);
  const fixtureFrames = new THREE.InstancedMesh(frameGeometry, frameMaterial, maze.cells.length);

  const setFixtureMatrix = (mesh, instanceIndex, cellIndex, y) => {
    const center = maze.cellToWorld(cellIndex);
    position.set(center.x, y, center.z);
    quaternion.setFromEuler(new THREE.Euler(0, ((cellIndex + Math.floor(cellIndex / cols)) % 2) * Math.PI / 2, 0));
    scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(instanceIndex, matrix);
  };
  activeFixtures.forEach((cell, index) => setFixtureMatrix(activePanels, index, cell, WALL_HEIGHT - 0.075));
  deadFixtures.forEach((cell, index) => setFixtureMatrix(deadPanels, index, cell, WALL_HEIGHT - 0.075));
  for (let i = 0; i < maze.cells.length; i += 1) setFixtureMatrix(fixtureFrames, i, i, WALL_HEIGHT - 0.035);
  activePanels.instanceMatrix.needsUpdate = true;
  deadPanels.instanceMatrix.needsUpdate = true;
  fixtureFrames.instanceMatrix.needsUpdate = true;
  scene.add(fixtureFrames, activePanels, deadPanels);

  const ambient = new THREE.HemisphereLight(
    level.lighting.hemisphere.sky,
    level.lighting.hemisphere.ground,
    mobile ? level.lighting.hemisphere.intensity.mobile : level.lighting.hemisphere.intensity.desktop,
  );
  const bounce = new THREE.AmbientLight(
    level.lighting.ambient.color,
    mobile ? level.lighting.ambient.intensity.mobile : level.lighting.ambient.intensity.desktop,
  );
  scene.add(ambient, bounce);

  const lightPool = [];
  const lightCount = mobile ? level.lighting.fixture.pool.mobile : level.lighting.fixture.pool.desktop;
  for (let i = 0; i < lightCount; i += 1) {
    const light = new THREE.SpotLight(
      level.lighting.fixture.color,
      level.lighting.fixture.intensity,
      level.lighting.fixture.distance,
      level.lighting.fixture.angle,
      level.lighting.fixture.penumbra,
      level.lighting.fixture.decay,
    );
    light.position.y = WALL_HEIGHT - 0.12;
    light.castShadow = !mobile && i === 0;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 11;
    light.shadow.bias = -0.00035;
    light.shadow.normalBias = 0.035;
    scene.add(light, light.target);
    lightPool.push(light);
  }

  const exitCell = maze.cellToWorld(exitIndex);
  const exitGroup = new THREE.Group();
  const exitWalls = DIRECTIONS.filter((direction) => maze.hasWall(exitIndex, direction.bit));
  const exitWall = exitWalls[0] || DIRECTIONS[0];
  const doorOffset = CELL_SIZE / 2 - 0.12;
  exitGroup.position.set(
    exitCell.x + exitWall.dc * doorOffset,
    0,
    exitCell.z + exitWall.dr * doorOffset,
  );
  exitGroup.rotation.y = exitWall.bit === N
    ? 0
    : exitWall.bit === S
      ? Math.PI
      : exitWall.bit === E
        ? -Math.PI / 2
        : Math.PI / 2;

  const doorMaterial = new THREE.MeshStandardMaterial({
    color: rgbInt(level.surfaces.wall.grime),
    roughness: 0.74,
    metalness: 0.12,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: level.surfaces.trim.color,
    roughness: level.surfaces.trim.roughness,
    metalness: level.surfaces.trim.metalness,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.32, 0.13), doorMaterial);
  door.position.y = 1.16;
  door.castShadow = true;
  exitGroup.add(door);

  for (const x of [-0.66, 0.66]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.48, 0.18), trimMaterial);
    trim.position.set(x, 1.24, 0);
    exitGroup.add(trim);
  }
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.12, 0.18), trimMaterial);
  topTrim.position.y = 2.42;
  exitGroup.add(topTrim);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 72;
  const signContext = signCanvas.getContext('2d');
  signContext.fillStyle = '#29412c';
  signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
  signContext.strokeStyle = '#7ea77c';
  signContext.lineWidth = 5;
  signContext.strokeRect(4, 4, signCanvas.width - 8, signCanvas.height - 8);
  signContext.fillStyle = '#dbe8c7';
  signContext.font = '700 40px Arial';
  signContext.textAlign = 'center';
  signContext.textBaseline = 'middle';
  signContext.fillText(levelIndex === 1 ? 'LIFT' : levelIndex === 2 ? 'HATCH' : 'EXIT', signCanvas.width / 2, signCanvas.height / 2 + 2);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  signTexture.anisotropy = anisotropy;
  const exitSignBacking = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.29, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x142018, roughness: 0.65 }),
  );
  exitSignBacking.position.set(0, 2.66, 0);
  exitGroup.add(exitSignBacking);
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.23),
    new THREE.MeshStandardMaterial({
      map: signTexture,
      emissiveMap: signTexture,
      emissive: 0x8eb789,
      emissiveIntensity: 2.8,
      roughness: 0.42,
    }),
  );
  exitSign.position.set(0, 2.66, 0.045);
  exitGroup.add(exitSign);
  if (level.objective.count > 0) exitSign.material.emissiveIntensity = 0.28;
  scene.add(exitGroup);

  const objectiveItems = [];
  if (level.objective.count > 0) {
    const candidateCells = [];
    const exitDistance = exitDistances[exitIndex];
    for (let i = 0; i < maze.cells.length; i += 1) {
      if (
        i !== startIndex
        && i !== exitIndex
        && maze.cells[i] !== 0
        && !fixtureStates[i].broken
        && exitDistances[i] >= 6
        && exitDistances[i] <= Math.max(7, exitDistance - 3)
      ) candidateCells.push(i);
    }
    candidateCells.sort(() => random() - 0.5);
    const selectedCells = [];
    for (const candidate of candidateCells) {
      const candidateWorld = maze.cellToWorld(candidate);
      if (selectedCells.every((cell) => candidateWorld.distanceTo(maze.cellToWorld(cell)) > CELL_SIZE * 3.2)) {
        selectedCells.push(candidate);
        if (selectedCells.length === level.objective.count) break;
      }
    }
    for (const candidate of candidateCells) {
      if (selectedCells.length === level.objective.count) break;
      if (!selectedCells.includes(candidate)) selectedCells.push(candidate);
    }

    for (const cellIndex of selectedCells) {
      const cellCenter = maze.cellToWorld(cellIndex);
      const wallsInCell = DIRECTIONS.filter((direction) => maze.hasWall(cellIndex, direction.bit));
      const wall = wallsInCell[Math.floor(random() * wallsInCell.length)] || DIRECTIONS[0];
      const model = buildObjectiveModel(level.objective.type, level.objective.color);
      const mountOffset = CELL_SIZE / 2 - 0.14;
      model.position.set(
        cellCenter.x + wall.dc * mountOffset,
        1.12,
        cellCenter.z + wall.dr * mountOffset,
      );
      model.rotation.y = wall.bit === N
        ? 0
        : wall.bit === S
          ? Math.PI
          : wall.bit === E
            ? -Math.PI / 2
            : Math.PI / 2;
      model.userData.cellIndex = cellIndex;
      model.userData.activated = false;
      scene.add(model);
      objectiveItems.push(model);
    }
  }
  const objectiveTotal = objectiveItems.length;
  if (objectiveTotal === 0) exitSign.material.emissiveIntensity = 2.8;
  dom.game.dataset.objectiveTotal = String(objectiveTotal);

  const entity = buildMonster(THREE, {
    name: level.monster.name,
    height: 2.46 * level.monster.skin.scale,
    skinColor: level.monster.skin.body,
    eyeColor: level.monster.skin.eye || level.monster.skin.accent,
    eyeGlow: Boolean(level.monster.skin.eye),
    eyeIntensity: level.monster.skin.emissiveIntensity,
    detail: mobile ? 'low' : 'medium',
    seed: seed ^ 0x51f15e,
  });
  entity.visible = false;
  scene.add(entity);

  const audio = new AudioEngine({ ...level.audio, drips: levelIndex === 2 });
  audio.setMuted(localStorage.getItem('threshold-muted') === '1');
  dom.soundToggle.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
  const keys = new Set();
  const playerPosition = new THREE.Vector2(startPosition.x, startPosition.z);
  const velocity = new THREE.Vector2();
  const inputDirection = new THREE.Vector2();
  const touchInput = new THREE.Vector2();
  const worldDirection = new THREE.Vector3();
  const rightDirection = new THREE.Vector3();
  const desiredDirection = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const entityVector = new THREE.Vector3();
  const entityTarget = new THREE.Vector3();
  const entityPreviousPosition = new THREE.Vector3();
  const clock = new THREE.Clock();

  let gameState = 'start';
  let ending = false;
  let elapsed = 0;
  let accumulator = 0;
  let stamina = 1;
  let headBob = 0;
  let currentEyeHeight = EYE_HEIGHT;
  let stepDistance = 0;
  let nextScare = randomBetween(level.monster.timing.firstScare, random);
  let nextChase = randomBetween(level.monster.timing.firstChase, random);
  let flickerUntil = 0;
  let lightUpdateAt = 0;
  let messageUntil = 0;
  let lastGrainUpdate = 0;
  let touchSprint = false;
  let nearExit = false;
  let currentInteraction = null;
  let objectivesCompleted = 0;
  let playerNoise = 0;
  let tension = 0;
  let entityMode = 'hidden';
  let entityUntil = 0;
  let entityPath = [];
  let entityPathIndex = 0;
  let entityPathUpdate = 0;
  let entitySeenFor = 0;
  let entityLostSight = 0;
  let entityLastKnownCell = startIndex;
  let entityStepDistance = 0;
  let entityCurrentSpeed = 0;
  let entityPerceptionUpdate = 0;
  let entityCanSeePlayer = false;
  let entityHeardPlayer = false;
  let lastFrame = performance.now();
  let fixedStep = 1 / 120;
  let frameTimeAverage = 1 / 60;
  let slowFrameDuration = 0;
  let adaptiveQualityReduced = false;
  let activeLightCount = lightPool.length;

  const grainContext = dom.grain.getContext('2d', { alpha: true });
  dom.grain.width = 180;
  dom.grain.height = 100;

  function updateGrain(force = false) {
    if (!force && (reducedMotion || elapsed - lastGrainUpdate < 0.085)) return;
    lastGrainUpdate = elapsed;
    const image = grainContext.createImageData(dom.grain.width, dom.grain.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.floor(random() * 255);
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 62;
    }
    grainContext.putImageData(image, 0, 0);
  }
  updateGrain(true);

  function showOverlay(kind) {
    dom.overlay.classList.add('is-visible');
    if (kind === 'pause') {
      dom.overlayKicker.textContent = level.copy.pause.kicker;
      dom.overlayTitle.innerHTML = level.copy.pause.title;
      dom.overlayBody.textContent = level.copy.pause.body;
      dom.enterLabel.textContent = level.copy.pause.button;
    } else if (kind === 'dead') {
      dom.overlayKicker.textContent = level.copy.death.kicker;
      dom.overlayTitle.innerHTML = level.copy.death.title;
      dom.overlayBody.textContent = level.copy.death.body;
      dom.enterLabel.textContent = level.copy.death.button;
    } else if (kind === 'won') {
      dom.overlayKicker.textContent = level.copy.win.kicker;
      dom.overlayTitle.innerHTML = level.copy.win.title;
      dom.overlayBody.textContent = level.copy.win.body;
      dom.enterLabel.textContent = level.copy.win.button;
    }
    requestAnimationFrame(() => dom.enterButton.focus({ preventScroll: true }));
  }

  function hideOverlay() {
    dom.overlay.classList.remove('is-visible');
    if (mobile) dom.touchUi.classList.add('is-visible');
  }

  function showMessage(text, duration = 1.1) {
    dom.message.textContent = text;
    dom.message.classList.add('is-visible');
    messageUntil = elapsed + duration;
  }

  function objectiveProgressText() {
    if (!objectiveTotal) return level.objective.labels.hud;
    const progress = level.objective.labels.progress
      .replace('{current}', String(objectivesCompleted))
      .replace('{total}', String(objectiveTotal));
    return `${level.objective.labels.hud} / ${progress}`;
  }

  function updateObjectiveHud() {
    dom.objective.textContent = objectivesCompleted >= objectiveTotal && objectiveTotal > 0
      ? level.objective.labels.complete
      : objectiveProgressText();
    dom.objective.style.opacity = '1';
    dom.game.dataset.objectivesCompleted = String(objectivesCompleted);
  }

  function updateObjectiveAnimations(dt) {
    for (const item of objectiveItems) {
      const target = item.userData.activated ? 1 : 0;
      item.userData.activationProgress = lerp(
        item.userData.activationProgress,
        target,
        1 - Math.exp(-7 * dt),
      );
      const progress = item.userData.activationProgress;
      if (item.userData.type === 'valve') item.userData.control.rotation.z = progress * Math.PI * 1.65;
      else item.userData.control.rotation.x = -progress * 0.78;
      const indicatorMaterial = item.userData.indicator.material;
      indicatorMaterial.color.set(item.userData.activated ? 0x72a96b : 0x4f160f);
      indicatorMaterial.emissive.set(item.userData.activated ? 0x5f9b59 : 0x7d160e);
      indicatorMaterial.emissiveIntensity = item.userData.activated ? 2.3 : 1.2;
    }
  }

  updateObjectiveHud();
  if (qaComplete) {
    objectiveItems.forEach((item) => { item.userData.activated = true; });
    objectivesCompleted = objectiveTotal;
    exitSign.material.emissiveIntensity = 2.8;
    updateObjectiveHud();
  }

  function resolveCollision() {
    for (let iteration = 0; iteration < 4; iteration += 1) {
      let resolved = false;
      for (const box of colliders) {
        if (
          playerPosition.x + PLAYER_RADIUS < box.minX ||
          playerPosition.x - PLAYER_RADIUS > box.maxX ||
          playerPosition.y + PLAYER_RADIUS < box.minZ ||
          playerPosition.y - PLAYER_RADIUS > box.maxZ
        ) continue;

        const closestX = clamp(playerPosition.x, box.minX, box.maxX);
        const closestZ = clamp(playerPosition.y, box.minZ, box.maxZ);
        let dx = playerPosition.x - closestX;
        let dz = playerPosition.y - closestZ;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= PLAYER_RADIUS * PLAYER_RADIUS) continue;

        let normalX;
        let normalZ;
        let penetration;
        if (distanceSq > 0.0000001) {
          const distance = Math.sqrt(distanceSq);
          normalX = dx / distance;
          normalZ = dz / distance;
          penetration = PLAYER_RADIUS - distance;
        } else {
          const left = Math.abs(playerPosition.x - box.minX);
          const right = Math.abs(box.maxX - playerPosition.x);
          const top = Math.abs(playerPosition.y - box.minZ);
          const bottom = Math.abs(box.maxZ - playerPosition.y);
          const minimum = Math.min(left, right, top, bottom);
          normalX = minimum === left ? -1 : minimum === right ? 1 : 0;
          normalZ = minimum === top ? -1 : minimum === bottom ? 1 : 0;
          penetration = PLAYER_RADIUS + minimum;
        }

        playerPosition.x += normalX * penetration;
        playerPosition.y += normalZ * penetration;
        const inward = velocity.x * normalX + velocity.y * normalZ;
        if (inward < 0) {
          velocity.x -= inward * normalX;
          velocity.y -= inward * normalZ;
        }
        resolved = true;
      }
      if (!resolved) break;
    }
  }

  function simulatePlayer(dt) {
    const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
      - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touchInput.y;
    const strafeInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
      - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchInput.x;
    inputDirection.set(strafeInput, forwardInput);
    if (inputDirection.lengthSq() > 1) inputDirection.normalize();

    camera.getWorldDirection(worldDirection);
    worldDirection.y = 0;
    worldDirection.normalize();
    rightDirection.crossVectors(worldDirection, up).normalize();
    desiredDirection
      .copy(worldDirection)
      .multiplyScalar(inputDirection.y)
      .addScaledVector(rightDirection, inputDirection.x);
    if (desiredDirection.lengthSq() > 1) desiredDirection.normalize();

    const moving = inputDirection.lengthSq() > 0.015;
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint) && moving && !crouching;
    const sprinting = wantsSprint && stamina > 0.035;
    const targetSpeed = crouching ? 1.25 : sprinting ? 4.35 : 2.28;
    const targetX = desiredDirection.x * targetSpeed;
    const targetZ = desiredDirection.z * targetSpeed;
    const response = 1 - Math.exp(-(moving ? 12 : 15) * dt);
    velocity.x = lerp(velocity.x, targetX, response);
    velocity.y = lerp(velocity.y, targetZ, response);

    if (sprinting) stamina = Math.max(0, stamina - dt * 0.235);
    else stamina = Math.min(1, stamina + dt * (moving ? 0.1 : 0.16));

    const displacementX = velocity.x * dt;
    const displacementZ = velocity.y * dt;
    const distance = Math.hypot(displacementX, displacementZ);
    const substeps = Math.max(1, Math.ceil(distance / (PLAYER_RADIUS * 0.36)));
    for (let step = 0; step < substeps; step += 1) {
      playerPosition.x += displacementX / substeps;
      playerPosition.y += displacementZ / substeps;
      resolveCollision();
    }

    const actualSpeed = velocity.length();
    const noiseTarget = !moving ? 0 : crouching ? 0.12 : sprinting ? 1 : 0.42;
    playerNoise = lerp(playerNoise, noiseTarget, 1 - Math.exp(-5 * dt));
    if (moving && actualSpeed > 0.3) {
      stepDistance += actualSpeed * dt;
      const stride = sprinting ? 1.45 : crouching ? 2.2 : 1.75;
      if (stepDistance >= stride) {
        stepDistance = 0;
        audio.footstep(sprinting);
      }
      headBob += dt * actualSpeed * (sprinting ? 3.05 : 2.55);
    }

    const targetEye = crouching ? 1.12 : EYE_HEIGHT;
    currentEyeHeight = lerp(currentEyeHeight, targetEye, 1 - Math.exp(-9 * dt));
    const bobAmount = reducedMotion || crouching ? 0 : Math.sin(headBob * Math.PI) * Math.min(actualSpeed / 4, 1) * 0.035;
    camera.position.set(playerPosition.x, currentEyeHeight + bobAmount, playerPosition.y);

    dom.stamina.classList.toggle('is-visible', stamina < 0.98 || wantsSprint);
    dom.staminaFill.style.transform = `scaleX(${stamina})`;
  }

  function updateLights() {
    const playerCell = maze.worldToCell(playerPosition.x, playerPosition.y);
    const { col: playerCol, row: playerRow } = maze.coords(playerCell);
    const candidates = [];
    const radius = mobile ? 2 : 3;

    for (let row = Math.max(0, playerRow - radius); row <= Math.min(rows - 1, playerRow + radius); row += 1) {
      for (let col = Math.max(0, playerCol - radius); col <= Math.min(cols - 1, playerCol + radius); col += 1) {
        const index = maze.index(col, row);
        if (fixtureStates[index].broken) continue;
        const center = maze.cellToWorld(index);
        candidates.push({ index, center, distance: center.distanceToSquared(camera.position) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);

    const activeLights = lightPool.slice(0, activeLightCount);
    lightPool.slice(activeLightCount).forEach((light) => { light.visible = false; });
    const candidatesByCell = new Map(candidates.map((candidate) => [candidate.index, candidate]));
    const usedCells = new Set();
    const assignments = new Array(activeLights.length);
    activeLights.forEach((light, index) => {
      const current = candidatesByCell.get(light.userData.cell);
      const stableRadius = index === 0 ? 5.2 : 7.8;
      if (current && current.distance < stableRadius * stableRadius && !usedCells.has(current.index)) {
        assignments[index] = current;
        usedCells.add(current.index);
      }
    });
    activeLights.forEach((light, index) => {
      if (assignments[index]) return;
      const next = candidates.find((candidate) => !usedCells.has(candidate.index));
      if (next) {
        assignments[index] = next;
        usedCells.add(next.index);
      }
    });

    activeLights.forEach((light, index) => {
      const candidate = assignments[index];
      if (!candidate) {
        light.visible = false;
        return;
      }
      light.visible = true;
      if (light.userData.cell === candidate.index) return;
      light.userData.cell = candidate.index;
      light.position.set(candidate.center.x, WALL_HEIGHT - 0.11, candidate.center.z);
      light.target.position.set(candidate.center.x, 0, candidate.center.z);
    });
  }

  function hasClearLine(startX, startZ, endX, endZ) {
    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    const endpointEpsilon = 0.02 / Math.max(0.02, Math.hypot(deltaX, deltaZ));
    for (const box of colliders) {
      let minimum = 0;
      let maximum = 1;
      if (Math.abs(deltaX) < 0.000001) {
        if (startX < box.minX || startX > box.maxX) continue;
      } else {
        let near = (box.minX - startX) / deltaX;
        let far = (box.maxX - startX) / deltaX;
        if (near > far) [near, far] = [far, near];
        minimum = Math.max(minimum, near);
        maximum = Math.min(maximum, far);
        if (minimum > maximum) continue;
      }
      if (Math.abs(deltaZ) < 0.000001) {
        if (startZ < box.minZ || startZ > box.maxZ) continue;
      } else {
        let near = (box.minZ - startZ) / deltaZ;
        let far = (box.maxZ - startZ) / deltaZ;
        if (near > far) [near, far] = [far, near];
        minimum = Math.max(minimum, near);
        maximum = Math.min(maximum, far);
        if (minimum > maximum) continue;
      }
      if (minimum <= maximum && maximum > endpointEpsilon && minimum < 1 - endpointEpsilon) return false;
    }
    return true;
  }

  function placeEntity(mode) {
    const playerCell = maze.worldToCell(playerPosition.x, playerPosition.y);
    let targetCell;
    if (mode === 'glimpse') {
      const distances = maze.distanceMap(playerCell);
      const visibleCells = [];
      for (let i = 0; i < distances.length; i += 1) {
        if (distances[i] < 4 || distances[i] > 10) continue;
        const candidate = maze.cellToWorld(i);
        const worldDistance = Math.hypot(candidate.x - playerPosition.x, candidate.z - playerPosition.y);
        if (
          worldDistance > 6
          && worldDistance < 23.5
          && hasClearLine(playerPosition.x, playerPosition.y, candidate.x, candidate.z)
        ) visibleCells.push(i);
      }
      if (!visibleCells.length) return false;
      targetCell = visibleCells[Math.floor(random() * visibleCells.length)];
    } else {
      const distances = maze.distanceMap(playerCell);
      const hiddenCells = [];
      for (let i = 0; i < distances.length; i += 1) {
        if (distances[i] < 8 || distances[i] > 17 || i === exitIndex) continue;
        const candidate = maze.cellToWorld(i);
        if (!hasClearLine(playerPosition.x, playerPosition.y, candidate.x, candidate.z)) hiddenCells.push(i);
      }
      targetCell = hiddenCells.length
        ? hiddenCells[Math.floor(random() * hiddenCells.length)]
        : maze.randomCellAtDistance(playerCell, 8, 17, random);
    }
    const target = maze.cellToWorld(targetCell);
    entity.position.set(target.x, 0, target.z);
    entityPreviousPosition.copy(entity.position);
    entity.visible = true;
    entityMode = mode;
    entityUntil = mode === 'glimpse'
      ? elapsed + level.monster.timing.glimpseDuration
      : mode === 'stalk'
        ? elapsed + level.monster.timing.stalkDuration
        : Infinity;
    entityLastKnownCell = playerCell;
    entityPath = [];
    entityPathIndex = 0;
    entityPathUpdate = 0;
    entitySeenFor = 0;
    entityLostSight = 0;
    entityCurrentSpeed = 0;
    entityStepDistance = 0;
    entityPerceptionUpdate = 0;
    return true;
  }

  function hideEntity() {
    entity.visible = false;
    entityMode = 'hidden';
    entityPath = [];
    entitySeenFor = 0;
    entityCurrentSpeed = 0;
    entityCanSeePlayer = false;
    entityHeardPlayer = false;
    animateMonster(entity, { time: elapsed, speed: 0, mode: 'hidden', distance: Infinity });
  }

  function updateEntity(dt) {
    if (entityMode === 'hidden') return Infinity;
    entityVector.copy(entity.position).sub(camera.position);
    entityVector.y = 0;
    const distance = entityVector.length();
    entityVector.normalize();
    camera.getWorldDirection(worldDirection);
    worldDirection.y = 0;
    worldDirection.normalize();
    rightDirection.crossVectors(worldDirection, up).normalize();
    const lookDot = worldDirection.dot(entityVector);
    const lookingAtEntity = lookDot > 0.965
      && distance < 24
      && hasClearLine(playerPosition.x, playerPosition.y, entity.position.x, entity.position.z);

    const entityCell = maze.worldToCell(entity.position.x, entity.position.z);
    const playerCell = maze.worldToCell(playerPosition.x, playerPosition.y);
    entityPerceptionUpdate -= dt;
    if (entityPerceptionUpdate <= 0) {
      entityCanSeePlayer = distance < 23
        && hasClearLine(entity.position.x, entity.position.z, playerPosition.x, playerPosition.y);
      const routeDistance = maze.shortestPath(entityCell, playerCell).length - 1;
      const hearingRange = 2 + Math.round(playerNoise * 9);
      entityHeardPlayer = playerNoise > 0.1 && routeDistance >= 0 && routeDistance <= hearingRange;
      if (entityCanSeePlayer || entityHeardPlayer) entityLastKnownCell = playerCell;
      entityPerceptionUpdate = 0.12;
    }

    if (entityMode === 'glimpse') {
      if (lookingAtEntity) entitySeenFor += dt;
      animateMonster(entity, { time: elapsed, speed: 0, mode: 'glimpse', distance });
      if (elapsed > entityUntil || entitySeenFor > 0.52 || distance < 3.5) {
        entityMode = 'stalk';
        entityUntil = elapsed + level.monster.timing.stalkDuration;
        entityPathUpdate = 0;
        audio.powerDip(elapsed, 0.38);
      }
      return distance;
    }

    if (
      entityMode === 'stalk'
      && (
        (entityCanSeePlayer && distance < level.monster.stalkTriggerDistance)
        || (entityHeardPlayer && playerNoise > 0.78)
        || elapsed > entityUntil
      )
    ) {
      entityMode = 'chase';
      showMessage('RUN', 0.72);
      audio.impact();
      flickerUntil = elapsed + 2.2;
    }

    if (entityMode === 'chase') {
      if (entityCanSeePlayer) entityLostSight = 0;
      else entityLostSight += dt;
      if (entityLostSight > 5.5 && !entityHeardPlayer) {
        entityMode = 'search';
        entityUntil = elapsed + 8 + random() * 5;
        entityPathUpdate = 0;
      }
    } else if (entityMode === 'search') {
      if (entityCanSeePlayer || (entityHeardPlayer && playerNoise > 0.45)) {
        entityMode = 'chase';
        entityLostSight = 0;
        showMessage('IT FOUND YOU', 0.5);
      } else if (elapsed > entityUntil) {
        hideEntity();
        nextChase = elapsed + 18 + random() * 18;
        return Infinity;
      }
    }

    entityPathUpdate -= dt;
    if (entityPathUpdate <= 0) {
      if (entityMode === 'stalk' && !entityCanSeePlayer && !entityHeardPlayer && entityPathIndex >= entityPath.length - 1) {
        entityLastKnownCell = maze.randomCellAtDistance(entityCell, 2, 6, random);
      }
      entityPath = maze.shortestPath(entityCell, entityLastKnownCell);
      entityPathIndex = Math.min(1, entityPath.length - 1);
      entityPathUpdate = entityMode === 'chase'
        ? level.monster.timing.pathRefresh.chase
        : entityMode === 'search'
          ? 0.5
          : level.monster.timing.pathRefresh.stalk;
    }

    let targetSpeed = 0;
    if (entityPath.length) {
      const target = entityCell === entityLastKnownCell && (entityCanSeePlayer || entityHeardPlayer)
        ? entityTarget.set(playerPosition.x, 0, playerPosition.y)
        : entityPath.length > 1 && entityPathIndex < entityPath.length
          ? maze.cellToWorld(entityPath[entityPathIndex])
          : entityTarget.copy(maze.cellToWorld(entityLastKnownCell));
      const direction = entityTarget.copy(target).sub(entity.position);
      direction.y = 0;
      const targetDistance = direction.length();
      if (targetDistance < 0.16) entityPathIndex += 1;
      else {
        direction.normalize();
        targetSpeed = entityMode === 'chase'
          ? level.monster.speeds.chase
          : entityMode === 'search'
            ? level.monster.speeds.stalk * 1.14
            : lookingAtEntity
              ? level.monster.speeds.watched
              : level.monster.speeds.stalk;
        entityCurrentSpeed = lerp(entityCurrentSpeed, targetSpeed, 1 - Math.exp(-4.5 * dt));
        const movement = Math.min(entityCurrentSpeed * dt, targetDistance);
        entity.position.addScaledVector(direction, movement);
        const targetYaw = Math.atan2(direction.x, direction.z);
        const yawDelta = Math.atan2(Math.sin(targetYaw - entity.rotation.y), Math.cos(targetYaw - entity.rotation.y));
        entity.rotation.y += yawDelta * Math.min(1, dt * (entityMode === 'chase' ? 8 : 4.5));
        entityStepDistance += movement;
      }
    }

    if (targetSpeed === 0) entityCurrentSpeed = lerp(entityCurrentSpeed, 0, 1 - Math.exp(-7 * dt));
    entity.position.y = 0;
    const updatedDistance = Math.hypot(entity.position.x - playerPosition.x, entity.position.z - playerPosition.y);
    const soundPan = clamp(rightDirection.dot(entityVector), -1, 1);
    const monsterStride = entityMode === 'chase' ? 1.15 : 1.72;
    if (entityStepDistance >= monsterStride) {
      entityStepDistance = 0;
      audio.monsterStep(soundPan, updatedDistance, entityMode === 'chase');
    }
    animateMonster(entity, {
      time: elapsed,
      speed: entityCurrentSpeed,
      mode: updatedDistance < 1.8 ? 'attack' : entityMode,
      distance: updatedDistance,
    });
    entityPreviousPosition.copy(entity.position);
    if (updatedDistance < level.monster.catchDistance) die();
    return updatedDistance;
  }

  function triggerScare() {
    const type = Math.floor(random() * 4);
    if (type === 0) {
      flickerUntil = elapsed + 1.2 + random() * 1.3;
      audio.powerDip(elapsed, 0.7 + random() * 0.8);
    } else if (type === 1 && entityMode === 'hidden' && placeEntity('glimpse')) {
      audio.scare(random() > 0.5 ? -0.75 : 0.75);
    } else if (type === 2) {
      audio.scare(random() * 2 - 1);
      if (random() > 0.55) showMessage('DID YOU HEAR THAT?', 0.62);
    } else {
      flickerUntil = elapsed + 0.58;
      audio.powerDip(elapsed, 0.24);
    }
    nextScare = elapsed + randomBetween(level.monster.timing.scareInterval, random);
  }

  function updateDirector(dt) {
    const doorDistance = camera.position.distanceTo(exitGroup.position);
    const entityDistance = updateEntity(dt);
    tension = clamp(
      elapsed / 115
        + (Number.isFinite(entityDistance) ? clamp(1 - entityDistance / 24, 0, 1) * 0.56 : 0)
        + (doorDistance < 16 ? 0.06 : 0),
      0,
      1,
    );

    if (elapsed > nextScare && entityMode !== 'chase') triggerScare();
    if (elapsed > nextChase && entityMode === 'hidden') {
      placeEntity('stalk');
      nextChase = Infinity;
      audio.scare(0);
    }

    const flickering = elapsed < flickerUntil;
    let lightMultiplier = 1;
    if (flickering) {
      const intensity = reducedMotion ? 0.62 : random();
      lightMultiplier = intensity > 0.36 ? 0.65 + intensity * 0.35 : 0.035;
    }
    lightPool.forEach((light, index) => {
      const phase = fixtureStates[light.userData.cell || 0]?.phase || 0;
      const wobble = 0.94 + Math.sin(elapsed * 4.2 + phase) * 0.035;
      light.intensity = level.lighting.fixture.intensity * lightMultiplier * wobble * (index === 0 ? 1.08 : 0.92);
    });
    panelMaterial.emissiveIntensity = 3.1 * (flickering ? Math.max(0.08, lightMultiplier) : 1);
    renderer.toneMappingExposure = lerp(
      renderer.toneMappingExposure,
      level.lighting.exposure * (flickering ? 0.62 + lightMultiplier * 0.38 : 1),
      0.18,
    );
    dom.threat.style.opacity = String(clamp((tension - 0.38) * 0.8, 0, 0.48));
    audio.update(tension, elapsed, Number.isFinite(entityDistance) ? {
      distance: entityDistance,
      pan: clamp(rightDirection.dot(entityVector), -1, 1),
      mode: entityMode,
    } : null);

    if (entityMode === 'chase') dom.status.textContent = 'PURSUIT DETECTED';
    else if (entityMode === 'search') dom.status.textContent = 'MOVEMENT NEARBY';
    else if (elapsed > 35) dom.status.textContent = 'SIGNAL UNSTABLE';
    else dom.status.textContent = level.copy.status;
    if (elapsed > 7 && objectiveTotal === 0) dom.objective.style.opacity = '0';
  }

  function updateExit() {
    camera.getWorldDirection(worldDirection);
    worldDirection.y = 0;
    worldDirection.normalize();
    const playerCell = maze.worldToCell(playerPosition.x, playerPosition.y);
    currentInteraction = null;

    for (const item of objectiveItems) {
      if (item.userData.activated || item.userData.cellIndex !== playerCell) continue;
      const delta = entityTarget.copy(item.position).sub(camera.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance > 2.25) continue;
      delta.normalize();
      if (worldDirection.dot(delta) > 0.48) {
        currentInteraction = { type: 'objective', item };
        break;
      }
    }

    if (!currentInteraction) {
      const delta = entityTarget.copy(exitGroup.position).sub(camera.position);
      delta.y = 0;
      const distance = delta.length();
      delta.normalize();
      const facing = worldDirection.dot(delta) > 0.56;
      nearExit = playerCell === exitIndex && distance < 2.15 && facing;
      if (nearExit) currentInteraction = {
        type: 'exit',
        locked: objectivesCompleted < objectiveTotal,
      };
    } else nearExit = false;

    const interactionVisible = Boolean(currentInteraction);
    if (currentInteraction?.type === 'objective') {
      dom.interact.textContent = level.objective.labels.interact;
      dom.touchAction.textContent = 'USE';
    } else if (currentInteraction?.locked) {
      dom.interact.textContent = 'E  CHECK LOCK';
      dom.touchAction.textContent = 'CHECK';
    } else {
      dom.interact.textContent = level.objective.labels.interact || 'E  OPEN';
      dom.touchAction.textContent = 'OPEN';
    }
    dom.interact.classList.toggle('is-visible', interactionVisible);
    dom.touchAction.classList.toggle('is-visible', interactionVisible);
  }

  function interact() {
    if (!currentInteraction || gameState !== 'playing') return;
    if (currentInteraction.type === 'objective') {
      const item = currentInteraction.item;
      if (item.userData.activated) return;
      item.userData.activated = true;
      objectivesCompleted += 1;
      playerNoise = 1.45;
      audio.objectiveComplete();
      updateObjectiveHud();
      const progress = `${level.objective.labels.item} ${objectivesCompleted} / ${objectiveTotal}`;
      showMessage(progress, 0.95);
      flickerUntil = Math.max(flickerUntil, elapsed + 0.45);
      if (objectivesCompleted >= objectiveTotal) {
        exitSign.material.emissiveIntensity = 2.8;
        showMessage(level.objective.labels.complete, 1.6);
        audio.powerDip(elapsed, 0.5);
      }
      currentInteraction = null;
      return;
    }
    if (currentInteraction.locked) {
      showMessage(level.objective.labels.locked, 1.2);
      audio.scare(0);
      playerNoise = Math.max(playerNoise, 0.72);
      return;
    }
    win();
  }

  function die() {
    if (ending) return;
    ending = true;
    gameState = 'dead';
    audio.impact();
    showMessage('IT HEARD YOU', 1.2);
    dom.threat.style.opacity = '0.88';
    if (!mobile && controls.isLocked) controls.unlock();
    setTimeout(() => {
      dom.message.classList.remove('is-visible');
      dom.threat.style.opacity = '0';
      showOverlay('dead');
      dom.touchUi.classList.remove('is-visible');
    }, 950);
  }

  function win() {
    if (ending) return;
    ending = true;
    gameState = 'won';
    audio.powerDip(elapsed, 2);
    showMessage(levelIndex === LEVELS.length - 1 ? 'THE RECORDING ENDS' : 'THRESHOLD OPEN', 1.3);
    if (!mobile && controls.isLocked) controls.unlock();
    setTimeout(() => {
      dom.message.classList.remove('is-visible');
      showOverlay('won');
      dom.touchUi.classList.remove('is-visible');
    }, 1100);
  }

  function beginPlay() {
    ending = false;
    gameState = 'playing';
    hideOverlay();
    audio.resume();
    lastFrame = performance.now();
    clock.getDelta();
    dom.game.dataset.gameState = gameState;
  }

  function reduceQuality() {
    if (adaptiveQualityReduced) return;
    adaptiveQualityReduced = true;
    activeLightCount = Math.min(lightPool.length, mobile ? 2 : 4);
    fixedStep = 1 / 75;
    renderer.shadowMap.enabled = false;
    lightPool.forEach((light) => { light.castShadow = false; });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    dom.grain.style.opacity = '0.04';
    dom.game.dataset.quality = 'reduced';
    updateLights();
  }

  controls.addEventListener('lock', beginPlay);
  controls.addEventListener('unlock', () => {
    keys.clear();
    velocity.multiplyScalar(0.25);
    if (ending || gameState === 'dead' || gameState === 'won') return;
    if (gameState === 'playing') {
      gameState = 'paused';
      audio.suspend();
      showOverlay('pause');
    }
  });

  dom.enterButton.addEventListener('click', () => {
    if (gameState === 'dead') {
      window.location.reload();
      return;
    }
    if (gameState === 'won') {
      const nextLevel = levelIndex === LEVELS.length - 1 ? 0 : levelIndex + 1;
      if (nextLevel === 0) sessionStorage.removeItem('threshold-campaign-seed');
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('level', String(nextLevel));
      nextUrl.searchParams.delete('autowalk');
      window.location.href = nextUrl.toString();
      return;
    }
    if (mobile) {
      const fullscreenRequest = document.documentElement.requestFullscreen?.();
      fullscreenRequest?.catch(() => {});
      beginPlay();
    } else {
      controls.lock();
    }
    audio.start().catch(() => {});
  });

  document.addEventListener('pointerlockerror', () => {
    if (mobile || ending) return;
    gameState = 'paused';
    audio.suspend();
    showOverlay('pause');
    dom.overlayBody.textContent = 'Pointer lock was blocked. Select the button to try again.';
  });

  dom.soundToggle.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    localStorage.setItem('threshold-muted', audio.muted ? '1' : '0');
    dom.soundToggle.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    dom.soundToggle.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  });

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'KeyE') interact();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    touchInput.set(0, 0);
    touchSprint = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      touchInput.set(0, 0);
      touchSprint = false;
      audio.suspend();
    } else if (gameState === 'playing') {
      audio.resume();
      lastFrame = performance.now();
    }
  });

  if (mobile) {
    dom.controlsCopy.innerHTML = '<span><b>LEFT</b> MOVE</span><span><b>RIGHT</b> LOOK</span><span><b>RUN</b> HOLD</span>';
    let movePointer = null;
    const updateMove = (event) => {
      const rect = dom.movePad.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      const maxDistance = rect.width * 0.33;
      if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
      }
      touchInput.set(dx / maxDistance, -dy / maxDistance);
      dom.moveStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const releaseMove = (event) => {
      if (event.pointerId !== movePointer) return;
      movePointer = null;
      touchInput.set(0, 0);
      dom.moveStick.style.transform = 'translate(-50%, -50%)';
    };
    dom.movePad.addEventListener('pointerdown', (event) => {
      movePointer = event.pointerId;
      dom.movePad.setPointerCapture(event.pointerId);
      updateMove(event);
    });
    dom.movePad.addEventListener('pointermove', (event) => {
      if (event.pointerId === movePointer) updateMove(event);
    });
    dom.movePad.addEventListener('pointerup', releaseMove);
    dom.movePad.addEventListener('pointercancel', releaseMove);

    let lookPointer = null;
    let lastLookX = 0;
    let lastLookY = 0;
    const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    dom.touchLook.addEventListener('pointerdown', (event) => {
      lookPointer = event.pointerId;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      dom.touchLook.setPointerCapture(event.pointerId);
    });
    dom.touchLook.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer || gameState !== 'playing') return;
      lookEuler.setFromQuaternion(camera.quaternion);
      lookEuler.y -= (event.clientX - lastLookX) * 0.0042;
      lookEuler.x -= (event.clientY - lastLookY) * 0.0042;
      lookEuler.x = clamp(lookEuler.x, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
      camera.quaternion.setFromEuler(lookEuler);
      lastLookX = event.clientX;
      lastLookY = event.clientY;
    });
    const releaseLook = (event) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    dom.touchLook.addEventListener('pointerup', releaseLook);
    dom.touchLook.addEventListener('pointercancel', releaseLook);

    dom.touchSprint.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      touchSprint = true;
      dom.touchSprint.setPointerCapture(event.pointerId);
    });
    const releaseSprint = () => { touchSprint = false; };
    dom.touchSprint.addEventListener('pointerup', releaseSprint);
    dom.touchSprint.addEventListener('pointercancel', releaseSprint);
    dom.touchAction.addEventListener('click', interact);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, adaptiveQualityReduced ? 1 : mobile ? 1.2 : 1.5));
  });

  await renderer.compileAsync(scene, camera).catch(() => {});
  updateLights();
  dom.enterButton.focus({ preventScroll: true });
  if (qaMode) {
    beginPlay();
    if (qaAutowalk) keys.add('KeyW');
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const rawDelta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (gameState === 'playing') {
      elapsed += rawDelta;
      accumulator += rawDelta;
      frameTimeAverage = lerp(frameTimeAverage, rawDelta, 0.025);
      if (frameTimeAverage > 1 / 34) slowFrameDuration += rawDelta;
      else slowFrameDuration = Math.max(0, slowFrameDuration - rawDelta * 0.5);
      if (slowFrameDuration > 2.5) reduceQuality();
      while (accumulator >= fixedStep) {
        simulatePlayer(fixedStep);
        accumulator -= fixedStep;
      }
      updateDirector(rawDelta);
      updateExit();
      updateObjectiveAnimations(rawDelta);

      lightUpdateAt -= rawDelta;
      if (lightUpdateAt <= 0) {
        updateLights();
        lightUpdateAt = 0.34;
      }

      if (messageUntil && elapsed > messageUntil) {
        dom.message.classList.remove('is-visible');
        messageUntil = 0;
      }
      updateGrain();
      dom.game.dataset.playerCell = String(
        maze.worldToCell(playerPosition.x, playerPosition.y),
      );
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

init().catch((error) => {
  console.error(error);
  dom.unsupported.classList.add('is-visible');
});
