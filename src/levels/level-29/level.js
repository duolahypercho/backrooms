// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'threshold-core',
  index: 29,
  name: 'Threshold Core',
  exit: { label: 'ORIGIN' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 29',
    status: 'CYCLE CONTROL EXPOSED',
    start: {
      kicker: 'THRESHOLD CORE / DEPTH ABSOLUTE',
      title: 'EVERY LEVEL<br />STARTED HERE.',
      body: 'Restore five origin relays. The walls are rehearsing every room you survived above.',
      button: 'ENTER LEVEL 29',
    },
    pause: {
      kicker: 'CYCLE SUSPENDED',
      title: 'THE CORE<br />REMEMBERS YOU.',
      body: 'Thirty corridors breathe in sequence around a door marked ORIGIN.',
      button: 'RESUME CYCLE',
    },
    death: {
      kicker: 'SUBJECT RETURNED',
      title: 'THE LOOP<br />CLOSES.',
      body: 'Your archive was already filed under the date of your next arrival.',
      button: 'REENTER CORE',
    },
    win: {
      kicker: 'ORIGIN RELAYS SYNCHRONIZED',
      title: 'THE FIRST ROOM<br />OPENS AGAIN.',
      body: 'Warm fluorescent light spills through ORIGIN. Somewhere above, the maze resets.',
      button: 'RETURN TO LEVEL 0',
    },
  },
  maze: {
    desktop: { cols: 27, rows: 27 },
    mobile: { cols: 19, rows: 19 },
    loopRatio: 0.29,
    roomDivisor: 40,
    minimumRooms: 12,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0x28d3f029,
  },
  surfaces: {
    wall: {
      base: [158, 151, 93], accent: [108, 104, 64], grime: [45, 42, 28],
      pattern: 'aged-wallpaper', roughness: 0.9, metalness: 0.01, bumpScale: 0.052,
      grimeOpacity: 0.23,
    },
    floor: {
      base: [72, 68, 46], accent: [48, 47, 34], grime: [29, 28, 22],
      pattern: 'damp-carpet', roughness: 0.92, metalness: 0, bumpScale: 0.06,
    },
    ceiling: {
      base: [165, 163, 132], accent: [119, 117, 91], grime: [68, 66, 52],
      pattern: 'acoustic-tile', roughness: 0.88, metalness: 0.02, bumpScale: 0.038,
      emissive: 0x3b371f, emissiveIntensity: 0.28,
    },
    trim: { color: 0x665e38, roughness: 0.74, metalness: 0.12 },
  },
  fog: { color: 0x5c5738, density: { desktop: 0.032, mobile: 0.038 } },
  lighting: {
    exposure: 0.9,
    hemisphere: { sky: 0xe5d679, ground: 0x211f12, intensity: { desktop: 0.62, mobile: 0.7 } },
    ambient: { color: 0x978a4d, intensity: { desktop: 0.25, mobile: 0.32 } },
    fixture: {
      color: 0xffe88f, panelColor: 0xfff2ae, deadPanelColor: 0x454130,
      intensity: 96, distance: 12.8, angle: 1.22, penumbra: 0.88, decay: 2,
      brokenChance: 0.27, pool: { desktop: 8, mobile: 4 },
      flicker: { idleRate: 4.7, idleDepth: 0.045, faultFloor: 0.01, recovery: 0.29 },
    },
  },
  audio: {
    drips: true, masterGain: 0.84, humGain: 0.09,
    oscillators: [
      { frequency: 60, type: 'sine', gain: 0.32 },
      { frequency: 120, type: 'triangle', gain: 0.05 },
      { frequency: 30, type: 'sine', gain: 0.16 },
      { frequency: 15, type: 'sine', gain: 0.12 },
    ],
    noise: { filter: 'bandpass', frequency: 560, q: 0.68, gain: 0.038 },
    heartbeat: { startFrequency: 68, endFrequency: 34 },
    impact: { startFrequency: 50, endFrequency: 16 },
    footstep: { walkLowpass: 245, runLowpass: 335 },
    ambience: {
      interval: [7, 17],
      cues: ['ballast-pop', 'distant-knock', 'relay-chatter', 'water-dropout'],
      stereoWidth: 1,
      silenceChance: 0.1,
    },
  },
  objective: {
    type: 'fuse', count: 5, color: 0xf0cf58,
    labels: {
      hud: 'ORIGIN CYCLE DESYNCHRONIZED', item: 'ORIGIN RELAY', itemPlural: 'ORIGIN RELAYS',
      interact: 'E  SYNCHRONIZE RELAY', progress: 'ORIGIN RELAYS {current}/{total}',
      locked: 'ORIGIN REJECTS THE CURRENT CYCLE', complete: 'CYCLE SYNCHRONIZED / FIND ORIGIN',
    },
  },
  props: [
    { type: 'square-column', density: 0.026, color: 0x918853, accent: 0x615b38, cluster: [1, 3] },
    { type: 'wall-pipe', density: 0.065, color: 0x625d45, accent: 0x302e23, cluster: [2, 5] },
    { type: 'cable-tray', density: 0.06, color: 0x5b5a48, accent: 0x2b2b23, cluster: [2, 5] },
    { type: 'standing-water', density: 0.045, color: 0x4c584d, accent: 0x8d9668, cluster: [2, 5] },
    { type: 'discarded-chair', density: 0.016, color: 0x504d35, accent: 0x827b50, cluster: [1, 3] },
    { type: 'ceiling-vent', density: 0.038, color: 0x777461, accent: 0x3b3a31, cluster: [1, 3] },
  ],
  incidents: {
    density: 0.022, minCount: 5, maxCount: 12, minCellDistance: 3,
    weights: {
      'collapsed-wanderer': 1.35, 'abandoned-pack': 1.25, 'chair-pile': 1,
      'black-motes': 1.8, 'shoe-trail': 1.7,
    },
    palette: { cloth: 0x47432c, clothLight: 0x7f7850, motes: 0x080806 },
  },
  atmosphere: {
    identity: 'recursive-threshold-origin-core',
    cadence: { first: [6, 11], interval: [11, 20] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'cycle-count', text: 'CYCLE 000000 / SUBJECT RECOGNIZED', density: 0.009, placement: 'wall' },
      { id: 'level-map', text: 'LEVELS 00–29 / ALL ROUTES INWARD', density: 0.008, placement: 'floor' },
      { id: 'origin-label', text: 'RELAY LOAD / THIRTY WORLDS', density: 0.007, placement: 'objective' },
      { id: 'exit-warning', text: 'ORIGIN IS NOT AN EXIT', density: 0.006, placement: 'exit' },
    ],
    milestones: [
      { id: 'levels-answer', progress: 0.2, message: 'TWENTY-NINE DISTANT ROOMS ANSWER THE RELAY', duration: 1.2, cue: 'relay-chatter' },
      { id: 'first-room', progress: 0.6, message: 'THE FIRST YELLOW CORRIDOR APPEARS AHEAD', duration: 1.2, cue: 'ballast-pop', effect: { glitch: 0.42 } },
      { id: 'archive-self', progress: 0.8, message: 'YOUR COMPLETE ARCHIVE PRINTS BEFORE YOU FINISH', duration: 1.25, cue: 'distant-knock', effect: { flicker: 0.5 } },
    ],
    events: [
      { id: 'level-echo', earliest: 4, weight: 1.3, maxRepeats: 4, tension: [0.01, 0.94], message: 'A SOUND FROM AN EARLIER LEVEL REPEATS BELOW', duration: 1.08, cue: 'distant-knock', pan: 'random' },
      { id: 'relay-chorus', earliest: 10, weight: 1.1, maxRepeats: 3, tension: [0.05, 0.92], message: 'THIRTY RELAYS CHATTER IN A SINGLE RHYTHM', duration: 1.12, cue: 'relay-chatter', effect: { flicker: 0.36 } },
      { id: 'corridor-rewrite', earliest: 17, weight: 0.86, maxRepeats: 2, tension: [0.11, 0.95], message: 'THE CORRIDOR REWRITES ITSELF BETWEEN BLINKS', duration: 1.2, cue: 'ballast-pop', effect: { glitch: 0.48 } },
      { id: 'core-heartbeat', earliest: 25, weight: 0.7, maxRepeats: 2, tension: [0.18, 0.96], message: 'THE CORE MATCHES YOUR HEARTBEAT', duration: 1.18, cue: 'sub-bass-bump', pan: 'random' },
      { id: 'cycle-dropout', earliest: 36, weight: 0.52, maxRepeats: 1, tension: [0.28, 0.98], message: 'EVERY LEVEL GOES SILENT AT ONCE', duration: 1.3, cue: 'water-dropout', effect: { flicker: 1, silence: 1.8 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffe99a, intensity: 62, distance: 22, angle: 0.34,
      drainPerSecond: 0.007, emergencyRechargePerSecond: 0.0017, flashCost: 0.36,
    },
  },
  evidence: {
    recharge: 0.24,
    entries: [
      'CORE LOG 00 / THE THRESHOLD WAS BUILT AROUND THE FIRST PERSON TO ESCAPE IT',
      'CORE LOG 15 / EACH LEVEL IS A MEMORY THE STRUCTURE REFUSES TO RELEASE',
      'CORE LOG 29 / ORIGIN RETURNS THE SURVIVOR BUT NOT THE SAME WORLD',
    ],
  },
  monster: {
    name: 'The Original', identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0.18, twitchStrength: 1.1 },
    sound: { breathPitch: 0.55, breathWeight: 0.78, stepWeight: 0.68, drag: 0.24 },
    skin: {
      type: 'faceless-shadow', body: 0x080906, accent: 0x393821,
      eye: 0xffdc63, emissiveIntensity: 0.5, scale: 1.16,
    },
    timing: {
      firstScare: [7, 12], scareInterval: [10, 19], firstChase: [30, 43],
      glimpseDuration: 0.9, stalkDuration: 17, pathRefresh: { stalk: 0.44, chase: 0.2 },
    },
    behavior: {
      sight: { range: 26, peripheralDot: 0.31, acquireRate: 1.7, threshold: 0.36 },
      hearing: { baseCells: 5, noiseCells: 16, chaseNoise: 0.48, reacquireNoise: 0.27 },
      chase: { lostSightDelay: 4.8, searchDuration: [8, 14], recovery: [12, 19] },
      wanderCells: [5, 11],
    },
    speeds: { watched: 0.38, stalk: 1.58, chase: 4.05 },
    stalkTriggerDistance: 13.2,
    catchDistance: 0.96,
  },
};
