// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'apartment-corridors',
  index: 17,
  name: 'Apartment Corridors',
  exit: { label: 'STAIR B' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 17',
    status: 'TENANCY RECORDS INCONSISTENT',
    start: {
      kicker: 'RESIDENTIAL BLOCK / FLOOR 0',
      title: 'EVERY DOOR<br />KNOWS YOUR KEY.',
      body: 'Find Stair B. Apartment numbers change whenever someone walks behind the walls.',
      button: 'ENTER LEVEL 17',
    },
    pause: {
      kicker: 'HALLWAY QUIET HOURS',
      title: 'DO NOT WAKE<br />THE NEIGHBORS.',
      body: 'A television behind the nearest door is describing your last movement.',
      button: 'LEAVE QUIETLY',
    },
    death: {
      kicker: 'LEASE TERMINATED',
      title: 'UNIT<br />OCCUPIED.',
      body: 'The directory now lists your name beside every apartment.',
      button: 'REQUEST NEW KEY',
    },
    win: {
      kicker: 'STAIR B FOUND',
      title: 'THE LANDING<br />HAS NO FLOOR.',
      body: 'A freight elevator waits below, its call button lit beneath layers of dust.',
      button: 'DESCEND TO LEVEL 18',
    },
  },
  maze: {
    desktop: { cols: 19, rows: 29 },
    mobile: { cols: 15, rows: 23 },
    loopRatio: 0.12,
    roomDivisor: 72,
    minimumRooms: 5,
    roomSize: { min: 2, max: 3 },
    seedSalt: 0x3b8e5d91,
  },
  surfaces: {
    wall: {
      base: [168, 151, 126], accent: [119, 94, 73], grime: [55, 43, 35],
      pattern: 'aged-wallpaper', roughness: 0.91, metalness: 0, bumpScale: 0.058,
      grimeOpacity: 0.25,
    },
    floor: {
      base: [91, 68, 54], accent: [126, 91, 65], grime: [43, 34, 29],
      pattern: 'worn-hallway-carpet', roughness: 0.98, metalness: 0, bumpScale: 0.067,
    },
    ceiling: {
      base: [151, 143, 128], accent: [111, 101, 88], grime: [65, 59, 52],
      pattern: 'stained-plaster', roughness: 0.92, metalness: 0, bumpScale: 0.049,
      emissive: 0x30261b, emissiveIntensity: 0.23,
    },
    trim: { color: 0x684b38, roughness: 0.82, metalness: 0.02 },
  },
  fog: { color: 0x5c493b, density: { desktop: 0.036, mobile: 0.043 } },
  lighting: {
    exposure: 0.88,
    hemisphere: {
      sky: 0xd7b27e, ground: 0x251b15,
      intensity: { desktop: 0.5, mobile: 0.58 },
    },
    ambient: { color: 0x9a744f, intensity: { desktop: 0.19, mobile: 0.27 } },
    fixture: {
      color: 0xffd18a, panelColor: 0xffdc9a, deadPanelColor: 0x514538,
      intensity: 91, distance: 10.2, angle: 1.16, penumbra: 0.9, decay: 2,
      brokenChance: 0.21, pool: { desktop: 6, mobile: 3 },
      flicker: { idleRate: 4.2, idleDepth: 0.032, faultFloor: 0.017, recovery: 0.41 },
    },
  },
  audio: {
    drips: false,
    masterGain: 0.68,
    humGain: 0.041,
    oscillators: [
      { frequency: 52, type: 'sine', gain: 0.19 },
      { frequency: 104, type: 'triangle', gain: 0.038 },
      { frequency: 26, type: 'sine', gain: 0.13 },
      { frequency: 208, type: 'sine', gain: 0.01 },
    ],
    noise: { filter: 'lowpass', frequency: 410, q: 0.56, gain: 0.032 },
    heartbeat: { startFrequency: 61, endFrequency: 34 },
    impact: { startFrequency: 43, endFrequency: 16 },
    footstep: { walkLowpass: 225, runLowpass: 295 },
    ambience: {
      interval: [13, 28], cues: ['door-knock', 'lift-bell', 'pipe-knock', 'television-dropout'],
      stereoWidth: 0.83, silenceChance: 0.31,
    },
  },
  objective: {
    type: 'none', count: 0, color: 0xd5a56d,
    labels: {
      hud: 'FIND STAIR B', item: '', itemPlural: '', interact: 'E  OPEN',
      progress: '', locked: '', complete: 'STAIR B LOCATED',
    },
  },
  props: [
    { type: 'discarded-chair', density: 0.029, color: 0x6f4a38, accent: 0x2d211b, cluster: [1, 4] },
    { type: 'service-crate', density: 0.021, color: 0x846d55, accent: 0x3d3025, cluster: [1, 3] },
    { type: 'square-column', density: 0.016, color: 0xb2a186, accent: 0x695a48, cluster: [1, 2] },
    { type: 'wall-pipe', density: 0.052, color: 0x6d665b, accent: 0x35312b, cluster: [1, 4] },
    { type: 'ceiling-vent', density: 0.034, color: 0x6c675e, accent: 0x302f2b, cluster: [1, 3] },
  ],
  incidents: {
    density: 0.018, minCount: 3, maxCount: 8, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.15, 'abandoned-pack': 1.6, 'chair-pile': 1.35,
      'black-motes': 0.65, 'shoe-trail': 1.9,
    },
    palette: { cloth: 0x4d382e, clothLight: 0x91745c, motes: 0x0b0807 },
  },
  atmosphere: {
    identity: 'unoccupied-residential-loop',
    cadence: { first: [12, 21], interval: [17, 31] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'directory', text: 'TENANTS: 0 / COMPLAINTS: STILL ARRIVING', density: 0.008, placement: 'wall' },
      { id: 'welcome-mat', text: 'WELCOME HOME / WRONG NAME', density: 0.006, placement: 'floor' },
      { id: 'stair-sign', text: 'STAIR B → ALL DIRECTIONS', density: 0.005, placement: 'exit' },
    ],
    milestones: [],
    events: [
      {
        id: 'door-chain', earliest: 9, weight: 1.18, maxRepeats: 3,
        tension: [0.03, 0.82], message: 'A DOOR CHAIN SLIDES INTO PLACE',
        duration: 1.08, cue: 'door-knock', pan: 'random',
      },
      {
        id: 'television-name', earliest: 19, weight: 0.9, maxRepeats: 2,
        tension: [0.1, 0.88], message: 'A TELEVISION SAYS YOUR NAME THROUGH STATIC',
        duration: 1.2, cue: 'television-dropout', effect: { glitch: 0.38 },
      },
      {
        id: 'lift-arrives', earliest: 29, weight: 0.7, maxRepeats: 2,
        tension: [0.18, 0.84], message: 'THE ELEVATOR ARRIVES ON THIS FLOOR',
        duration: 1.17, cue: 'lift-bell', pan: 'random',
      },
      {
        id: 'all-locks', earliest: 43, weight: 0.46, maxRepeats: 1,
        tension: [0.28, 0.93], message: 'EVERY DEADBOLT TURNS AT ONCE',
        duration: 1.28, cue: 'door-knock', effect: { silence: 1.35, flicker: 0.75 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffddb0, intensity: 57, distance: 18.8, angle: 0.4,
      drainPerSecond: 0.0061, emergencyRechargePerSecond: 0.002, flashCost: 0.3,
    },
  },
  evidence: {
    recharge: 0.3,
    entries: [
      'LEASE 03 / RENT IS PAID IN HOURS OF SLEEP',
      'LEASE 10 / THE APARTMENTS SHARE ONE BEDROOM',
      'LEASE 17 / STAIR B ONLY APPEARS TO DEPARTING TENANTS',
    ],
  },
  monster: {
    name: 'The Neighbor',
    identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0, twitchStrength: 0.82 },
    sound: { breathPitch: 0.63, breathWeight: 0.58, stepWeight: 0.69, drag: 0.24 },
    skin: {
      type: 'faceless-shadow', body: 0x080605, accent: 0x211812,
      eye: null, emissiveIntensity: 0, scale: 1.04,
    },
    timing: {
      firstScare: [13, 22], scareInterval: [16, 29], firstChase: [48, 69],
      glimpseDuration: 1.34, stalkDuration: 25,
      pathRefresh: { stalk: 0.78, chase: 0.34 },
    },
    behavior: {
      sight: { range: 20.5, peripheralDot: 0.29, acquireRate: 1.12, threshold: 0.5 },
      hearing: { baseCells: 2, noiseCells: 8, chaseNoise: 0.78, reacquireNoise: 0.46 },
      chase: { lostSightDelay: 5.1, searchDuration: [8, 14], recovery: [20, 30] },
      wanderCells: [4, 8],
    },
    speeds: { watched: 0.18, stalk: 1.08, chase: 3.34 },
    stalkTriggerDistance: 10.3,
    catchDistance: 0.9,
  },
};
