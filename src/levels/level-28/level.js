// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'concrete-megastructure',
  index: 28,
  name: 'Concrete Megastructure',
  exit: { label: 'CORE SHAFT' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 28',
    status: 'STRUCTURE STILL EXPANDING',
    start: {
      kicker: 'FOUNDATION COMPLEX / DATUM LOST',
      title: 'THE BUILDING<br />HAS NO OUTSIDE.',
      body: 'Open four pressure valves. Every stairwell returns lower than the floor where it began.',
      button: 'ENTER LEVEL 28',
    },
    pause: {
      kicker: 'POUR SEQUENCE HELD',
      title: 'THE CONCRETE<br />IS STILL CURING.',
      body: 'Rebar clicks in the walls like teeth cooling after a meal.',
      button: 'CONTINUE DESCENT',
    },
    death: {
      kicker: 'VOID FILLED',
      title: 'LOAD<br />TRANSFERRED.',
      body: 'The structure measured your absence and closed around it.',
      button: 'BREAK FORMWORK',
    },
    win: {
      kicker: 'CORE SHAFT UNSEALED',
      title: 'THE FOUNDATION<br />HAS A HEART.',
      body: 'A final lift drops toward a light older than every level above it.',
      button: 'DESCEND TO LEVEL 29',
    },
  },
  maze: {
    desktop: { cols: 31, rows: 27 },
    mobile: { cols: 21, rows: 19 },
    loopRatio: 0.15,
    roomDivisor: 68,
    minimumRooms: 7,
    roomSize: { min: 3, max: 6 },
    seedSalt: 0x17c2ef28,
  },
  surfaces: {
    wall: {
      base: [112, 114, 109], accent: [75, 78, 74], grime: [37, 39, 37],
      pattern: 'seeping-concrete', roughness: 0.94, metalness: 0.01, bumpScale: 0.078,
      grimeOpacity: 0.27,
    },
    floor: {
      base: [83, 85, 82], accent: [57, 59, 57], grime: [31, 32, 31],
      pattern: 'oil-stained-concrete', roughness: 0.86, metalness: 0.02, bumpScale: 0.055,
    },
    ceiling: {
      base: [95, 98, 94], accent: [63, 66, 63], grime: [34, 36, 34],
      pattern: 'service-slab', roughness: 0.96, metalness: 0.02, bumpScale: 0.074,
      emissive: 0x20221f, emissiveIntensity: 0.13,
    },
    trim: { color: 0x4f5450, roughness: 0.69, metalness: 0.3 },
  },
  fog: { color: 0x3f423f, density: { desktop: 0.044, mobile: 0.051 } },
  lighting: {
    exposure: 0.72,
    hemisphere: { sky: 0xbfc4ba, ground: 0x151715, intensity: { desktop: 0.39, mobile: 0.47 } },
    ambient: { color: 0x6c716a, intensity: { desktop: 0.16, mobile: 0.23 } },
    fixture: {
      color: 0xf0e6c8, panelColor: 0xfff2d4, deadPanelColor: 0x363733,
      intensity: 74, distance: 10.8, angle: 1.05, penumbra: 0.92, decay: 2,
      brokenChance: 0.32, pool: { desktop: 5, mobile: 3 },
      flicker: { idleRate: 2.3, idleDepth: 0.055, faultFloor: 0.008, recovery: 0.46 },
    },
  },
  audio: {
    drips: true, masterGain: 0.82, humGain: 0.06,
    oscillators: [
      { frequency: 32, type: 'sine', gain: 0.34 },
      { frequency: 64, type: 'triangle', gain: 0.045 },
      { frequency: 16, type: 'sine', gain: 0.2 },
    ],
    noise: { filter: 'lowpass', frequency: 210, q: 0.45, gain: 0.048 },
    heartbeat: { startFrequency: 53, endFrequency: 28 },
    impact: { startFrequency: 31, endFrequency: 10 },
    footstep: { walkLowpass: 175, runLowpass: 235 },
    ambience: {
      interval: [8, 19],
      cues: ['pressure-groan', 'sub-bass-bump', 'pipe-knock', 'machine-dropout'],
      stereoWidth: 0.99,
      silenceChance: 0.15,
    },
  },
  objective: {
    type: 'valve', count: 4, color: 0xb08a58,
    labels: {
      hud: 'CORE SHAFT PRESSURIZED', item: 'RELIEF VALVE', itemPlural: 'RELIEF VALVES',
      interact: 'E  OPEN RELIEF VALVE', progress: 'RELIEF VALVES {current}/{total}',
      locked: 'THE CORE SHAFT IS SEALED', complete: 'STRUCTURAL PRESSURE FALLING / FIND CORE',
    },
  },
  props: [
    { type: 'square-column', density: 0.038, color: 0x777a75, accent: 0x4a4d49, cluster: [1, 3] },
    { type: 'wall-pipe', density: 0.1, color: 0x555b56, accent: 0x272b28, cluster: [2, 5] },
    { type: 'cable-tray', density: 0.075, color: 0x565c57, accent: 0x292d2a, cluster: [2, 5] },
    { type: 'service-crate', density: 0.014, color: 0x53564e, accent: 0x817557, cluster: [1, 3] },
    { type: 'drain-grate', density: 0.026, color: 0x353936, accent: 0x181a19, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.015, minCount: 3, maxCount: 10, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 1.2, 'abandoned-pack': 0.85, 'chair-pile': 0.55,
      'black-motes': 1.75, 'shoe-trail': 1.1,
    },
    palette: { cloth: 0x3d403c, clothLight: 0x71746d, motes: 0x080908 },
  },
  atmosphere: {
    identity: 'self-building-concrete-foundation',
    cadence: { first: [8, 14], interval: [13, 23] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'survey-mark', text: 'DATUM 0 / ALL MEASUREMENTS BELOW', density: 0.008, placement: 'wall' },
      { id: 'pour-date', text: 'POURED TOMORROW / TESTED YESTERDAY', density: 0.006, placement: 'objective' },
      { id: 'rebar-arrow', text: 'STRUCTURAL LOAD MOVING DOWN', density: 0.007, placement: 'floor' },
    ],
    milestones: [
      { id: 'fresh-pour', progress: 0.25, message: 'WET CONCRETE SEALS THE PASSAGE BEHIND YOU', duration: 1.2, cue: 'pressure-groan' },
      { id: 'column-shift', progress: 0.75, message: 'EVERY COLUMN LEANS TOWARD THE CORE SHAFT', duration: 1.22, cue: 'sub-bass-bump', effect: { glitch: 0.4 } },
    ],
    events: [
      { id: 'rebar-tension', earliest: 6, weight: 1.25, maxRepeats: 3, tension: [0.02, 0.92], message: 'REBAR TIGHTENS INSIDE THE WALL', duration: 1.08, cue: 'pressure-groan', pan: 'random' },
      { id: 'formwork-knock', earliest: 13, weight: 1, maxRepeats: 3, tension: [0.07, 0.9], message: 'A HAMMER STRIKES FROM WITHIN SOLID CONCRETE', duration: 1.12, cue: 'pipe-knock', pan: 'random' },
      { id: 'load-transfer', earliest: 21, weight: 0.8, maxRepeats: 2, tension: [0.13, 0.93], message: 'THE WHOLE STRUCTURE SETTLES ONE FLOOR LOWER', duration: 1.2, cue: 'sub-bass-bump', effect: { flicker: 0.46 } },
      { id: 'pour-silence', earliest: 33, weight: 0.52, maxRepeats: 1, tension: [0.24, 0.96], message: 'ALL CONSTRUCTION STOPS DIRECTLY AHEAD', duration: 1.25, cue: 'machine-dropout', effect: { flicker: 0.92, silence: 1.5 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xf4e7c7, intensity: 60, distance: 21.5, angle: 0.34,
      drainPerSecond: 0.0068, emergencyRechargePerSecond: 0.0017, flashCost: 0.35,
    },
  },
  evidence: {
    recharge: 0.25,
    entries: [
      'STRUCTURE LOG 04 / FOUNDATION DEPTH EXCEEDS THE PLANETARY RADIUS',
      'STRUCTURE LOG 12 / CURED CONCRETE CONTAINS FOOTPRINTS FACING INWARD',
      'STRUCTURE LOG 20 / THE CORE SHAFT WAS PRESENT BEFORE EXCAVATION',
    ],
  },
  monster: {
    name: 'The Surveyor', identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.34, twitchStrength: 0.7 },
    sound: { breathPitch: 0.48, breathWeight: 0.88, stepWeight: 1.08, drag: 0.5 },
    skin: {
      type: 'maintenance-husk', body: 0x171816, accent: 0x5e584b,
      eye: 0xd1ad6e, emissiveIntensity: 0.42, scale: 1.22,
    },
    timing: {
      firstScare: [9, 16], scareInterval: [13, 23], firstChase: [37, 51],
      glimpseDuration: 1.1, stalkDuration: 20, pathRefresh: { stalk: 0.54, chase: 0.24 },
    },
    behavior: {
      sight: { range: 20, peripheralDot: 0.17, acquireRate: 1.44, threshold: 0.42 },
      hearing: { baseCells: 4, noiseCells: 13, chaseNoise: 0.58, reacquireNoise: 0.32 },
      chase: { lostSightDelay: 5.7, searchDuration: [9, 15], recovery: [14, 22] },
      wanderCells: [4, 10],
    },
    speeds: { watched: 0.48, stalk: 1.43, chase: 3.82 },
    stalkTriggerDistance: 12,
    catchDistance: 1,
  },
};
