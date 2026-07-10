// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'flooded-station',
  index: 26,
  name: 'Flooded Station',
  exit: { label: 'DOWN LINE' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 26',
    status: 'PLATFORMS SUBMERGED',
    start: {
      kicker: 'METRO TERMINUS / SERVICE ENDED',
      title: 'THE LAST TRAIN<br />IS UNDERWATER.',
      body: 'Open four flood valves. Platform announcements carry through tunnels filled to the ceiling.',
      button: 'ENTER LEVEL 26',
    },
    pause: {
      kicker: 'SIGNAL HELD AT RED',
      title: 'THE WATER<br />KEEPS ARRIVING.',
      body: 'A train passes behind the tiled wall without disturbing the flood.',
      button: 'RETURN TO PLATFORM',
    },
    death: {
      kicker: 'PASSENGER RECOVERED',
      title: 'MIND<br />THE GAP.',
      body: 'Your reflection boarded before the water reached your face.',
      button: 'WAIT FOR NEXT TRAIN',
    },
    win: {
      kicker: 'DOWN LINE DRAINED',
      title: 'THE TRACKS<br />SLOPE AWAY.',
      body: 'Past the signal, snow blows through a tunnel that has never seen the sky.',
      button: 'DESCEND TO LEVEL 27',
    },
  },
  maze: {
    desktop: { cols: 25, rows: 29 },
    mobile: { cols: 17, rows: 21 },
    loopRatio: 0.24,
    roomDivisor: 56,
    minimumRooms: 8,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0xe5a0bd26,
  },
  surfaces: {
    wall: {
      base: [104, 125, 128], accent: [69, 91, 96], grime: [34, 52, 56],
      pattern: 'seeping-concrete', roughness: 0.72, metalness: 0.04, bumpScale: 0.058,
      grimeOpacity: 0.31,
    },
    floor: {
      base: [64, 91, 98], accent: [43, 68, 76], grime: [25, 43, 49],
      pattern: 'flooded-concrete', roughness: 0.29, metalness: 0.11, bumpScale: 0.02,
    },
    ceiling: {
      base: [86, 107, 112], accent: [57, 77, 83], grime: [30, 47, 52],
      pattern: 'dripping-concrete', roughness: 0.85, metalness: 0.04, bumpScale: 0.064,
      emissive: 0x14252a, emissiveIntensity: 0.16,
    },
    trim: { color: 0x426871, roughness: 0.55, metalness: 0.3 },
  },
  fog: { color: 0x263f47, density: { desktop: 0.052, mobile: 0.059 } },
  lighting: {
    exposure: 0.74,
    hemisphere: { sky: 0x9ecbd0, ground: 0x0d171b, intensity: { desktop: 0.4, mobile: 0.48 } },
    ambient: { color: 0x4f7d86, intensity: { desktop: 0.17, mobile: 0.24 } },
    fixture: {
      color: 0xc3f2f2, panelColor: 0xd7ffff, deadPanelColor: 0x263a3f,
      intensity: 76, distance: 10.2, angle: 1.1, penumbra: 0.93, decay: 2,
      brokenChance: 0.34, pool: { desktop: 5, mobile: 3 },
      flicker: { idleRate: 2.7, idleDepth: 0.06, faultFloor: 0.006, recovery: 0.49 },
    },
  },
  audio: {
    drips: true, masterGain: 0.81, humGain: 0.05,
    oscillators: [
      { frequency: 36, type: 'sine', gain: 0.31 },
      { frequency: 72, type: 'triangle', gain: 0.045 },
      { frequency: 18, type: 'sine', gain: 0.18 },
    ],
    noise: { filter: 'lowpass', frequency: 270, q: 0.48, gain: 0.052 },
    heartbeat: { startFrequency: 55, endFrequency: 29 },
    impact: { startFrequency: 34, endFrequency: 11 },
    footstep: { walkLowpass: 150, runLowpass: 210 },
    ambience: {
      interval: [8, 18],
      cues: ['far-splash', 'submerged-knock', 'drain-breath', 'water-dropout'],
      stereoWidth: 1,
      silenceChance: 0.13,
    },
  },
  objective: {
    type: 'valve', count: 4, color: 0x65bec8,
    labels: {
      hud: 'DOWN LINE FLOODED', item: 'FLOOD VALVE', itemPlural: 'FLOOD VALVES',
      interact: 'E  OPEN FLOOD VALVE', progress: 'FLOOD VALVES {current}/{total}',
      locked: 'THE DOWN LINE IS SUBMERGED', complete: 'TRACK BED DRAINING / FIND DOWN LINE',
    },
  },
  props: [
    { type: 'standing-water', density: 0.16, color: 0x315964, accent: 0x80bbc3, cluster: [3, 8] },
    { type: 'wall-pipe', density: 0.09, color: 0x43646a, accent: 0x213237, cluster: [2, 5] },
    { type: 'drain-grate', density: 0.045, color: 0x293d42, accent: 0x111a1d, cluster: [1, 3] },
    { type: 'discarded-chair', density: 0.014, color: 0x36535a, accent: 0x66858c, cluster: [1, 3] },
    { type: 'hanging-chain', density: 0.03, color: 0x40585d, accent: 0x1e2a2d, cluster: [1, 4] },
  ],
  incidents: {
    density: 0.021, minCount: 4, maxCount: 11, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.4, 'abandoned-pack': 0.75, 'chair-pile': 0.4,
      'black-motes': 1.3, 'shoe-trail': 2,
    },
    palette: { cloth: 0x27434a, clothLight: 0x52747c, motes: 0x050b0d },
  },
  atmosphere: {
    identity: 'submerged-last-metro-terminus',
    cadence: { first: [7, 12], interval: [12, 21] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'service-board', text: 'LAST SERVICE 00:00 / DESTINATION BELOW', density: 0.008, placement: 'wall' },
      { id: 'platform-mark', text: 'STAND BEHIND THE WATERLINE', density: 0.007, placement: 'floor' },
      { id: 'pump-label', text: 'PUMP LOAD / EXCEEDS OCEAN VOLUME', density: 0.006, placement: 'objective' },
    ],
    milestones: [
      { id: 'train-approach', progress: 0.25, message: 'HEADLIGHTS MOVE BENEATH THE BLACK WATER', duration: 1.2, cue: 'pressure-groan' },
      { id: 'platform-crowd', progress: 0.75, message: 'WET FOOTPRINTS QUEUE AT THE PLATFORM EDGE', duration: 1.22, cue: 'far-splash', effect: { glitch: 0.36 } },
    ],
    events: [
      { id: 'tunnel-splash', earliest: 5, weight: 1.3, maxRepeats: 3, tension: [0.01, 0.92], message: 'A SPLASH RUNS THE LENGTH OF THE TUNNEL', duration: 1.08, cue: 'far-splash', pan: 'random' },
      { id: 'rail-knock', earliest: 11, weight: 1.05, maxRepeats: 3, tension: [0.06, 0.9], message: 'SOMETHING KNOCKS FROM BENEATH THE TRACK', duration: 1.1, cue: 'submerged-knock', pan: 'random' },
      { id: 'station-breath', earliest: 19, weight: 0.82, maxRepeats: 2, tension: [0.12, 0.92], message: 'THE FLOODED TUNNEL EXHALES THROUGH EVERY DRAIN', duration: 1.2, cue: 'drain-breath', effect: { flicker: 0.42 } },
      { id: 'water-still', earliest: 30, weight: 0.56, maxRepeats: 1, tension: [0.22, 0.96], message: 'THE WATER BECOMES PERFECTLY STILL', duration: 1.25, cue: 'water-dropout', effect: { flicker: 0.95, silence: 1.6 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xc9f8fa, intensity: 59, distance: 21, angle: 0.35,
      drainPerSecond: 0.0067, emergencyRechargePerSecond: 0.0017, flashCost: 0.34,
    },
  },
  evidence: {
    recharge: 0.26,
    entries: [
      'TRANSIT LOG 05 / THE FLOOD ARRIVED FROM BOTH ENDS OF A CLOSED TUNNEL',
      'TRANSIT LOG 13 / AN EMPTY TRAIN STILL OPENS ITS DOORS AT PLATFORM ZERO',
      'TRANSIT LOG 22 / THE WATER REFLECTS PASSENGERS WHO NEVER ENTERED',
    ],
  },
  monster: {
    name: 'The Drowned Commuter', identity: 'wader',
    presentation: { silhouette: 'waterlogged-dragger', eyePulse: 0.6, twitchStrength: 0.48 },
    sound: { breathPitch: 0.46, breathWeight: 1.12, stepWeight: 1.02, drag: 0.78 },
    skin: {
      type: 'waterlogged-longlimb', body: 0x071215, accent: 0x346a75,
      eye: 0x98e6ef, emissiveIntensity: 0.66, scale: 1.2,
    },
    timing: {
      firstScare: [8, 14], scareInterval: [11, 21], firstChase: [34, 48],
      glimpseDuration: 1.05, stalkDuration: 18, pathRefresh: { stalk: 0.48, chase: 0.22 },
    },
    behavior: {
      sight: { range: 16, peripheralDot: 0.1, acquireRate: 1.62, threshold: 0.38 },
      hearing: { baseCells: 5, noiseCells: 15, chaseNoise: 0.52, reacquireNoise: 0.29 },
      chase: { lostSightDelay: 6.8, searchDuration: [11, 17], recovery: [13, 20] },
      wanderCells: [3, 9],
    },
    speeds: { watched: 0.54, stalk: 1.5, chase: 3.94 },
    stalkTriggerDistance: 10.8,
    catchDistance: 1,
  },
};
