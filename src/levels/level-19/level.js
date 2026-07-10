// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'archive-stacks',
  index: 19,
  name: 'Archive Stacks',
  exit: { label: 'RESTRICTED' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 19',
    status: 'CATALOG INDEX SELF-REFERENTIAL',
    start: {
      kicker: 'RECORDS ANNEX / SUB-BASEMENT ∞',
      title: 'EVERY FILE<br />IS ABOUT YOU.',
      body: 'Open three humidity controls. Do not read folders that are warm to the touch.',
      button: 'ENTER LEVEL 19',
    },
    pause: {
      kicker: 'CATALOG SEARCH PAUSED',
      title: 'THE PAPER<br />IS STILL TURNING.',
      body: 'Index drawers are opening one by one beyond the edge of the light.',
      button: 'RESUME SEARCH',
    },
    death: {
      kicker: 'RECORD CLOSED',
      title: 'FILED<br />UNDER MISSING.',
      body: 'Your final page was already brittle with age.',
      button: 'REOPEN RECORD',
    },
    win: {
      kicker: 'RESTRICTED STACK RELEASED',
      title: 'THE LAST SHELF<br />GROWS ROOTS.',
      body: 'Warm green light leaks from a stairwell choked with wet leaves and irrigation pipe.',
      button: 'DESCEND TO LEVEL 20',
    },
  },
  maze: {
    desktop: { cols: 27, rows: 25 },
    mobile: { cols: 21, rows: 19 },
    loopRatio: 0.15,
    roomDivisor: 68,
    minimumRooms: 6,
    roomSize: { min: 2, max: 3 },
    seedSalt: 0x754ab8e2,
  },
  surfaces: {
    wall: {
      base: [119, 103, 78], accent: [82, 69, 52], grime: [39, 33, 26],
      pattern: 'dusty-plaster', roughness: 0.96, metalness: 0, bumpScale: 0.065,
      grimeOpacity: 0.28,
    },
    floor: {
      base: [79, 65, 48], accent: [104, 81, 55], grime: [35, 30, 25],
      pattern: 'worn-linoleum-tile', roughness: 0.86, metalness: 0.01, bumpScale: 0.044,
    },
    ceiling: {
      base: [104, 96, 81], accent: [73, 65, 54], grime: [40, 36, 31],
      pattern: 'acoustic-tile', roughness: 0.94, metalness: 0, bumpScale: 0.043,
      emissive: 0x292317, emissiveIntensity: 0.21,
    },
    trim: { color: 0x554631, roughness: 0.88, metalness: 0.06 },
  },
  fog: { color: 0x493d2c, density: { desktop: 0.045, mobile: 0.052 } },
  lighting: {
    exposure: 0.92,
    hemisphere: {
      sky: 0xd2bb7d, ground: 0x1d1810,
      intensity: { desktop: 0.48, mobile: 0.56 },
    },
    ambient: { color: 0x8c7448, intensity: { desktop: 0.18, mobile: 0.25 } },
    fixture: {
      color: 0xffdf91, panelColor: 0xffe7a2, deadPanelColor: 0x493f30,
      intensity: 86, distance: 9.8, angle: 1.11, penumbra: 0.92, decay: 2,
      brokenChance: 0.23, pool: { desktop: 6, mobile: 3 },
      flicker: { idleRate: 3.7, idleDepth: 0.038, faultFloor: 0.013, recovery: 0.44 },
    },
  },
  audio: {
    drips: false,
    masterGain: 0.66,
    humGain: 0.037,
    oscillators: [
      { frequency: 49, type: 'sine', gain: 0.18 },
      { frequency: 98, type: 'triangle', gain: 0.034 },
      { frequency: 24, type: 'sine', gain: 0.14 },
      { frequency: 196, type: 'sine', gain: 0.008 },
    ],
    noise: { filter: 'lowpass', frequency: 280, q: 0.42, gain: 0.026 },
    heartbeat: { startFrequency: 59, endFrequency: 32 },
    impact: { startFrequency: 41, endFrequency: 14 },
    footstep: { walkLowpass: 195, runLowpass: 265 },
    ambience: {
      interval: [14, 30], cues: ['drawer-knock', 'paper-breath', 'desk-bell', 'shelf-groan'],
      stereoWidth: 0.79, silenceChance: 0.34,
    },
  },
  objective: {
    type: 'valve', count: 3, color: 0xd2ad61,
    labels: {
      hud: 'LOWER ARCHIVE HUMIDITY', item: 'HUMIDITY CONTROL', itemPlural: 'HUMIDITY CONTROLS',
      interact: 'E  OPEN CONTROL', progress: 'CONTROLS {current}/{total}',
      locked: 'RESTRICTED STACK IS SWOLLEN SHUT', complete: 'PAPER CONTRACTING / FIND RESTRICTED',
    },
  },
  props: [
    { type: 'retail-shelf', density: 0.026, color: 0x78684d, accent: 0x352d21, cluster: [2, 5] },
    { type: 'discarded-chair', density: 0.018, color: 0x594232, accent: 0x281e18, cluster: [1, 3] },
    { type: 'square-column', density: 0.017, color: 0x8e8066, accent: 0x524834, cluster: [1, 2] },
    { type: 'cable-tray', density: 0.072, color: 0x554e42, accent: 0x26231e, cluster: [3, 7] },
    { type: 'ceiling-vent', density: 0.029, color: 0x615b50, accent: 0x2b2924, cluster: [1, 3] },
  ],
  incidents: {
    density: 0.02, minCount: 4, maxCount: 10, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 0.8, 'abandoned-pack': 2.3, 'chair-pile': 1.2,
      'black-motes': 1.8, 'shoe-trail': 0.9,
    },
    palette: { cloth: 0x463c2d, clothLight: 0x837254, motes: 0x080704 },
  },
  atmosphere: {
    identity: 'self-cataloging-records-annex',
    cadence: { first: [13, 22], interval: [17, 29] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'catalog-card', text: 'SUBJECT FILE / UPDATED WHEN YOU BLINK', density: 0.009, placement: 'wall' },
      { id: 'aisle-index', text: 'AISLE 19 → AISLE 19 → AISLE 19', density: 0.007, placement: 'floor' },
      { id: 'humidity-note', text: 'PAPER MOISTURE SOURCE: RESPIRATION', density: 0.005, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'drawers-open', progress: 0.33, message: 'INDEX DRAWERS OPEN TOWARD YOUR POSITION',
        duration: 1.18, cue: 'drawer-knock', effect: { flicker: 0.37 },
      },
      {
        id: 'pages-turn', progress: 0.66, message: 'THOUSANDS OF PAGES TURN TO THE SAME DATE',
        duration: 1.24, cue: 'paper-breath', effect: { silence: 0.8, glitch: 0.3 },
      },
    ],
    events: [
      {
        id: 'drawer-slide', earliest: 10, weight: 1.2, maxRepeats: 3,
        tension: [0.04, 0.84], message: 'A CATALOG DRAWER SLIDES OPEN NEARBY',
        duration: 1.09, cue: 'drawer-knock', pan: 'random',
      },
      {
        id: 'paper-rustle', earliest: 20, weight: 0.96, maxRepeats: 2,
        tension: [0.12, 0.86], message: 'PAPER RUSTLES AGAINST THE AIRFLOW',
        duration: 1.14, cue: 'paper-breath', pan: 'random',
      },
      {
        id: 'request-bell', earliest: 31, weight: 0.68, maxRepeats: 2,
        tension: [0.2, 0.82], message: 'THE REQUEST DESK BELL RINGS ONCE',
        duration: 1.17, cue: 'desk-bell', effect: { glitch: 0.22 },
      },
      {
        id: 'shelf-lean', earliest: 45, weight: 0.44, maxRepeats: 1,
        tension: [0.3, 0.94], message: 'THE STACKS LEAN IN TO READ OVER YOUR SHOULDER',
        duration: 1.3, cue: 'shelf-groan', effect: { silence: 1.4, flicker: 0.9 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffe2ad, intensity: 58, distance: 19.4, angle: 0.35,
      drainPerSecond: 0.0067, emergencyRechargePerSecond: 0.0017, flashCost: 0.33,
    },
  },
  evidence: {
    recharge: 0.28,
    entries: [
      'CATALOG 05 / NEW FILES ARRIVE WITHOUT AUTHORS',
      'CATALOG 13 / YOUR RECORD HAS BEEN CHECKED OUT SINCE BIRTH',
      'CATALOG 22 / RESTRICTED MATERIAL GROWS WHEN READ',
    ],
  },
  monster: {
    name: 'The Archivist',
    identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0.08, twitchStrength: 0.96 },
    sound: { breathPitch: 0.56, breathWeight: 0.5, stepWeight: 0.64, drag: 0.31 },
    skin: {
      type: 'faceless-shadow', body: 0x060504, accent: 0x1c170f,
      eye: 0xd6b56f, emissiveIntensity: 0.09, scale: 1.12,
    },
    timing: {
      firstScare: [14, 23], scareInterval: [17, 30], firstChase: [50, 71],
      glimpseDuration: 1.38, stalkDuration: 26,
      pathRefresh: { stalk: 0.82, chase: 0.36 },
    },
    behavior: {
      sight: { range: 19, peripheralDot: 0.31, acquireRate: 1.05, threshold: 0.52 },
      hearing: { baseCells: 2, noiseCells: 7, chaseNoise: 0.82, reacquireNoise: 0.49 },
      chase: { lostSightDelay: 4.9, searchDuration: [8, 13], recovery: [21, 32] },
      wanderCells: [3, 7],
    },
    speeds: { watched: 0.16, stalk: 1.02, chase: 3.28 },
    stalkTriggerDistance: 9.9,
    catchDistance: 0.89,
  },
};
