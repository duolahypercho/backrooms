// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'hotel-basement',
  index: 24,
  name: 'Hotel Basement',
  exit: { label: 'B2' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 24',
    status: 'HOUSE SERVICES UNAVAILABLE',
    start: {
      kicker: 'GRAND HOTEL / SUBLEVEL B1',
      title: 'THE GUESTS<br />NEVER CHECKED OUT.',
      body: 'Open three boiler valves. Room-service bells keep ringing below the foundation.',
      button: 'ENTER LEVEL 24',
    },
    pause: {
      kicker: 'SERVICE CORRIDOR HELD',
      title: 'THE LAUNDRY<br />IS STILL WARM.',
      body: 'An elevator stops overhead, although this floor has no shaft.',
      button: 'RETURN TO SERVICE',
    },
    death: {
      kicker: 'ROOM PREPARED',
      title: 'DO NOT<br />DISTURB.',
      body: 'Your room key was hanging behind the boiler-room desk.',
      button: 'CALL FRONT DESK',
    },
    win: {
      kicker: 'BOILER PRESSURE RELEASED',
      title: 'SUBLEVEL B2<br />IS WAITING.',
      body: 'The service elevator opens onto electrical fencing and rainless thunder.',
      button: 'DESCEND TO LEVEL 25',
    },
  },
  maze: {
    desktop: { cols: 21, rows: 27 },
    mobile: { cols: 17, rows: 19 },
    loopRatio: 0.18,
    roomDivisor: 58,
    minimumRooms: 7,
    roomSize: { min: 2, max: 4 },
    seedSalt: 0xc38e7b24,
  },
  surfaces: {
    wall: {
      base: [114, 103, 82], accent: [78, 68, 54], grime: [44, 37, 30],
      pattern: 'seeping-concrete', roughness: 0.9, metalness: 0.01, bumpScale: 0.066,
      grimeOpacity: 0.28,
    },
    floor: {
      base: [79, 69, 57], accent: [54, 47, 40], grime: [30, 26, 23],
      pattern: 'oil-stained-concrete', roughness: 0.75, metalness: 0.03, bumpScale: 0.04,
    },
    ceiling: {
      base: [101, 94, 78], accent: [70, 63, 52], grime: [39, 34, 29],
      pattern: 'service-slab', roughness: 0.92, metalness: 0.02, bumpScale: 0.058,
      emissive: 0x261f17, emissiveIntensity: 0.15,
    },
    trim: { color: 0x5a4934, roughness: 0.7, metalness: 0.24 },
  },
  fog: { color: 0x493d31, density: { desktop: 0.04, mobile: 0.047 } },
  lighting: {
    exposure: 0.76,
    hemisphere: { sky: 0xd6b47d, ground: 0x1d1712, intensity: { desktop: 0.44, mobile: 0.52 } },
    ambient: { color: 0x7c6041, intensity: { desktop: 0.18, mobile: 0.25 } },
    fixture: {
      color: 0xffc878, panelColor: 0xffd79a, deadPanelColor: 0x3a2f22,
      intensity: 78, distance: 10.6, angle: 1.08, penumbra: 0.91, decay: 2,
      brokenChance: 0.29, pool: { desktop: 5, mobile: 3 },
      flicker: { idleRate: 2.5, idleDepth: 0.055, faultFloor: 0.01, recovery: 0.43 },
    },
  },
  audio: {
    drips: true, masterGain: 0.78, humGain: 0.062,
    oscillators: [
      { frequency: 42, type: 'sine', gain: 0.27 },
      { frequency: 84, type: 'triangle', gain: 0.04 },
      { frequency: 21, type: 'sine', gain: 0.15 },
    ],
    noise: { filter: 'lowpass', frequency: 330, q: 0.52, gain: 0.042 },
    heartbeat: { startFrequency: 59, endFrequency: 31 },
    impact: { startFrequency: 39, endFrequency: 13 },
    footstep: { walkLowpass: 190, runLowpass: 260 },
    ambience: {
      interval: [9, 20],
      cues: ['pipe-knock', 'steam-release', 'near-drip', 'distant-ring'],
      stereoWidth: 0.96,
      silenceChance: 0.16,
    },
  },
  objective: {
    type: 'valve', count: 3, color: 0xc88b4a,
    labels: {
      hud: 'BOILER PRESSURE CRITICAL', item: 'BOILER VALVE', itemPlural: 'BOILER VALVES',
      interact: 'E  OPEN BOILER VALVE', progress: 'BOILER VALVES {current}/{total}',
      locked: 'THE B2 LIFT IS PRESSURE-LOCKED', complete: 'PRESSURE RELEASED / FIND B2',
    },
  },
  props: [
    { type: 'wall-pipe', density: 0.12, color: 0x6f5b42, accent: 0x342a20, cluster: [2, 5] },
    { type: 'hanging-chain', density: 0.04, color: 0x5b4c3b, accent: 0x272019, cluster: [1, 4] },
    { type: 'standing-water', density: 0.055, color: 0x3d443c, accent: 0x8a8067, cluster: [2, 5] },
    { type: 'drain-grate', density: 0.035, color: 0x423a30, accent: 0x1c1916, cluster: [1, 2] },
    { type: 'oil-drum', density: 0.016, color: 0x5e4932, accent: 0x8b693c, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.018, minCount: 3, maxCount: 10, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.15, 'abandoned-pack': 0.9, 'chair-pile': 0.5,
      'black-motes': 1.35, 'shoe-trail': 1.6,
    },
    palette: { cloth: 0x493b2c, clothLight: 0x806b4f, motes: 0x0c0907 },
  },
  atmosphere: {
    identity: 'occupied-grand-hotel-basement',
    cadence: { first: [8, 14], interval: [13, 24] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'laundry-list', text: 'ROOM 237 / LINEN RETURNED WET', density: 0.008, placement: 'wall' },
      { id: 'service-arrow', text: 'B2 SERVICE ONLY / GUESTS KEEP OUT', density: 0.007, placement: 'floor' },
      { id: 'boiler-card', text: 'PRESSURE NORMAL / VOICES ABNORMAL', density: 0.006, placement: 'objective' },
    ],
    milestones: [
      { id: 'service-bell', progress: 0.33, message: 'A SERVICE BELL RINGS FROM INSIDE THE BOILER', duration: 1.2, cue: 'distant-ring' },
      { id: 'warm-linen', progress: 0.66, message: 'FRESHLY FOLDED LINEN APPEARS IN THE PASSAGE', duration: 1.15, cue: 'steam-release', effect: { flicker: 0.38 } },
    ],
    events: [
      { id: 'pipe-answer', earliest: 6, weight: 1.25, maxRepeats: 3, tension: [0.02, 0.9], message: 'THREE PIPE KNOCKS ANSWER YOUR FOOTSTEPS', duration: 1.08, cue: 'pipe-knock', pan: 'random' },
      { id: 'laundry-cart', earliest: 13, weight: 1, maxRepeats: 2, tension: [0.08, 0.88], message: 'A LAUNDRY CART ROLLS ONE FLOOR ABOVE', duration: 1.12, cue: 'chain-drag', pan: 'random' },
      { id: 'steam-figure', earliest: 21, weight: 0.76, maxRepeats: 2, tension: [0.14, 0.92], message: 'STEAM FORMS A PERSON WHO WILL NOT TURN', duration: 1.2, cue: 'steam-release', effect: { glitch: 0.34 } },
      { id: 'guest-silence', earliest: 33, weight: 0.5, maxRepeats: 1, tension: [0.26, 0.95], message: 'EVERY ROOM-SERVICE BELL STOPS TOGETHER', duration: 1.22, cue: 'machine-dropout', effect: { flicker: 0.88, silence: 1.5 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffd6a0, intensity: 54, distance: 18.2, angle: 0.37,
      drainPerSecond: 0.0063, emergencyRechargePerSecond: 0.0018, flashCost: 0.31,
    },
  },
  evidence: {
    recharge: 0.27,
    entries: [
      'SERVICE LOG 06 / THE HOTEL HAS 312 ROOMS AND 313 OCCUPIED LINES',
      'SERVICE LOG 14 / HOT WATER ARRIVES FROM BELOW THE LOWEST BOILER',
      'SERVICE LOG 21 / NEVER ANSWER A BELL THAT RINGS THREE TIMES',
    ],
  },
  monster: {
    name: 'The Bellhop Below', identity: 'wader',
    presentation: { silhouette: 'waterlogged-dragger', eyePulse: 0.46, twitchStrength: 0.52 },
    sound: { breathPitch: 0.54, breathWeight: 0.96, stepWeight: 0.9, drag: 0.66 },
    skin: {
      type: 'waterlogged-longlimb', body: 0x12110e, accent: 0x5f4931,
      eye: 0xd69d57, emissiveIntensity: 0.48, scale: 1.13,
    },
    timing: {
      firstScare: [10, 17], scareInterval: [13, 24], firstChase: [38, 53],
      glimpseDuration: 1.1, stalkDuration: 19, pathRefresh: { stalk: 0.55, chase: 0.26 },
    },
    behavior: {
      sight: { range: 17, peripheralDot: 0.13, acquireRate: 1.48, threshold: 0.41 },
      hearing: { baseCells: 4, noiseCells: 13, chaseNoise: 0.6, reacquireNoise: 0.33 },
      chase: { lostSightDelay: 6.2, searchDuration: [10, 16], recovery: [14, 22] },
      wanderCells: [3, 8],
    },
    speeds: { watched: 0.5, stalk: 1.38, chase: 3.72 },
    stalkTriggerDistance: 11.2,
    catchDistance: 0.98,
  },
};
