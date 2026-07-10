// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'research-lab',
  index: 16,
  name: 'Research Lab',
  exit: { label: 'DECON' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 16',
    status: 'BIOCONTAINMENT MEMORY LEAK',
    start: {
      kicker: 'SUBJECT WING / CLEARANCE REVOKED',
      title: 'THE LAB<br />REMEMBERS YOU.',
      body: 'Seat four containment cells. Ignore any observation window that reflects an occupied room.',
      button: 'ENTER LEVEL 16',
    },
    pause: {
      kicker: 'EXPERIMENT SUSPENDED',
      title: 'REMAIN<br />OBSERVABLE.',
      body: 'The intercom is dictating notes in a voice identical to yours.',
      button: 'CONTINUE TRIAL',
    },
    death: {
      kicker: 'SUBJECT NONVIABLE',
      title: 'CONTROL GROUP<br />RETAINED.',
      body: 'Your specimen label has a collection date from next week.',
      button: 'RESTART PROTOCOL',
    },
    win: {
      kicker: 'DECONTAMINATION SEALED',
      title: 'THE SHOWER<br />FALLS FOREVER.',
      body: 'Beyond the chemical mist, apartment wallpaper descends beside a concrete stair.',
      button: 'DESCEND TO LEVEL 17',
    },
  },
  maze: {
    desktop: { cols: 21, rows: 27 },
    mobile: { cols: 17, rows: 21 },
    loopRatio: 0.18,
    roomDivisor: 52,
    minimumRooms: 7,
    roomSize: { min: 2, max: 4 },
    seedSalt: 0xc41d7b36,
  },
  surfaces: {
    wall: {
      base: [184, 196, 191], accent: [119, 149, 144], grime: [58, 81, 78],
      pattern: 'sealed-lab-panel', roughness: 0.48, metalness: 0.08, bumpScale: 0.028,
      grimeOpacity: 0.14,
    },
    floor: {
      base: [133, 151, 148], accent: [89, 111, 110], grime: [45, 65, 65],
      pattern: 'chemical-vinyl-tile', roughness: 0.42, metalness: 0.04, bumpScale: 0.021,
    },
    ceiling: {
      base: [170, 183, 180], accent: [118, 139, 137], grime: [64, 82, 82],
      pattern: 'service-slab', roughness: 0.67, metalness: 0.09, bumpScale: 0.036,
      emissive: 0x253a39, emissiveIntensity: 0.2,
    },
    trim: { color: 0x557b77, roughness: 0.52, metalness: 0.24 },
  },
  fog: { color: 0x547570, density: { desktop: 0.026, mobile: 0.033 } },
  lighting: {
    exposure: 0.96,
    hemisphere: {
      sky: 0xd9fff6, ground: 0x21332f,
      intensity: { desktop: 0.62, mobile: 0.69 },
    },
    ambient: { color: 0x8cc9be, intensity: { desktop: 0.24, mobile: 0.31 } },
    fixture: {
      color: 0xe9fff8, panelColor: 0xf1fffb, deadPanelColor: 0x526b67,
      intensity: 116, distance: 12.1, angle: 1.26, penumbra: 0.82, decay: 2,
      brokenChance: 0.13, pool: { desktop: 8, mobile: 4 },
      flicker: { idleRate: 7.3, idleDepth: 0.024, faultFloor: 0.025, recovery: 0.3 },
    },
  },
  audio: {
    drips: true,
    masterGain: 0.7,
    humGain: 0.066,
    oscillators: [
      { frequency: 58, type: 'sine', gain: 0.22 },
      { frequency: 116, type: 'sawtooth', gain: 0.026 },
      { frequency: 29, type: 'sine', gain: 0.11 },
      { frequency: 232, type: 'triangle', gain: 0.014 },
    ],
    noise: { filter: 'highpass', frequency: 840, q: 0.48, gain: 0.029 },
    heartbeat: { startFrequency: 66, endFrequency: 37 },
    impact: { startFrequency: 51, endFrequency: 19 },
    footstep: { walkLowpass: 390, runLowpass: 510 },
    ambience: {
      interval: [12, 25], cues: ['relay-chatter', 'airlock-bell', 'steam-release', 'glass-knock'],
      stereoWidth: 0.86, silenceChance: 0.22,
    },
  },
  objective: {
    type: 'fuse', count: 4, color: 0x6fffd3,
    labels: {
      hud: 'RESTORE CONTAINMENT', item: 'CONTAINMENT CELL', itemPlural: 'CONTAINMENT CELLS',
      interact: 'E  SEAT CELL', progress: 'CELLS {current}/{total}',
      locked: 'DECON REMAINS SEALED', complete: 'CONTAINMENT NOMINAL / FIND DECON',
    },
  },
  props: [
    { type: 'cable-tray', density: 0.082, color: 0x5f7471, accent: 0x2a3c39, cluster: [2, 5] },
    { type: 'wall-pipe', density: 0.063, color: 0x79928d, accent: 0x3d5551, cluster: [1, 4] },
    { type: 'ceiling-vent', density: 0.052, color: 0x6e8581, accent: 0x344743, cluster: [1, 3] },
    { type: 'lab-table', density: 0.024, color: 0xb2c0b5, accent: 0x52665e, cluster: [1, 3] },
    { type: 'standing-water', density: 0.038, color: 0x557a75, accent: 0xa0dbd0, cluster: [1, 4] },
  ],
  incidents: {
    density: 0.014, minCount: 2, maxCount: 7, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 1.3, 'abandoned-pack': 1.5, 'chair-pile': 0.35,
      'black-motes': 1.7, 'shoe-trail': 0.65,
    },
    palette: { cloth: 0x506762, clothLight: 0xa6bbb3, motes: 0x07100e },
  },
  atmosphere: {
    identity: 'recursive-biomedical-subject-wing',
    cadence: { first: [10, 18], interval: [14, 26] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'subject-card', text: 'SUBJECT: YOU / BASELINE: NOT HUMAN', density: 0.007, placement: 'wall' },
      { id: 'sample-arrow', text: 'SAMPLE RETURN → BEFORE COLLECTION', density: 0.006, placement: 'floor' },
      { id: 'cell-warning', text: 'CELL MUST REMAIN COLDER THAN MEMORY', density: 0.006, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'glass-breath', progress: 0.25, message: 'BREATH FOGS THE OTHER SIDE OF THE GLASS',
        duration: 1.18, cue: 'glass-knock', effect: { glitch: 0.2 },
      },
      {
        id: 'specimen-match', progress: 0.75, message: 'THE SPECIMEN LABEL UPDATES TO YOUR NAME',
        duration: 1.26, cue: 'airlock-bell', effect: { flicker: 0.62, silence: 0.65 },
      },
    ],
    events: [
      {
        id: 'centrifuge-spin', earliest: 8, weight: 1.16, maxRepeats: 3,
        tension: [0.04, 0.85], message: 'A CENTRIFUGE SPINS UP IN AN EMPTY LAB',
        duration: 1.08, cue: 'relay-chatter', pan: 'random',
      },
      {
        id: 'airlock-cycle', earliest: 18, weight: 0.9, maxRepeats: 2,
        tension: [0.12, 0.83], message: 'AN AIRLOCK CYCLES WITHOUT OPENING',
        duration: 1.14, cue: 'steam-release', effect: { flicker: 0.38 },
      },
      {
        id: 'observation-tap', earliest: 26, weight: 0.76, maxRepeats: 2,
        tension: [0.2, 0.9], message: 'THREE KNUCKLES TAP FROM INSIDE THE WALL',
        duration: 1.17, cue: 'glass-knock', pan: 'random',
      },
      {
        id: 'trial-reset', earliest: 41, weight: 0.48, maxRepeats: 1,
        tension: [0.3, 0.94], message: 'THE INTERCOM ANNOUNCES TRIAL NUMBER ZERO',
        duration: 1.3, cue: 'airlock-bell', effect: { glitch: 0.6, silence: 1.2 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xd6fff5, intensity: 64, distance: 21, angle: 0.38,
      drainPerSecond: 0.0058, emergencyRechargePerSecond: 0.0021, flashCost: 0.29,
    },
  },
  evidence: {
    recharge: 0.31,
    entries: [
      'TRIAL 04 / SUBJECT RECOGNIZED THE ROOM FROM BIRTH',
      'TRIAL 12 / CONTROL SAMPLE CONTINUES TO WHISPER',
      'TRIAL 19 / DECON REMOVES EVERYTHING EXCEPT THE SUBJECT',
    ],
  },
  monster: {
    name: 'The Principal Investigator',
    identity: 'foreman',
    presentation: { silhouette: 'asymmetric-maintenance-husk', eyePulse: 0.72, twitchStrength: 0.93 },
    sound: { breathPitch: 0.86, breathWeight: 0.74, stepWeight: 1.04, drag: 0.09 },
    skin: {
      type: 'maintenance-husk', body: 0x0a1412, accent: 0x4aa68e,
      eye: 0x91ffe0, emissiveIntensity: 1.85, scale: 1.06,
    },
    timing: {
      firstScare: [11, 19], scareInterval: [13, 25], firstChase: [45, 64],
      glimpseDuration: 1.12, stalkDuration: 24,
      pathRefresh: { stalk: 0.62, chase: 0.3 },
    },
    behavior: {
      sight: { range: 25, peripheralDot: 0.2, acquireRate: 1.35, threshold: 0.43 },
      hearing: { baseCells: 3, noiseCells: 11, chaseNoise: 0.67, reacquireNoise: 0.39 },
      chase: { lostSightDelay: 5.7, searchDuration: [9, 15], recovery: [17, 26] },
      wanderCells: [3, 8],
    },
    speeds: { watched: 0.34, stalk: 1.23, chase: 3.53 },
    stalkTriggerDistance: 11.1,
    catchDistance: 0.93,
  },
};
