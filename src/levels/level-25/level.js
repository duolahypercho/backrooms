// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'power-substation',
  index: 25,
  name: 'Power Substation',
  exit: { label: 'LOWER GRID' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 25',
    status: 'GRID ARCING',
    start: {
      kicker: 'SUBSTATION 9 / LOAD UNKNOWN',
      title: 'THE CURRENT<br />IS LISTENING.',
      body: 'Seat four grid fuses. Do not touch the fence when the transformers begin whispering.',
      button: 'ENTER LEVEL 25',
    },
    pause: {
      kicker: 'BREAKER HELD OPEN',
      title: 'STATIC FILLS<br />YOUR TEETH.',
      body: 'The warning beacons rotate even after their power dies.',
      button: 'CLOSE BREAKER',
    },
    death: {
      kicker: 'GROUND FAULT LOCATED',
      title: 'LOAD<br />ACCEPTED.',
      body: 'The grid recorded your heartbeat as a stable power source.',
      button: 'REENERGIZE',
    },
    win: {
      kicker: 'LOWER FEED ONLINE',
      title: 'THE CABLE TRENCH<br />GOES DEEPER.',
      body: 'A maintenance ladder drops into a station echoing with black water.',
      button: 'DESCEND TO LEVEL 26',
    },
  },
  maze: {
    desktop: { cols: 29, rows: 21 },
    mobile: { cols: 19, rows: 17 },
    loopRatio: 0.3,
    roomDivisor: 46,
    minimumRooms: 10,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0xd49f9c25,
  },
  surfaces: {
    wall: {
      base: [128, 136, 128], accent: [83, 91, 84], grime: [39, 43, 40],
      pattern: 'painted-concrete', roughness: 0.76, metalness: 0.04, bumpScale: 0.044,
      grimeOpacity: 0.22,
    },
    floor: {
      base: [74, 78, 72], accent: [50, 53, 49], grime: [28, 30, 27],
      pattern: 'oil-stained-concrete', roughness: 0.68, metalness: 0.09, bumpScale: 0.038,
    },
    ceiling: {
      base: [104, 111, 104], accent: [71, 76, 71], grime: [37, 40, 37],
      pattern: 'service-slab', roughness: 0.84, metalness: 0.07, bumpScale: 0.05,
      emissive: 0x20281f, emissiveIntensity: 0.18,
    },
    trim: { color: 0x536052, roughness: 0.54, metalness: 0.38 },
  },
  fog: { color: 0x3d493d, density: { desktop: 0.028, mobile: 0.034 } },
  lighting: {
    exposure: 0.84,
    hemisphere: { sky: 0xc9e0b6, ground: 0x171d16, intensity: { desktop: 0.52, mobile: 0.6 } },
    ambient: { color: 0x6e8b66, intensity: { desktop: 0.21, mobile: 0.28 } },
    fixture: {
      color: 0xd9ffad, panelColor: 0xe8ffc8, deadPanelColor: 0x343d31,
      intensity: 92, distance: 12, angle: 1.16, penumbra: 0.86, decay: 2,
      brokenChance: 0.26, pool: { desktop: 7, mobile: 4 },
      flicker: { idleRate: 5.1, idleDepth: 0.05, faultFloor: 0.008, recovery: 0.32 },
    },
  },
  audio: {
    drips: false, masterGain: 0.8, humGain: 0.085,
    oscillators: [
      { frequency: 60, type: 'sine', gain: 0.3 },
      { frequency: 120, type: 'triangle', gain: 0.055 },
      { frequency: 30, type: 'sine', gain: 0.14 },
      { frequency: 240, type: 'square', gain: 0.008 },
    ],
    noise: { filter: 'highpass', frequency: 1100, q: 0.75, gain: 0.024 },
    heartbeat: { startFrequency: 66, endFrequency: 36 },
    impact: { startFrequency: 54, endFrequency: 19 },
    footstep: { walkLowpass: 280, runLowpass: 380 },
    ambience: {
      interval: [8, 18],
      cues: ['relay-chatter', 'machine-dropout', 'ballast-pop', 'shift-bell'],
      stereoWidth: 0.98,
      silenceChance: 0.12,
    },
  },
  objective: {
    type: 'fuse', count: 4, color: 0x9fdc62,
    labels: {
      hud: 'LOWER GRID DISCONNECTED', item: 'GRID FUSE', itemPlural: 'GRID FUSES',
      interact: 'E  SEAT GRID FUSE', progress: 'GRID FUSES {current}/{total}',
      locked: 'THE CABLE TRENCH IS INTERLOCKED', complete: 'LOWER FEED LIVE / FIND THE TRENCH',
    },
  },
  props: [
    { type: 'cable-tray', density: 0.11, color: 0x5b665b, accent: 0x292f29, cluster: [2, 6] },
    { type: 'wall-pipe', density: 0.07, color: 0x596258, accent: 0x293029, cluster: [2, 4] },
    { type: 'service-crate', density: 0.018, color: 0x4d594b, accent: 0xa9a13d, cluster: [1, 3] },
    { type: 'square-column', density: 0.021, color: 0x7c8479, accent: 0x4c554b, cluster: [1, 2] },
    { type: 'ceiling-vent', density: 0.04, color: 0x6b746b, accent: 0x363d36, cluster: [1, 3] },
  ],
  incidents: {
    density: 0.013, minCount: 2, maxCount: 8, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 1.05, 'abandoned-pack': 1.1, 'chair-pile': 0.35,
      'black-motes': 1.8, 'shoe-trail': 0.7,
    },
    palette: { cloth: 0x3c473b, clothLight: 0x72806f, motes: 0x070b07 },
  },
  atmosphere: {
    identity: 'sentient-high-voltage-substation',
    cadence: { first: [7, 13], interval: [12, 22] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'hazard-board', text: 'DANGER 400KV / CURRENT PRESENT WITH ISOLATOR OPEN', density: 0.008, placement: 'wall' },
      { id: 'load-sheet', text: 'OUTGOING LOAD / ONE HUMAN NERVOUS SYSTEM', density: 0.006, placement: 'objective' },
      { id: 'burn-mark', text: 'GROUND PATH CONTINUES DOWN', density: 0.007, placement: 'floor' },
    ],
    milestones: [
      { id: 'grid-voice', progress: 0.25, message: 'THE TRANSFORMER HUM MODULATES INTO SPEECH', duration: 1.16, cue: 'relay-chatter' },
      { id: 'reverse-meter', progress: 0.75, message: 'EVERY AMMETER TURNS TOWARD YOUR BODY', duration: 1.2, cue: 'ballast-pop', effect: { glitch: 0.42 } },
    ],
    events: [
      { id: 'arc-flash', earliest: 5, weight: 1.25, maxRepeats: 3, tension: [0.02, 0.92], message: 'BLUE LIGHT CRAWLS ALONG A DEAD CABLE', duration: 1.02, cue: 'ballast-pop', effect: { flicker: 0.52 } },
      { id: 'relay-count', earliest: 12, weight: 1, maxRepeats: 3, tension: [0.06, 0.88], message: 'RELAYS COUNT YOUR STEPS IN BINARY', duration: 1.12, cue: 'relay-chatter', pan: 'random' },
      { id: 'fence-impact', earliest: 20, weight: 0.78, maxRepeats: 2, tension: [0.14, 0.9], message: 'SOMETHING HEAVY STRIKES THE SAFETY FENCE', duration: 1.15, cue: 'sub-bass-bump', pan: 'random' },
      { id: 'grid-trip', earliest: 31, weight: 0.55, maxRepeats: 1, tension: [0.23, 0.95], message: 'THE GRID TRIPS BUT THE HUM CONTINUES', duration: 1.25, cue: 'machine-dropout', effect: { flicker: 1, silence: 1.2 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xe0ffb8, intensity: 57, distance: 20.5, angle: 0.38,
      drainPerSecond: 0.0061, emergencyRechargePerSecond: 0.0019, flashCost: 0.32,
    },
  },
  evidence: {
    recharge: 0.25,
    entries: [
      'GRID LOG 02 / DEMAND ROSE AFTER EVERY CONNECTED CITY WENT DARK',
      'GRID LOG 09 / ARC PATTERNS RESEMBLE A PERSON RUNNING BETWEEN BAYS',
      'GRID LOG 16 / LOWER FEED DRAWS POWER FROM TOMORROW',
    ],
  },
  monster: {
    name: 'The Lineman', identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.92, twitchStrength: 0.84 },
    sound: { breathPitch: 0.68, breathWeight: 0.7, stepWeight: 0.92, drag: 0.3 },
    skin: {
      type: 'maintenance-husk', body: 0x10150f, accent: 0x52662c,
      eye: 0xc8ff61, emissiveIntensity: 0.84, scale: 1.12,
    },
    timing: {
      firstScare: [9, 15], scareInterval: [12, 22], firstChase: [36, 50],
      glimpseDuration: 0.95, stalkDuration: 18, pathRefresh: { stalk: 0.5, chase: 0.23 },
    },
    behavior: {
      sight: { range: 22, peripheralDot: 0.2, acquireRate: 1.55, threshold: 0.4 },
      hearing: { baseCells: 4, noiseCells: 14, chaseNoise: 0.56, reacquireNoise: 0.31 },
      chase: { lostSightDelay: 5.2, searchDuration: [8, 14], recovery: [13, 21] },
      wanderCells: [4, 10],
    },
    speeds: { watched: 0.58, stalk: 1.46, chase: 3.88 },
    stalkTriggerDistance: 12.8,
    catchDistance: 0.96,
  },
};
