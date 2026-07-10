// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'indoor-pool',
  index: 14,
  name: 'Indoor Pool',
  exit: { label: 'DEEP END' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 14',
    status: 'FILTRATION LOOP UNSTABLE',
    start: {
      kicker: 'MUNICIPAL NATATORIUM / AFTER HOURS',
      title: 'THE WATER<br />HAS NO BOTTOM.',
      body: 'Open four filtration valves. The lane ropes move even when the surface is still.',
      button: 'ENTER LEVEL 14',
    },
    pause: {
      kicker: 'LIFEGUARD SIGNAL LOST',
      title: 'STAY OUT<br />OF THE LANES.',
      body: 'A wet handprint is spreading across the inside of your screen.',
      button: 'SURFACE',
    },
    death: {
      kicker: 'DROWNING REPORT FILED',
      title: 'NO WATER<br />IN YOUR LUNGS.',
      body: 'The pool log records your final lap before you arrived.',
      button: 'RESUSCITATE',
    },
    win: {
      kicker: 'DRAIN GATE RELEASED',
      title: 'THE DEEP END<br />OPENS DOWN.',
      body: 'The tiled steps continue beneath the drained basin into a dark projection booth.',
      button: 'DESCEND TO LEVEL 15',
    },
  },
  maze: {
    desktop: { cols: 25, rows: 19 },
    mobile: { cols: 19, rows: 15 },
    loopRatio: 0.31,
    roomDivisor: 38,
    minimumRooms: 9,
    roomSize: { min: 3, max: 6 },
    seedSalt: 0x6f2a14c1,
  },
  surfaces: {
    wall: {
      base: [166, 192, 187], accent: [86, 142, 139], grime: [36, 74, 72],
      pattern: 'glazed-pool-tile', roughness: 0.31, metalness: 0.03, bumpScale: 0.025,
      grimeOpacity: 0.24,
    },
    floor: {
      base: [124, 162, 160], accent: [62, 118, 122], grime: [28, 62, 66],
      pattern: 'flooded-pool-tile', roughness: 0.27, metalness: 0.04, bumpScale: 0.018,
    },
    ceiling: {
      base: [116, 142, 144], accent: [74, 108, 112], grime: [38, 64, 68],
      pattern: 'dripping-concrete', roughness: 0.79, metalness: 0.03, bumpScale: 0.052,
      emissive: 0x183238, emissiveIntensity: 0.18,
    },
    trim: { color: 0x356f73, roughness: 0.43, metalness: 0.16 },
  },
  fog: { color: 0x315b60, density: { desktop: 0.032, mobile: 0.039 } },
  lighting: {
    exposure: 0.86,
    hemisphere: {
      sky: 0xa7d9d2, ground: 0x12282b,
      intensity: { desktop: 0.53, mobile: 0.61 },
    },
    ambient: { color: 0x5faaa8, intensity: { desktop: 0.21, mobile: 0.28 } },
    fixture: {
      color: 0xd8fff4, panelColor: 0xe1fff8, deadPanelColor: 0x315254,
      intensity: 104, distance: 12.6, angle: 1.24, penumbra: 0.88, decay: 2,
      brokenChance: 0.17, pool: { desktop: 7, mobile: 4 },
      flicker: { idleRate: 3.1, idleDepth: 0.045, faultFloor: 0.018, recovery: 0.39 },
    },
  },
  audio: {
    drips: true,
    masterGain: 0.74,
    humGain: 0.052,
    oscillators: [
      { frequency: 47, type: 'sine', gain: 0.25 },
      { frequency: 94, type: 'triangle', gain: 0.046 },
      { frequency: 23, type: 'sine', gain: 0.16 },
      { frequency: 188, type: 'sine', gain: 0.012 },
    ],
    noise: { filter: 'lowpass', frequency: 310, q: 0.62, gain: 0.044 },
    heartbeat: { startFrequency: 58, endFrequency: 31 },
    impact: { startFrequency: 39, endFrequency: 13 },
    footstep: { walkLowpass: 205, runLowpass: 275 },
    ambience: {
      interval: [8, 19], cues: ['water-slap', 'drain-breath', 'tile-knock', 'distant-splash'],
      stereoWidth: 0.98, silenceChance: 0.14,
    },
  },
  objective: {
    type: 'valve', count: 4, color: 0x71e3d1,
    labels: {
      hud: 'DRAIN THE IMPOSSIBLE POOL', item: 'FILTER VALVE', itemPlural: 'FILTER VALVES',
      interact: 'E  OPEN FILTER VALVE', progress: 'VALVES {current}/{total}',
      locked: 'THE DEEP END IS STILL FULL', complete: 'WATER RECEDING / FIND THE DEEP END',
    },
  },
  props: [
    { type: 'standing-water', density: 0.19, color: 0x285f67, accent: 0x89d7d2, cluster: [3, 8] },
    { type: 'drain-grate', density: 0.045, color: 0x315258, accent: 0x142a2e, cluster: [1, 3] },
    { type: 'wall-pipe', density: 0.074, color: 0x587f7e, accent: 0x284545, cluster: [2, 5] },
    { type: 'pool-bench', density: 0.014, color: 0xe4d6a3, accent: 0x6c674d, cluster: [1, 3] },
    { type: 'square-column', density: 0.018, color: 0x9ac7c0, accent: 0x4c7c79, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.019, minCount: 3, maxCount: 9, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 0.7, 'abandoned-pack': 0.5, 'chair-pile': 0.8,
      'black-motes': 1.2, 'shoe-trail': 2.1,
    },
    palette: { cloth: 0x2d5c61, clothLight: 0x72aaa6, motes: 0x061415 },
  },
  atmosphere: {
    identity: 'bottomless-municipal-natatorium',
    cadence: { first: [9, 16], interval: [13, 24] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'pool-rule', text: 'RULE 7 / DO NOT ACKNOWLEDGE THE LIFEGUARD', density: 0.008, placement: 'wall' },
      { id: 'depth-mark', text: 'DEPTH: 1.8m / CURRENT DEPTH: UNRESOLVED', density: 0.009, placement: 'floor' },
      { id: 'filter-tag', text: 'FILTER RETURN CONTAINS HUMAN HAIR', density: 0.005, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'lane-turn', progress: 0.25, message: 'EVERY LANE ROPE TURNS TOWARD YOU',
        duration: 1.15, cue: 'water-slap', effect: { flicker: 0.45 },
      },
      {
        id: 'pool-empty', progress: 0.75, message: 'THE WATER DRAINS WITHOUT LOWERING',
        duration: 1.25, cue: 'drain-breath', effect: { silence: 0.8, glitch: 0.28 },
      },
    ],
    events: [
      {
        id: 'starting-block', earliest: 7, weight: 1.2, maxRepeats: 3,
        tension: [0.03, 0.86], message: 'A STARTING BLOCK CREAKS BEHIND YOU',
        duration: 1.05, cue: 'tile-knock', pan: 'random',
      },
      {
        id: 'underwater-whistle', earliest: 16, weight: 0.92, maxRepeats: 2,
        tension: [0.1, 0.82], message: 'A WHISTLE SOUNDS FROM UNDER THE TILE',
        duration: 1.12, cue: 'drain-breath', effect: { glitch: 0.2 },
      },
      {
        id: 'wet-steps', earliest: 24, weight: 0.8, maxRepeats: 2,
        tension: [0.16, 0.9], message: 'WET FOOTSTEPS CROSS THE DRY DECK',
        duration: 1.18, cue: 'distant-splash', pan: 'random',
      },
      {
        id: 'surface-still', earliest: 34, weight: 0.58, maxRepeats: 1,
        tension: [0.24, 0.88], message: 'THE SURFACE BECOMES PERFECTLY STILL',
        duration: 1.25, cue: 'water-dropout', effect: { silence: 1.5, flicker: 0.8 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xc7fff0, intensity: 62, distance: 20.5, angle: 0.37,
      drainPerSecond: 0.0062, emergencyRechargePerSecond: 0.0019, flashCost: 0.31,
    },
  },
  evidence: {
    recharge: 0.29,
    entries: [
      'POOL LOG 03 / THE DRAIN RETURNS MORE WATER THAN IT TAKES',
      'POOL LOG 11 / CAMERA TWO SHOWS A SWIMMER BELOW THE FLOOR',
      'POOL LOG 18 / THE LIFEGUARD CHAIR HAS NEVER BEEN EMPTY',
    ],
  },
  monster: {
    name: 'The Lifeguard',
    identity: 'wader',
    presentation: { silhouette: 'waterlogged-dragger', eyePulse: 0.48, twitchStrength: 0.62 },
    sound: { breathPitch: 0.58, breathWeight: 1.08, stepWeight: 0.84, drag: 0.72 },
    skin: {
      type: 'waterlogged-longlimb', body: 0x071416, accent: 0x3a7f7d,
      eye: 0xa9fff1, emissiveIntensity: 0.74, scale: 1.18,
    },
    timing: {
      firstScare: [9, 17], scareInterval: [12, 23], firstChase: [40, 57],
      glimpseDuration: 1.18, stalkDuration: 21,
      pathRefresh: { stalk: 0.54, chase: 0.27 },
    },
    behavior: {
      sight: { range: 17.5, peripheralDot: 0.12, acquireRate: 1.47, threshold: 0.41 },
      hearing: { baseCells: 4, noiseCells: 14, chaseNoise: 0.59, reacquireNoise: 0.34 },
      chase: { lostSightDelay: 6.3, searchDuration: [10, 16], recovery: [15, 24] },
      wanderCells: [4, 9],
    },
    speeds: { watched: 0.48, stalk: 1.32, chase: 3.68 },
    stalkTriggerDistance: 11.8,
    catchDistance: 0.97,
  },
};
