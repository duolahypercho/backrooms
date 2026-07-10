// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'freight-depot',
  index: 18,
  name: 'Freight Depot',
  exit: { label: 'BAY 00' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 18',
    status: 'NIGHT MANIFEST UNRECONCILED',
    start: {
      kicker: 'CROSS-DOCK TERMINAL / SHIFT NEVER ENDED',
      title: 'THE CARGO<br />BREATHES IN CRATES.',
      body: 'Seat three loading relays. Never stand between a pallet and the bay marked 00.',
      button: 'ENTER LEVEL 18',
    },
    pause: {
      kicker: 'CONVEYOR HOLD ACTIVE',
      title: 'DO NOT SIGN<br />THE MANIFEST.',
      body: 'The forklift alarm is getting closer without changing direction.',
      button: 'RESUME SHIFT',
    },
    death: {
      kicker: 'SHIPMENT RECEIVED',
      title: 'CONTENTS<br />UNDECLARED.',
      body: 'A crate with your dimensions has been added to the outbound lane.',
      button: 'REOPEN PACKAGE',
    },
    win: {
      kicker: 'BAY ZERO RELEASED',
      title: 'THE TRAILER<br />IS A STAIRWELL.',
      body: 'Rows of archive shelving descend beyond the loading seal with no visible floor.',
      button: 'DESCEND TO LEVEL 19',
    },
  },
  maze: {
    desktop: { cols: 29, rows: 21 },
    mobile: { cols: 21, rows: 17 },
    loopRatio: 0.27,
    roomDivisor: 34,
    minimumRooms: 11,
    roomSize: { min: 3, max: 6 },
    seedSalt: 0xe2684fa3,
  },
  surfaces: {
    wall: {
      base: [107, 111, 104], accent: [72, 78, 74], grime: [36, 38, 35],
      pattern: 'painted-concrete', roughness: 0.84, metalness: 0.05, bumpScale: 0.06,
      grimeOpacity: 0.27,
    },
    floor: {
      base: [76, 78, 72], accent: [102, 91, 63], grime: [33, 34, 31],
      pattern: 'oil-stained-concrete', roughness: 0.75, metalness: 0.08, bumpScale: 0.045,
    },
    ceiling: {
      base: [84, 89, 87], accent: [57, 64, 63], grime: [31, 35, 35],
      pattern: 'corrugated-service', roughness: 0.72, metalness: 0.19, bumpScale: 0.055,
      emissive: 0x242821, emissiveIntensity: 0.17,
    },
    trim: { color: 0x5b5d51, roughness: 0.66, metalness: 0.31 },
  },
  fog: { color: 0x373b34, density: { desktop: 0.029, mobile: 0.036 } },
  lighting: {
    exposure: 0.84,
    hemisphere: {
      sky: 0xc4c99b, ground: 0x181b16,
      intensity: { desktop: 0.47, mobile: 0.55 },
    },
    ambient: { color: 0x777a58, intensity: { desktop: 0.17, mobile: 0.24 } },
    fixture: {
      color: 0xe7e8ad, panelColor: 0xf0efb7, deadPanelColor: 0x474a3e,
      intensity: 98, distance: 13.4, angle: 1.27, penumbra: 0.81, decay: 2,
      brokenChance: 0.19, pool: { desktop: 8, mobile: 4 },
      flicker: { idleRate: 5.1, idleDepth: 0.04, faultFloor: 0.016, recovery: 0.36 },
    },
  },
  audio: {
    drips: false,
    masterGain: 0.78,
    humGain: 0.071,
    oscillators: [
      { frequency: 42, type: 'sine', gain: 0.29 },
      { frequency: 84, type: 'sawtooth', gain: 0.041 },
      { frequency: 21, type: 'sine', gain: 0.18 },
      { frequency: 168, type: 'triangle', gain: 0.015 },
    ],
    noise: { filter: 'bandpass', frequency: 590, q: 0.67, gain: 0.047 },
    heartbeat: { startFrequency: 57, endFrequency: 30 },
    impact: { startFrequency: 34, endFrequency: 11 },
    footstep: { walkLowpass: 330, runLowpass: 440 },
    ambience: {
      interval: [9, 21], cues: ['loading-bell', 'chain-drag', 'forklift-knock', 'air-brake-breath'],
      stereoWidth: 0.96, silenceChance: 0.17,
    },
  },
  objective: {
    type: 'fuse', count: 3, color: 0xd9d85e,
    labels: {
      hud: 'POWER BAY ZERO', item: 'LOADING RELAY', itemPlural: 'LOADING RELAYS',
      interact: 'E  SEAT RELAY', progress: 'RELAYS {current}/{total}',
      locked: 'BAY ZERO WILL NOT RELEASE', complete: 'DOCK POWER STABLE / FIND BAY ZERO',
    },
  },
  props: [
    { type: 'service-crate', density: 0.035, color: 0x7d704e, accent: 0x3b3323, cluster: [2, 6] },
    { type: 'oil-drum', density: 0.022, color: 0x526159, accent: 0xb27b2d, cluster: [1, 4] },
    { type: 'square-column', density: 0.014, color: 0x7f8175, accent: 0x45483f, cluster: [1, 2] },
    { type: 'hanging-chain', density: 0.068, color: 0x555d59, accent: 0x252a27, cluster: [1, 5] },
    { type: 'cable-tray', density: 0.055, color: 0x434946, accent: 0x1d211f, cluster: [2, 5] },
  ],
  incidents: {
    density: 0.017, minCount: 3, maxCount: 9, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.2, 'abandoned-pack': 2.2, 'chair-pile': 0.45,
      'black-motes': 0.9, 'shoe-trail': 1.35,
    },
    palette: { cloth: 0x444a42, clothLight: 0x7b806f, motes: 0x080a07 },
  },
  atmosphere: {
    identity: 'unending-night-freight-crossdock',
    cadence: { first: [9, 17], interval: [13, 25] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'manifest', text: 'OUTBOUND: 1 PERSON / WEIGHT: INCREASING', density: 0.008, placement: 'wall' },
      { id: 'lane-mark', text: 'BAY 00 ← DO NOT LOAD LIVING CARGO', density: 0.009, placement: 'floor' },
      { id: 'relay-tag', text: 'NIGHT SHIFT ENDED 14,227 HOURS AGO', density: 0.004, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'conveyor-reverse', progress: 0.33, message: 'EVERY CONVEYOR ROLLS BACKWARD',
        duration: 1.16, cue: 'chain-drag', effect: { flicker: 0.48 },
      },
      {
        id: 'crate-knock', progress: 0.66, message: 'SOMETHING KNOCKS FROM INSIDE THE NEAREST CRATE',
        duration: 1.23, cue: 'forklift-knock', effect: { silence: 0.7 },
      },
    ],
    events: [
      {
        id: 'forklift-reverse', earliest: 7, weight: 1.22, maxRepeats: 3,
        tension: [0.03, 0.86], message: 'A FORKLIFT ALARM PASSES THROUGH THE WALL',
        duration: 1.08, cue: 'loading-bell', pan: 'random',
      },
      {
        id: 'pallet-settle', earliest: 16, weight: 0.98, maxRepeats: 2,
        tension: [0.1, 0.82], message: 'A PALLET SETTLES UNDER INVISIBLE WEIGHT',
        duration: 1.12, cue: 'forklift-knock', pan: 'random',
      },
      {
        id: 'trailer-brake', earliest: 25, weight: 0.72, maxRepeats: 2,
        tension: [0.17, 0.88], message: 'AIR BRAKES EXHALE BEHIND A CLOSED BAY',
        duration: 1.18, cue: 'air-brake-breath', effect: { glitch: 0.25 },
      },
      {
        id: 'shift-bell', earliest: 38, weight: 0.52, maxRepeats: 1,
        tension: [0.26, 0.92], message: 'THE SHIFT BELL RINGS FOR NO WORKERS',
        duration: 1.26, cue: 'loading-bell', effect: { silence: 1.2, flicker: 0.88 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xf4edb5, intensity: 61, distance: 20, angle: 0.39,
      drainPerSecond: 0.0064, emergencyRechargePerSecond: 0.0018, flashCost: 0.32,
    },
  },
  evidence: {
    recharge: 0.27,
    entries: [
      'MANIFEST 08 / THE SAME CRATE ARRIVES AT BOTH DOORS',
      'MANIFEST 14 / DRIVER SIGNATURE MATCHES THE RECEIVER',
      'MANIFEST 23 / BAY ZERO SHIPS EVERYTHING DOWNWARD',
    ],
  },
  monster: {
    name: 'The Loader',
    identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.44, twitchStrength: 0.68 },
    sound: { breathPitch: 0.75, breathWeight: 0.91, stepWeight: 1.24, drag: 0.36 },
    skin: {
      type: 'maintenance-husk', body: 0x0b0d0a, accent: 0x77742c,
      eye: 0xe7df66, emissiveIntensity: 1.36, scale: 1.17,
    },
    timing: {
      firstScare: [10, 18], scareInterval: [13, 24], firstChase: [42, 59],
      glimpseDuration: 1.08, stalkDuration: 21,
      pathRefresh: { stalk: 0.58, chase: 0.28 },
    },
    behavior: {
      sight: { range: 23, peripheralDot: 0.18, acquireRate: 1.42, threshold: 0.42 },
      hearing: { baseCells: 4, noiseCells: 12, chaseNoise: 0.64, reacquireNoise: 0.36 },
      chase: { lostSightDelay: 6, searchDuration: [10, 15], recovery: [16, 25] },
      wanderCells: [4, 9],
    },
    speeds: { watched: 0.39, stalk: 1.28, chase: 3.58 },
    stalkTriggerDistance: 11.5,
    catchDistance: 0.96,
  },
};
