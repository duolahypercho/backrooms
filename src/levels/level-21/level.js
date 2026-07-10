// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'data-center-annex',
  index: 21,
  name: 'Data Center Annex',
  exit: { label: 'CORE LIFT' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 21',
    status: 'ANNEX REPLICATING OUT OF BOUNDS',
    start: {
      kicker: 'EDGE FACILITY / TENANT UNKNOWN',
      title: 'THE SERVERS<br />DREAM IN YOUR VOICE.',
      body: 'Seat five uplink batteries. Never follow a status light blinking at your pulse.',
      button: 'ENTER LEVEL 21',
    },
    pause: {
      kicker: 'SESSION HIBERNATED',
      title: 'THE PROCESS<br />KEEPS RUNNING.',
      body: 'Cooling fans are spelling your login in bursts of warm air.',
      button: 'RESTORE SESSION',
    },
    death: {
      kicker: 'USER STATE SERIALIZED',
      title: 'BODY<br />NOT REQUIRED.',
      body: 'Your heat signature persists in every rack after the camera goes cold.',
      button: 'RESTORE BACKUP',
    },
    win: {
      kicker: 'CORE LIFT AUTHORIZED',
      title: 'THE NETWORK<br />CONTINUES BELOW.',
      body: 'The lift doors open over a shaft lit by a single signal descending into Level 22.',
      button: 'DESCEND TO LEVEL 22',
    },
  },
  maze: {
    desktop: { cols: 31, rows: 23 },
    mobile: { cols: 23, rows: 17 },
    loopRatio: 0.24,
    roomDivisor: 46,
    minimumRooms: 9,
    roomSize: { min: 2, max: 4 },
    seedSalt: 0x2d97f6b8,
  },
  surfaces: {
    wall: {
      base: [57, 69, 78], accent: [35, 50, 62], grime: [18, 28, 35],
      pattern: 'sealed-service-panel', roughness: 0.68, metalness: 0.16, bumpScale: 0.047,
      grimeOpacity: 0.18,
    },
    floor: {
      base: [42, 49, 56], accent: [30, 39, 49], grime: [19, 25, 31],
      pattern: 'raised-access-tile', roughness: 0.58, metalness: 0.24, bumpScale: 0.032,
    },
    ceiling: {
      base: [48, 59, 68], accent: [31, 43, 53], grime: [17, 25, 31],
      pattern: 'service-slab', roughness: 0.7, metalness: 0.17, bumpScale: 0.043,
      emissive: 0x0e2231, emissiveIntensity: 0.3,
    },
    trim: { color: 0x2a4455, roughness: 0.57, metalness: 0.36 },
  },
  fog: { color: 0x152b3a, density: { desktop: 0.034, mobile: 0.041 } },
  lighting: {
    exposure: 0.89,
    hemisphere: {
      sky: 0x78bfe8, ground: 0x09131b,
      intensity: { desktop: 0.52, mobile: 0.6 },
    },
    ambient: { color: 0x356f95, intensity: { desktop: 0.2, mobile: 0.28 } },
    fixture: {
      color: 0xa8ddff, panelColor: 0xb9e5ff, deadPanelColor: 0x273d4b,
      intensity: 102, distance: 11.7, angle: 1.19, penumbra: 0.84, decay: 2,
      brokenChance: 0.22, pool: { desktop: 7, mobile: 4 },
      flicker: { idleRate: 8.1, idleDepth: 0.046, faultFloor: 0.014, recovery: 0.33 },
    },
  },
  audio: {
    drips: false,
    masterGain: 0.76,
    humGain: 0.083,
    oscillators: [
      { frequency: 46, type: 'sine', gain: 0.26 },
      { frequency: 92, type: 'sawtooth', gain: 0.037 },
      { frequency: 23, type: 'sine', gain: 0.16 },
      { frequency: 184, type: 'square', gain: 0.012 },
    ],
    noise: { filter: 'bandpass', frequency: 760, q: 0.92, gain: 0.043 },
    heartbeat: { startFrequency: 64, endFrequency: 35 },
    impact: { startFrequency: 47, endFrequency: 15 },
    footstep: { walkLowpass: 370, runLowpass: 490 },
    ambience: {
      interval: [10, 22], cues: ['relay-chatter', 'machine-dropout', 'fan-breath', 'access-bell'],
      stereoWidth: 0.93, silenceChance: 0.21,
    },
  },
  objective: {
    type: 'fuse', count: 5, color: 0x62c8ff,
    labels: {
      hud: 'RESTORE THE CORE UPLINK', item: 'UPLINK BATTERY', itemPlural: 'UPLINK BATTERIES',
      interact: 'E  SEAT BATTERY', progress: 'BATTERIES {current}/{total}',
      locked: 'THE CORE LIFT DENIES OFFLINE USERS', complete: 'UPLINK SYNCHRONIZED / FIND THE CORE LIFT',
    },
  },
  props: [
    { type: 'cable-tray', density: 0.12, color: 0x263c49, accent: 0x0f1c24, cluster: [3, 7] },
    { type: 'ceiling-vent', density: 0.061, color: 0x344b58, accent: 0x14242d, cluster: [1, 4] },
    { type: 'server-rack', density: 0.026, color: 0x445664, accent: 0x1e2c35, cluster: [1, 3] },
    { type: 'square-column', density: 0.019, color: 0x38505e, accent: 0x182832, cluster: [1, 2] },
    { type: 'wall-pipe', density: 0.047, color: 0x334955, accent: 0x16242b, cluster: [2, 4] },
  ],
  incidents: {
    density: 0.016, minCount: 3, maxCount: 8, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 0.55, 'abandoned-pack': 1.65, 'chair-pile': 0.35,
      'black-motes': 2.4, 'shoe-trail': 1.05,
    },
    palette: { cloth: 0x1d303b, clothLight: 0x3c5968, motes: 0x02080c },
  },
  atmosphere: {
    identity: 'self-replicating-edge-compute-annex',
    cadence: { first: [9, 17], interval: [13, 24] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'tenant-id', text: 'TENANT ID: YOUR HEART RATE', density: 0.008, placement: 'wall' },
      { id: 'packet-route', text: 'UPLINK ROUTE ↓ PHYSICAL LAYER', density: 0.007, placement: 'floor' },
      { id: 'battery-tag', text: 'BACKUP RETAINS THE LAST LIVING USER', density: 0.005, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'led-pulse', progress: 0.2, message: 'STATUS LIGHTS MATCH YOUR HEARTBEAT',
        duration: 1.14, cue: 'relay-chatter', effect: { glitch: 0.24 },
      },
      {
        id: 'fans-stop', progress: 0.6, message: 'EVERY COOLING FAN STOPS TO LISTEN',
        duration: 1.24, cue: 'machine-dropout', effect: { silence: 1.1, flicker: 0.58 },
      },
    ],
    events: [
      {
        id: 'rack-wake', earliest: 7, weight: 1.22, maxRepeats: 3,
        tension: [0.03, 0.86], message: 'A DARK RACK BOOTS AS YOU PASS',
        duration: 1.07, cue: 'relay-chatter', pan: 'random',
      },
      {
        id: 'fan-language', earliest: 16, weight: 0.95, maxRepeats: 2,
        tension: [0.1, 0.84], message: 'THE FANS SPEAK IN BURSTS OF WARM AIR',
        duration: 1.14, cue: 'fan-breath', effect: { glitch: 0.32 },
      },
      {
        id: 'badge-accepted', earliest: 25, weight: 0.72, maxRepeats: 2,
        tension: [0.18, 0.88], message: 'A BADGE READER ACCEPTS YOUR SHADOW',
        duration: 1.18, cue: 'access-bell', pan: 'random',
      },
      {
        id: 'annex-copy', earliest: 39, weight: 0.5, maxRepeats: 1,
        tension: [0.28, 0.94], message: 'AN IDENTICAL AISLE APPEARS INSIDE THE RACK',
        duration: 1.3, cue: 'machine-dropout', effect: { glitch: 0.7, silence: 1.3, flicker: 0.82 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xbce6ff, intensity: 62, distance: 20.2, angle: 0.37,
      drainPerSecond: 0.0063, emergencyRechargePerSecond: 0.0019, flashCost: 0.31,
    },
  },
  evidence: {
    recharge: 0.29,
    entries: [
      'UPLINK 07 / PACKETS RETURN WITH BODY TEMPERATURE',
      'UPLINK 16 / THE BACKUP CONTAINS MEMORIES NOT YET FORMED',
      'UPLINK 25 / THE CORE LIFT IS LISTED AS A NETWORK DEVICE',
    ],
  },
  monster: {
    name: 'The Mirror Process',
    identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.88, twitchStrength: 1.04 },
    sound: { breathPitch: 0.91, breathWeight: 0.82, stepWeight: 1.08, drag: 0.11 },
    skin: {
      type: 'maintenance-husk', body: 0x050a0e, accent: 0x246c99,
      eye: 0x6ed1ff, emissiveIntensity: 2.4, scale: 1.09,
    },
    timing: {
      firstScare: [10, 18], scareInterval: [12, 24], firstChase: [44, 61],
      glimpseDuration: 1.1, stalkDuration: 23,
      pathRefresh: { stalk: 0.6, chase: 0.29 },
    },
    behavior: {
      sight: { range: 26, peripheralDot: 0.19, acquireRate: 1.4, threshold: 0.42 },
      hearing: { baseCells: 3, noiseCells: 12, chaseNoise: 0.65, reacquireNoise: 0.37 },
      chase: { lostSightDelay: 5.9, searchDuration: [9, 15], recovery: [17, 27] },
      wanderCells: [3, 8],
    },
    speeds: { watched: 0.37, stalk: 1.26, chase: 3.56 },
    stalkTriggerDistance: 11.3,
    catchDistance: 0.95,
  },
};
