/**
 * DOCUMENTATION TEMPLATE — NOT AUTO-LOADED.
 *
 * Copy a complete working sibling for production. This compact skeleton is a
 * checklist of required sections. To activate it, fill every TODO and copy it
 * to either `my-level/level.js` or `my-level.level.js` (never both).
 */
export default {
  id: 'todo-level-slug',
  index: -1, // TODO: next contiguous campaign index.
  name: 'TODO Level Name',
  exit: { label: 'EXIT' },

  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL TODO',
    status: 'TODO STATUS',
    start: { kicker: 'TODO', title: 'TODO<br />TITLE.', body: 'TODO', button: 'ENTER' },
    pause: { kicker: 'TODO', title: 'TODO<br />PAUSE.', body: 'TODO', button: 'CONTINUE' },
    death: { kicker: 'TODO', title: 'TODO<br />DEATH.', body: 'TODO', button: 'RETRY' },
    win: { kicker: 'TODO', title: 'TODO<br />EXIT.', body: 'TODO', button: 'CONTINUE' },
  },

  maze: {
    desktop: { cols: 21, rows: 21 },
    mobile: { cols: 17, rows: 17 },
    loopRatio: 0.2,
    roomDivisor: 48,
    minimumRooms: 8,
    roomSize: { min: 2, max: 4 },
    seedSalt: 0x12345678, // TODO: replace with a stable level-specific salt.
  },

  surfaces: {
    wall: {
      base: [160, 155, 100], accent: [120, 116, 72], grime: [45, 43, 30],
      pattern: 'aged-wallpaper', roughness: 0.95, metalness: 0, bumpScale: 0.05,
      grimeOpacity: 0.19,
    },
    floor: {
      base: [80, 75, 48], accent: [60, 55, 35], grime: [35, 34, 24],
      pattern: 'damp-carpet', roughness: 1, metalness: 0, bumpScale: 0.06,
    },
    ceiling: {
      base: [170, 168, 142], accent: [140, 137, 115], grime: [85, 82, 65],
      pattern: 'acoustic-tile', roughness: 0.93, metalness: 0, bumpScale: 0.035,
      emissive: 0x292719, emissiveIntensity: 0.25,
    },
    trim: { color: 0x665f3d, roughness: 0.9, metalness: 0 },
  },

  fog: { color: 0x5f5b42, density: { desktop: 0.03, mobile: 0.036 } },
  lighting: {
    exposure: 0.82,
    hemisphere: { sky: 0xd0c67f, ground: 0x222113, intensity: { desktop: 0.58, mobile: 0.64 } },
    ambient: { color: 0x837b4c, intensity: { desktop: 0.2, mobile: 0.27 } },
    fixture: {
      color: 0xffefad, panelColor: 0xfff0b0, deadPanelColor: 0x444333,
      intensity: 90, distance: 11, angle: 1.2, penumbra: 0.9, decay: 2,
      brokenChance: 0.12, pool: { desktop: 6, mobile: 3 },
      flicker: { idleRate: 4, idleDepth: 0.03, faultFloor: 0.02, recovery: 0.25 },
    },
  },

  audio: {
    drips: false,
    masterGain: 0.7,
    humGain: 0.06,
    oscillators: [{ frequency: 60, type: 'sine', gain: 0.2 }],
    noise: { filter: 'bandpass', frequency: 600, q: 0.5, gain: 0.03 },
    heartbeat: { startFrequency: 64, endFrequency: 36 },
    impact: { startFrequency: 50, endFrequency: 18 },
    footstep: { walkLowpass: 240, runLowpass: 310 },
    ambience: {
      interval: [10, 22], cues: ['distant-knock'], stereoWidth: 0.8, silenceChance: 0.25,
    },
  },

  objective: {
    type: 'none', count: 0, color: 0x86a77d,
    labels: {
      hud: 'FIND A WAY OUT', item: '', itemPlural: '', interact: 'E  OPEN',
      progress: '', locked: '', complete: 'EXIT LOCATED',
    },
  },
  props: [
    { type: 'square-column', density: 0.03, color: 0x99905a, accent: 0x625c3a, cluster: [1, 3] },
  ],
  incidents: {
    density: 0.012,
    minCount: 1,
    maxCount: 6,
    minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 0.5,
      'abandoned-pack': 1,
      'chair-pile': 1,
      'black-motes': 0.7,
      'shoe-trail': 1,
    },
  },

  atmosphere: {
    identity: 'todo-atmosphere',
    cadence: { first: [10, 16], interval: [16, 28] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'todo-sign', text: 'TODO ENVIRONMENTAL STORY', density: 0.006, placement: 'wall' },
    ],
    milestones: [],
    events: [
      {
        id: 'todo-incident', earliest: 15, weight: 1, maxRepeats: 1,
        tension: [0.1, 0.8], message: 'TODO INCIDENT MESSAGE', duration: 1.1,
        cue: 'distant-knock', effect: { flicker: 0.5 },
      },
    ],
  },

  equipment: {
    flashlight: {
      color: 0xffe7a0, intensity: 48, distance: 17, angle: 0.44,
      drainPerSecond: 0.005, emergencyRechargePerSecond: 0.002, flashCost: 0.28,
    },
  },
  evidence: {
    recharge: 0.3,
    entries: ['TODO ARCHIVE 01', 'TODO ARCHIVE 02', 'TODO ARCHIVE 03'],
  },

  monster: {
    name: 'TODO Entity',
    identity: 'still', // TODO: use a supported identity or add runtime support.
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0, twitchStrength: 1 },
    sound: { breathPitch: 0.6, breathWeight: 0.5, stepWeight: 0.7, drag: 0.2 },
    skin: {
      type: 'faceless-shadow', body: 0x050604, accent: 0x11130f,
      eye: null, emissiveIntensity: 0, scale: 1,
    },
    timing: {
      firstScare: [10, 16], scareInterval: [14, 26], firstChase: [38, 52],
      glimpseDuration: 1.2, stalkDuration: 18, pathRefresh: { stalk: 0.8, chase: 0.35 },
    },
    behavior: {
      sight: { range: 22, peripheralDot: 0.25, acquireRate: 1.1, threshold: 0.5 },
      hearing: { baseCells: 2, noiseCells: 8, chaseNoise: 0.8, reacquireNoise: 0.45 },
      chase: { lostSightDelay: 5, searchDuration: [7, 12], recovery: [15, 24] },
      wanderCells: [3, 7],
    },
    speeds: { watched: 0.25, stalk: 1.2, chase: 3.4 },
    stalkTriggerDistance: 11,
    catchDistance: 0.9,
  },
};
