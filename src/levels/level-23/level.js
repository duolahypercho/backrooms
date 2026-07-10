// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'museum-storage',
  index: 23,
  name: 'Museum Storage',
  exit: { label: 'FREIGHT' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 23',
    status: 'COLLECTION ACCESS REVOKED',
    start: {
      kicker: 'OFFSITE COLLECTION / AISLE UNKNOWN',
      title: 'NOTHING HERE<br />IS ON DISPLAY.',
      body: 'Restore three conservation circuits. Every covered shape has a matching catalog card except one.',
      button: 'ENTER LEVEL 23',
    },
    pause: {
      kicker: 'INVENTORY FROZEN',
      title: 'THE PORTRAITS<br />TURN UNSEEN.',
      body: 'Canvas cloth settles where no air should move.',
      button: 'CONTINUE INVENTORY',
    },
    death: {
      kicker: 'ACCESSION COMPLETE',
      title: 'OBJECT<br />UNIDENTIFIED.',
      body: 'A fresh catalog number was tied around your wrist.',
      button: 'REOPEN CRATE',
    },
    win: {
      kicker: 'FREIGHT CONTROL RESTORED',
      title: 'THE COLLECTION<br />HAS A BASEMENT.',
      body: 'The freight car descends while something scratches inside the walls.',
      button: 'DESCEND TO LEVEL 24',
    },
  },
  maze: {
    desktop: { cols: 23, rows: 25 },
    mobile: { cols: 17, rows: 19 },
    loopRatio: 0.2,
    roomDivisor: 50,
    minimumRooms: 9,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0xb27d5a23,
  },
  surfaces: {
    wall: {
      base: [128, 124, 112], accent: [88, 84, 74], grime: [42, 40, 35],
      pattern: 'painted-concrete', roughness: 0.82, metalness: 0.02, bumpScale: 0.04,
      grimeOpacity: 0.2,
    },
    floor: {
      base: [92, 83, 69], accent: [64, 57, 47], grime: [35, 31, 27],
      pattern: 'oil-stained-concrete', roughness: 0.78, metalness: 0.01, bumpScale: 0.032,
    },
    ceiling: {
      base: [116, 114, 106], accent: [82, 80, 72], grime: [45, 44, 39],
      pattern: 'service-slab', roughness: 0.9, metalness: 0.04, bumpScale: 0.045,
      emissive: 0x28261f, emissiveIntensity: 0.17,
    },
    trim: { color: 0x5d5749, roughness: 0.74, metalness: 0.19 },
  },
  fog: { color: 0x4e4a40, density: { desktop: 0.033, mobile: 0.039 } },
  lighting: {
    exposure: 0.8,
    hemisphere: { sky: 0xc9c0a8, ground: 0x1c1a16, intensity: { desktop: 0.48, mobile: 0.56 } },
    ambient: { color: 0x786f5c, intensity: { desktop: 0.19, mobile: 0.26 } },
    fixture: {
      color: 0xffe4b4, panelColor: 0xffedc4, deadPanelColor: 0x3c392f,
      intensity: 82, distance: 11.3, angle: 1.12, penumbra: 0.9, decay: 2,
      brokenChance: 0.24, pool: { desktop: 6, mobile: 3 },
      flicker: { idleRate: 2.9, idleDepth: 0.04, faultFloor: 0.015, recovery: 0.36 },
    },
  },
  audio: {
    drips: false, masterGain: 0.7, humGain: 0.048,
    oscillators: [
      { frequency: 48, type: 'sine', gain: 0.2 },
      { frequency: 96, type: 'triangle', gain: 0.03 },
      { frequency: 24, type: 'sine', gain: 0.12 },
    ],
    noise: { filter: 'lowpass', frequency: 420, q: 0.6, gain: 0.03 },
    heartbeat: { startFrequency: 61, endFrequency: 32 },
    impact: { startFrequency: 43, endFrequency: 15 },
    footstep: { walkLowpass: 250, runLowpass: 330 },
    ambience: {
      interval: [12, 25],
      cues: ['distant-knock', 'chain-drag', 'ballast-pop', 'fluorescent-dropout'],
      stereoWidth: 0.9,
      silenceChance: 0.27,
    },
  },
  objective: {
    type: 'fuse', count: 3, color: 0xd4a763,
    labels: {
      hud: 'CONSERVATION GRID OFFLINE', item: 'CIRCUIT', itemPlural: 'CIRCUITS',
      interact: 'E  RESTORE CIRCUIT', progress: 'CONSERVATION CIRCUITS {current}/{total}',
      locked: 'THE FREIGHT CONTROL IS SEALED', complete: 'HUMIDITY STABLE / FIND FREIGHT',
    },
  },
  props: [
    { type: 'service-crate', density: 0.027, color: 0x685c48, accent: 0x9c8c68, cluster: [1, 4] },
    { type: 'discarded-chair', density: 0.014, color: 0x4b4337, accent: 0x796d56, cluster: [1, 3] },
    { type: 'hanging-chain', density: 0.035, color: 0x5a554b, accent: 0x292722, cluster: [1, 4] },
    { type: 'ceiling-vent', density: 0.045, color: 0x77736a, accent: 0x3b3934, cluster: [1, 3] },
    { type: 'square-column', density: 0.018, color: 0x827d70, accent: 0x4d493f, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.016, minCount: 3, maxCount: 10, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 0.8, 'abandoned-pack': 1.45, 'chair-pile': 1.2,
      'black-motes': 1.35, 'shoe-trail': 0.75,
    },
    palette: { cloth: 0x51483a, clothLight: 0x8c7f66, motes: 0x0c0b09 },
  },
  atmosphere: {
    identity: 'sealed-museum-reserve-collection',
    cadence: { first: [10, 17], interval: [15, 27] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'catalog-tag', text: 'ACCESSION 1974.00 / DESCRIPTION REDACTED', density: 0.008, placement: 'objective' },
      { id: 'handling-sign', text: 'DO NOT UNCOVER WITHOUT TWO WITNESSES', density: 0.007, placement: 'wall' },
      { id: 'chalk-outline', text: 'FRAME RETURNED / CONTENT STILL MISSING', density: 0.006, placement: 'floor' },
    ],
    milestones: [
      { id: 'cloth-shift', progress: 0.33, message: 'EVERY DUST CLOTH LIFTS AT ONCE', duration: 1.15, cue: 'chain-drag' },
      { id: 'new-accession', progress: 0.66, message: 'A CATALOG TAG NOW BEARS YOUR HEIGHT', duration: 1.2, cue: 'distant-knock', effect: { glitch: 0.32 } },
    ],
    events: [
      { id: 'frame-knock', earliest: 8, weight: 1.2, maxRepeats: 3, tension: [0.03, 0.88], message: 'WOOD KNOCKS FROM INSIDE A SEALED CRATE', duration: 1.1, cue: 'distant-knock', pan: 'random' },
      { id: 'chain-sway', earliest: 15, weight: 0.95, maxRepeats: 2, tension: [0.08, 0.84], message: 'A HANGING CHAIN SWAYS WITHOUT SOUND', duration: 1.08, cue: 'chain-drag', pan: 'random' },
      { id: 'canvas-breathe', earliest: 23, weight: 0.8, maxRepeats: 2, tension: [0.14, 0.9], message: 'CANVAS STRETCHES LIKE A SLOW BREATH', duration: 1.2, cue: 'sub-bass-bump', effect: { flicker: 0.42 } },
      { id: 'gallery-dark', earliest: 36, weight: 0.52, maxRepeats: 1, tension: [0.26, 0.94], message: 'THE STORAGE AISLE BECOMES A GALLERY', duration: 1.25, cue: 'fluorescent-dropout', effect: { flicker: 0.92, silence: 1.3 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffe6b8, intensity: 53, distance: 18.5, angle: 0.39,
      drainPerSecond: 0.006, emergencyRechargePerSecond: 0.0018, flashCost: 0.3,
    },
  },
  evidence: {
    recharge: 0.29,
    entries: [
      'COLLECTION NOTE 03 / DUST ACCUMULATES BENEATH OBJECTS THAT ARE NOT THERE',
      'COLLECTION NOTE 11 / PORTRAIT EYES WERE REMOVED BEFORE THE BUILDING EXISTED',
      'COLLECTION NOTE 18 / THE FREIGHT CAR ACCEPTS ONE OBJECT AND ONE WITNESS',
    ],
  },
  monster: {
    name: 'The Registrar', identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.38, twitchStrength: 0.62 },
    sound: { breathPitch: 0.62, breathWeight: 0.72, stepWeight: 0.82, drag: 0.36 },
    skin: {
      type: 'maintenance-husk', body: 0x171510, accent: 0x594b35,
      eye: 0xba843b, emissiveIntensity: 0.36, scale: 1.08,
    },
    timing: {
      firstScare: [12, 20], scareInterval: [15, 27], firstChase: [42, 58],
      glimpseDuration: 1.25, stalkDuration: 21, pathRefresh: { stalk: 0.66, chase: 0.29 },
    },
    behavior: {
      sight: { range: 20, peripheralDot: 0.19, acquireRate: 1.28, threshold: 0.45 },
      hearing: { baseCells: 3, noiseCells: 11, chaseNoise: 0.69, reacquireNoise: 0.37 },
      chase: { lostSightDelay: 5.8, searchDuration: [9, 14], recovery: [16, 24] },
      wanderCells: [3, 8],
    },
    speeds: { watched: 0.42, stalk: 1.32, chase: 3.62 },
    stalkTriggerDistance: 11.8,
    catchDistance: 0.94,
  },
};
