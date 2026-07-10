// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'greenhouse',
  index: 20,
  name: 'Greenhouse',
  exit: { label: 'POTTING LIFT' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 20',
    status: 'GROWTH CYCLE EXCEEDS ENCLOSURE',
    start: {
      kicker: 'HORTICULTURE WING / ARTIFICIAL DAWN',
      title: 'THE PLANTS<br />TURN TO LISTEN.',
      body: 'Open four irrigation valves. Do not touch leaves that are warmer than your skin.',
      button: 'ENTER LEVEL 20',
    },
    pause: {
      kicker: 'PHOTOSYNTHESIS INTERRUPTED',
      title: 'KEEP<br />BREATHING.',
      body: 'The condensation on the glass is spelling a word from the outside.',
      button: 'RETURN TO DAWN',
    },
    death: {
      kicker: 'NUTRIENT CYCLE COMPLETE',
      title: 'ROOTED<br />IN PLACE.',
      body: 'A new bed has been labeled with your blood type.',
      button: 'GERMINATE AGAIN',
    },
    win: {
      kicker: 'POTTING LIFT RELEASED',
      title: 'THE ROOTS<br />FOLLOW DOWN.',
      body: 'The service lift drops past soil into an annex of blue server lights and cold fans.',
      button: 'DESCEND TO LEVEL 21',
    },
  },
  maze: {
    desktop: { cols: 25, rows: 25 },
    mobile: { cols: 19, rows: 19 },
    loopRatio: 0.34,
    roomDivisor: 41,
    minimumRooms: 10,
    roomSize: { min: 3, max: 5 },
    seedSalt: 0xa63f19d4,
  },
  surfaces: {
    wall: {
      base: [105, 133, 103], accent: [59, 96, 64], grime: [30, 57, 35],
      pattern: 'condensation-glass', roughness: 0.36, metalness: 0.03, bumpScale: 0.026,
      grimeOpacity: 0.22,
    },
    floor: {
      base: [78, 86, 55], accent: [104, 111, 70], grime: [38, 46, 28],
      pattern: 'flooded-concrete', roughness: 0.61, metalness: 0.02, bumpScale: 0.04,
    },
    ceiling: {
      base: [116, 141, 112], accent: [72, 105, 76], grime: [38, 67, 42],
      pattern: 'dripping-glass', roughness: 0.4, metalness: 0.04, bumpScale: 0.03,
      emissive: 0x1e3d22, emissiveIntensity: 0.26,
    },
    trim: { color: 0x496b4a, roughness: 0.58, metalness: 0.2 },
  },
  fog: { color: 0x365c3a, density: { desktop: 0.04, mobile: 0.047 } },
  lighting: {
    exposure: 0.91,
    hemisphere: {
      sky: 0xc6e9a3, ground: 0x172719,
      intensity: { desktop: 0.57, mobile: 0.65 },
    },
    ambient: { color: 0x7eaa65, intensity: { desktop: 0.22, mobile: 0.3 } },
    fixture: {
      color: 0xdfffa9, panelColor: 0xeaffb7, deadPanelColor: 0x3e593d,
      intensity: 109, distance: 12.9, angle: 1.25, penumbra: 0.86, decay: 2,
      brokenChance: 0.16, pool: { desktop: 7, mobile: 4 },
      flicker: { idleRate: 2.9, idleDepth: 0.051, faultFloor: 0.02, recovery: 0.4 },
    },
  },
  audio: {
    drips: true,
    masterGain: 0.73,
    humGain: 0.054,
    oscillators: [
      { frequency: 45, type: 'sine', gain: 0.24 },
      { frequency: 90, type: 'triangle', gain: 0.044 },
      { frequency: 22, type: 'sine', gain: 0.15 },
      { frequency: 180, type: 'sawtooth', gain: 0.011 },
    ],
    noise: { filter: 'bandpass', frequency: 360, q: 0.58, gain: 0.039 },
    heartbeat: { startFrequency: 62, endFrequency: 33 },
    impact: { startFrequency: 38, endFrequency: 12 },
    footstep: { walkLowpass: 175, runLowpass: 245 },
    ambience: {
      interval: [8, 20], cues: ['irrigation-splash', 'glass-knock', 'root-drag', 'steam-breath'],
      stereoWidth: 0.95, silenceChance: 0.16,
    },
  },
  objective: {
    type: 'valve', count: 4, color: 0x8ee56f,
    labels: {
      hud: 'STOP THE IRRIGATION', item: 'IRRIGATION VALVE', itemPlural: 'IRRIGATION VALVES',
      interact: 'E  CLOSE VALVE', progress: 'VALVES {current}/{total}',
      locked: 'THE POTTING LIFT IS FLOODED', complete: 'WATER FALLING / FIND THE POTTING LIFT',
    },
  },
  props: [
    { type: 'wall-pipe', density: 0.11, color: 0x53715a, accent: 0x273a2b, cluster: [2, 6] },
    { type: 'standing-water', density: 0.14, color: 0x315b42, accent: 0x7cbe7f, cluster: [2, 7] },
    { type: 'drain-grate', density: 0.034, color: 0x38493d, accent: 0x18221b, cluster: [1, 3] },
    { type: 'service-crate', density: 0.021, color: 0x6d7955, accent: 0x333c28, cluster: [1, 4] },
    { type: 'hanging-chain', density: 0.038, color: 0x4b5d4e, accent: 0x222d24, cluster: [1, 4] },
  ],
  incidents: {
    density: 0.018, minCount: 3, maxCount: 9, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.4, 'abandoned-pack': 0.8, 'chair-pile': 0.4,
      'black-motes': 2.3, 'shoe-trail': 1.2,
    },
    palette: { cloth: 0x314834, clothLight: 0x78906f, motes: 0x051007 },
  },
  atmosphere: {
    identity: 'overgrown-artificial-dawn-house',
    cadence: { first: [8, 15], interval: [12, 23] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'crop-tag', text: 'CULTIVAR: TENANT / HARVEST: OVERDUE', density: 0.008, placement: 'wall' },
      { id: 'root-arrow', text: 'ROOT DEPTH → BELOW FOUNDATION', density: 0.008, placement: 'floor' },
      { id: 'irrigation-tag', text: 'FEED LINE ACCEPTS ONLY BODY HEAT', density: 0.005, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'leaves-turn', progress: 0.25, message: 'EVERY LEAF TURNS ITS UNDERSIDE TOWARD YOU',
        duration: 1.16, cue: 'root-drag', effect: { flicker: 0.4 },
      },
      {
        id: 'glass-rain', progress: 0.75, message: 'RAIN FALLS UP THE OUTSIDE OF THE GLASS',
        duration: 1.25, cue: 'irrigation-splash', effect: { glitch: 0.34, silence: 0.6 },
      },
    ],
    events: [
      {
        id: 'vine-drag', earliest: 6, weight: 1.2, maxRepeats: 3,
        tension: [0.03, 0.87], message: 'A VINE DRAGS ACROSS THE GLASS ROOF',
        duration: 1.08, cue: 'root-drag', pan: 'random',
      },
      {
        id: 'sprinkler-breath', earliest: 15, weight: 0.94, maxRepeats: 2,
        tension: [0.1, 0.84], message: 'THE SPRINKLERS EXHALE WARM MIST',
        duration: 1.14, cue: 'steam-breath', effect: { flicker: 0.35 },
      },
      {
        id: 'glass-tap', earliest: 24, weight: 0.76, maxRepeats: 2,
        tension: [0.16, 0.9], message: 'SOMETHING TAPS FROM ABOVE THE GLASS',
        duration: 1.17, cue: 'glass-knock', pan: 'random',
      },
      {
        id: 'grow-lights', earliest: 37, weight: 0.5, maxRepeats: 1,
        tension: [0.27, 0.93], message: 'THE GROW LIGHTS FOLLOW YOUR SHADOW',
        duration: 1.28, cue: 'fluorescent-dropout', effect: { flicker: 1.05, silence: 1.15 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xddffc5, intensity: 63, distance: 20.8, angle: 0.38,
      drainPerSecond: 0.006, emergencyRechargePerSecond: 0.002, flashCost: 0.3,
    },
  },
  evidence: {
    recharge: 0.3,
    entries: [
      'GROWTH LOG 06 / ROOTS RETREAT WHEN ADDRESSED BY NAME',
      'GROWTH LOG 15 / PHOTOSYNTHESIS CONTINUES IN TOTAL DARK',
      'GROWTH LOG 24 / THE POTTING LIFT DELIVERS FRESH SOIL FROM BELOW',
    ],
  },
  monster: {
    name: 'The Gardener',
    identity: 'wader',
    presentation: { silhouette: 'waterlogged-dragger', eyePulse: 0.37, twitchStrength: 0.74 },
    sound: { breathPitch: 0.53, breathWeight: 1.12, stepWeight: 0.88, drag: 0.81 },
    skin: {
      type: 'waterlogged-longlimb', body: 0x071008, accent: 0x3f713b,
      eye: 0xb4ff83, emissiveIntensity: 0.58, scale: 1.21,
    },
    timing: {
      firstScare: [8, 16], scareInterval: [11, 22], firstChase: [39, 55],
      glimpseDuration: 1.14, stalkDuration: 20,
      pathRefresh: { stalk: 0.5, chase: 0.25 },
    },
    behavior: {
      sight: { range: 16, peripheralDot: 0.1, acquireRate: 1.52, threshold: 0.39 },
      hearing: { baseCells: 5, noiseCells: 15, chaseNoise: 0.55, reacquireNoise: 0.31 },
      chase: { lostSightDelay: 6.7, searchDuration: [11, 17], recovery: [14, 23] },
      wanderCells: [4, 10],
    },
    speeds: { watched: 0.54, stalk: 1.37, chase: 3.73 },
    stalkTriggerDistance: 12.1,
    catchDistance: 0.99,
  },
};
