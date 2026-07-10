// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'snowbound-resort',
  index: 27,
  name: 'Snowbound Resort',
  exit: { label: 'SERVICE LIFT' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 27',
    status: 'WHITEOUT SEALED',
    start: {
      kicker: 'MOUNTAIN RESORT / SEASON EXTENDED',
      title: 'THE SNOW<br />FELL INDOORS.',
      body: 'Restore three lodge circuits. The windows show a blizzard moving from room to room.',
      button: 'ENTER LEVEL 27',
    },
    pause: {
      kicker: 'CHAIRLIFT STOPPED',
      title: 'KEEP AWAY<br />FROM THE WINDOWS.',
      body: 'Ski tracks cross the lobby carpet and end at your feet.',
      button: 'RETURN TO LODGE',
    },
    death: {
      kicker: 'GUEST FOUND OUTSIDE',
      title: 'ROOM<br />TURNED DOWN.',
      body: 'The snow preserved an outline that stood up after you fell.',
      button: 'CHECK IN AGAIN',
    },
    win: {
      kicker: 'SERVICE LIFT THAWED',
      title: 'THE MOUNTAIN<br />IS HOLLOW.',
      body: 'The lift descends through raw concrete wider than the resort above it.',
      button: 'DESCEND TO LEVEL 28',
    },
  },
  maze: {
    desktop: { cols: 25, rows: 23 },
    mobile: { cols: 19, rows: 17 },
    loopRatio: 0.27,
    roomDivisor: 44,
    minimumRooms: 11,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0xf6b1de27,
  },
  surfaces: {
    wall: {
      base: [170, 165, 145], accent: [120, 111, 91], grime: [60, 57, 48],
      pattern: 'aged-wallpaper', roughness: 0.92, metalness: 0, bumpScale: 0.048,
      grimeOpacity: 0.18,
    },
    floor: {
      base: [84, 76, 61], accent: [58, 52, 42], grime: [34, 31, 27],
      pattern: 'damp-carpet', roughness: 0.98, metalness: 0, bumpScale: 0.066,
    },
    ceiling: {
      base: [181, 184, 177], accent: [136, 140, 136], grime: [78, 82, 80],
      pattern: 'acoustic-tile', roughness: 0.91, metalness: 0.01, bumpScale: 0.036,
      emissive: 0x303530, emissiveIntensity: 0.22,
    },
    trim: { color: 0x6f654f, roughness: 0.82, metalness: 0.05 },
  },
  fog: { color: 0x727a77, density: { desktop: 0.037, mobile: 0.044 } },
  lighting: {
    exposure: 0.86,
    hemisphere: { sky: 0xddebea, ground: 0x202524, intensity: { desktop: 0.54, mobile: 0.62 } },
    ambient: { color: 0x91a7a4, intensity: { desktop: 0.22, mobile: 0.29 } },
    fixture: {
      color: 0xe2f7ef, panelColor: 0xf0fff9, deadPanelColor: 0x414744,
      intensity: 86, distance: 11.8, angle: 1.19, penumbra: 0.9, decay: 2,
      brokenChance: 0.23, pool: { desktop: 6, mobile: 4 },
      flicker: { idleRate: 3.2, idleDepth: 0.035, faultFloor: 0.018, recovery: 0.34 },
    },
  },
  audio: {
    drips: false, masterGain: 0.73, humGain: 0.05,
    oscillators: [
      { frequency: 44, type: 'sine', gain: 0.22 },
      { frequency: 88, type: 'triangle', gain: 0.035 },
      { frequency: 22, type: 'sine', gain: 0.14 },
    ],
    noise: { filter: 'bandpass', frequency: 520, q: 0.58, gain: 0.034 },
    heartbeat: { startFrequency: 60, endFrequency: 32 },
    impact: { startFrequency: 41, endFrequency: 14 },
    footstep: { walkLowpass: 215, runLowpass: 290 },
    ambience: {
      interval: [10, 22],
      cues: ['pressure-groan', 'distant-ring', 'ballast-pop', 'machine-dropout'],
      stereoWidth: 0.93,
      silenceChance: 0.24,
    },
  },
  objective: {
    type: 'fuse', count: 3, color: 0xa9d9ce,
    labels: {
      hud: 'LODGE HEAT OFFLINE', item: 'HEAT CIRCUIT', itemPlural: 'HEAT CIRCUITS',
      interact: 'E  RESTORE HEAT CIRCUIT', progress: 'HEAT CIRCUITS {current}/{total}',
      locked: 'THE SERVICE LIFT IS FROZEN', complete: 'LODGE HEAT ONLINE / FIND THE LIFT',
    },
  },
  props: [
    { type: 'discarded-chair', density: 0.024, color: 0x5e5140, accent: 0x9b896b, cluster: [1, 4] },
    { type: 'service-crate', density: 0.018, color: 0x665943, accent: 0xa58a55, cluster: [1, 3] },
    { type: 'ceiling-vent', density: 0.047, color: 0x8a9089, accent: 0x4c514d, cluster: [1, 3] },
    { type: 'wall-pipe', density: 0.055, color: 0x727872, accent: 0x3a3e3b, cluster: [2, 4] },
    { type: 'square-column', density: 0.017, color: 0xa49e88, accent: 0x756d58, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.017, minCount: 3, maxCount: 9, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 0.8, 'abandoned-pack': 1.3, 'chair-pile': 1,
      'black-motes': 1.05, 'shoe-trail': 1.7,
    },
    palette: { cloth: 0x4f594f, clothLight: 0x89988b, motes: 0x0b0e0d },
  },
  atmosphere: {
    identity: 'interior-whiteout-mountain-resort',
    cadence: { first: [9, 15], interval: [14, 24] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'weather-board', text: 'BASE DEPTH / BUILDING HEIGHT PLUS 4M', density: 0.008, placement: 'wall' },
      { id: 'ski-tracks', text: 'TRACKS ENTER / NO TRACKS LEAVE', density: 0.007, placement: 'floor' },
      { id: 'room-card', text: 'ROOM 0 / OCCUPIED SINCE FIRST SNOW', density: 0.006, placement: 'objective' },
    ],
    milestones: [
      { id: 'indoor-flurry', progress: 0.33, message: 'SNOW FALLS FROM AN UNBROKEN CEILING TILE', duration: 1.18, cue: 'pressure-groan' },
      { id: 'window-figure', progress: 0.66, message: 'A FIGURE OUTSIDE THE WINDOW MATCHES YOUR MOVEMENT', duration: 1.22, cue: 'distant-knock', effect: { glitch: 0.38 } },
    ],
    events: [
      { id: 'chairlift-cable', earliest: 7, weight: 1.2, maxRepeats: 3, tension: [0.02, 0.9], message: 'A CHAIRLIFT CABLE GROANS INSIDE THE WALL', duration: 1.1, cue: 'pressure-groan', pan: 'random' },
      { id: 'lobby-bell', earliest: 14, weight: 1, maxRepeats: 2, tension: [0.07, 0.86], message: 'THE FRONT-DESK BELL RINGS FROM AN EMPTY ROOM', duration: 1.08, cue: 'distant-ring', pan: 'random' },
      { id: 'window-crack', earliest: 22, weight: 0.78, maxRepeats: 2, tension: [0.13, 0.92], message: 'FROST CRACKS ACROSS A WALL WITH NO WINDOW', duration: 1.18, cue: 'ballast-pop', effect: { flicker: 0.44 } },
      { id: 'whiteout-entry', earliest: 34, weight: 0.5, maxRepeats: 1, tension: [0.25, 0.95], message: 'THE WHITEOUT ENTERS THE CORRIDOR', duration: 1.25, cue: 'machine-dropout', effect: { flicker: 0.9, silence: 1.45 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xe8fff9, intensity: 56, distance: 19.4, angle: 0.4,
      drainPerSecond: 0.0062, emergencyRechargePerSecond: 0.0018, flashCost: 0.31,
    },
  },
  evidence: {
    recharge: 0.28,
    entries: [
      'RESORT LOG 01 / WEATHER RADAR SHOWS THE STORM INSIDE THE BUILDING',
      'RESORT LOG 08 / CHAIRLIFT THREE RETURNS WITH WET FOOTPRINTS IN EVERY SEAT',
      'RESORT LOG 17 / THE SERVICE LIFT DESCENDS FAR BELOW THE MOUNTAIN BASE',
    ],
  },
  monster: {
    name: 'The Winter Guest', identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0.12, twitchStrength: 0.78 },
    sound: { breathPitch: 0.58, breathWeight: 0.62, stepWeight: 0.5, drag: 0.16 },
    skin: {
      type: 'faceless-shadow', body: 0x121716, accent: 0x596665,
      eye: null, emissiveIntensity: 0, scale: 1.08,
    },
    timing: {
      firstScare: [11, 18], scareInterval: [14, 24], firstChase: [39, 54],
      glimpseDuration: 1.25, stalkDuration: 21, pathRefresh: { stalk: 0.7, chase: 0.29 },
    },
    behavior: {
      sight: { range: 24, peripheralDot: 0.28, acquireRate: 1.18, threshold: 0.48 },
      hearing: { baseCells: 3, noiseCells: 10, chaseNoise: 0.72, reacquireNoise: 0.39 },
      chase: { lostSightDelay: 5.9, searchDuration: [9, 15], recovery: [15, 24] },
      wanderCells: [4, 9],
    },
    speeds: { watched: 0.26, stalk: 1.3, chase: 3.58 },
    stalkTriggerDistance: 12.2,
    catchDistance: 0.92,
  },
};
