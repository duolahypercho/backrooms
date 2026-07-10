// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'movie-theater',
  index: 15,
  name: 'Movie Theater',
  exit: { label: 'SCREEN 0' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 15',
    status: 'FINAL SHOWING IN PROGRESS',
    start: {
      kicker: 'MULTIPLEX / AUDITORIUM UNLISTED',
      title: 'THE FILM<br />IS WATCHING YOU.',
      body: 'Restore three projector breakers. Do not sit in the seat printed on your ticket.',
      button: 'ENTER LEVEL 15',
    },
    pause: {
      kicker: 'INTERMISSION OVERRUN',
      title: 'KEEP YOUR EYES<br />OFF THE SCREEN.',
      body: 'The projector continues clicking with its power disconnected.',
      button: 'RESUME SHOWING',
    },
    death: {
      kicker: 'END CREDITS COMPLETE',
      title: 'YOU WERE<br />THE FEATURE.',
      body: 'Your name appears under a role no one was hired to play.',
      button: 'REWIND',
    },
    win: {
      kicker: 'SCREEN ZERO UNLOCKED',
      title: 'THE CURTAIN<br />OPENS INWARD.',
      body: 'Behind the screen, a sterile stairwell descends beneath a red emergency lamp.',
      button: 'DESCEND TO LEVEL 16',
    },
  },
  maze: {
    desktop: { cols: 23, rows: 23 },
    mobile: { cols: 17, rows: 17 },
    loopRatio: 0.22,
    roomDivisor: 45,
    minimumRooms: 8,
    roomSize: { min: 3, max: 5 },
    seedSalt: 0x91c5e2a7,
  },
  surfaces: {
    wall: {
      base: [74, 35, 39], accent: [116, 55, 55], grime: [31, 18, 20],
      pattern: 'aged-fabric-panel', roughness: 0.94, metalness: 0, bumpScale: 0.064,
      grimeOpacity: 0.2,
    },
    floor: {
      base: [68, 30, 34], accent: [103, 46, 42], grime: [26, 17, 19],
      pattern: 'worn-cinema-carpet', roughness: 1, metalness: 0, bumpScale: 0.071,
    },
    ceiling: {
      base: [52, 45, 46], accent: [81, 67, 65], grime: [27, 24, 25],
      pattern: 'acoustic-tile', roughness: 0.95, metalness: 0, bumpScale: 0.04,
      emissive: 0x251316, emissiveIntensity: 0.24,
    },
    trim: { color: 0x7b3a35, roughness: 0.77, metalness: 0.09 },
  },
  fog: { color: 0x351d22, density: { desktop: 0.041, mobile: 0.048 } },
  lighting: {
    exposure: 0.9,
    hemisphere: {
      sky: 0xbc7770, ground: 0x170d11,
      intensity: { desktop: 0.45, mobile: 0.53 },
    },
    ambient: { color: 0x743d42, intensity: { desktop: 0.18, mobile: 0.25 } },
    fixture: {
      color: 0xffb56f, panelColor: 0xffc982, deadPanelColor: 0x492a2d,
      intensity: 82, distance: 10.8, angle: 1.12, penumbra: 0.93, decay: 2,
      brokenChance: 0.24, pool: { desktop: 6, mobile: 3 },
      flicker: { idleRate: 2.4, idleDepth: 0.035, faultFloor: 0.012, recovery: 0.47 },
    },
  },
  audio: {
    drips: false,
    masterGain: 0.72,
    humGain: 0.048,
    oscillators: [
      { frequency: 54, type: 'sine', gain: 0.21 },
      { frequency: 108, type: 'triangle', gain: 0.042 },
      { frequency: 27, type: 'sine', gain: 0.12 },
      { frequency: 216, type: 'square', gain: 0.009 },
    ],
    noise: { filter: 'bandpass', frequency: 510, q: 0.74, gain: 0.035 },
    heartbeat: { startFrequency: 63, endFrequency: 35 },
    impact: { startFrequency: 46, endFrequency: 17 },
    footstep: { walkLowpass: 255, runLowpass: 335 },
    ambience: {
      interval: [10, 23], cues: ['projector-knock', 'seat-creak', 'lobby-bell', 'film-flutter'],
      stereoWidth: 0.91, silenceChance: 0.27,
    },
  },
  objective: {
    type: 'fuse', count: 3, color: 0xf4a45d,
    labels: {
      hud: 'POWER THE FINAL PROJECTOR', item: 'PROJECTOR BREAKER', itemPlural: 'PROJECTOR BREAKERS',
      interact: 'E  RESET BREAKER', progress: 'BREAKERS {current}/{total}',
      locked: 'SCREEN ZERO REMAINS DARK', complete: 'PROJECTOR RUNNING / FIND SCREEN ZERO',
    },
  },
  props: [
    { type: 'theater-seat', density: 0.045, color: 0x6f292c, accent: 0x241315, cluster: [3, 8] },
    { type: 'square-column', density: 0.015, color: 0x5f3234, accent: 0x2b1a1c, cluster: [1, 2] },
    { type: 'cable-tray', density: 0.048, color: 0x3a3030, accent: 0x181414, cluster: [1, 4] },
    { type: 'ceiling-vent', density: 0.026, color: 0x504546, accent: 0x211c1d, cluster: [1, 3] },
    { type: 'service-crate', density: 0.012, color: 0x6f4936, accent: 0x302016, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.016, minCount: 2, maxCount: 8, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 0.6, 'abandoned-pack': 1.1, 'chair-pile': 2.2,
      'black-motes': 1.4, 'shoe-trail': 0.8,
    },
    palette: { cloth: 0x3b2024, clothLight: 0x81454a, motes: 0x080506 },
  },
  atmosphere: {
    identity: 'endless-after-hours-multiplex',
    cadence: { first: [11, 19], interval: [15, 27] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'showtime', text: 'NEXT SHOWING: NOW / RUN TIME: FOREVER', density: 0.008, placement: 'wall' },
      { id: 'seat-ticket', text: 'ROW −1 / SEAT YOU', density: 0.006, placement: 'floor' },
      { id: 'projection-note', text: 'DO NOT THREAD THE FRAME THAT MOVES', density: 0.005, placement: 'objective' },
    ],
    milestones: [
      {
        id: 'audience-shift', progress: 0.33, message: 'EVERY EMPTY SEAT FOLDS DOWN AT ONCE',
        duration: 1.18, cue: 'seat-creak', effect: { flicker: 0.42 },
      },
      {
        id: 'screen-face', progress: 0.66, message: 'YOUR FACE APPEARS ONE FRAME AHEAD',
        duration: 1.24, cue: 'film-flutter', effect: { glitch: 0.52 },
      },
    ],
    events: [
      {
        id: 'projector-start', earliest: 8, weight: 1.2, maxRepeats: 3,
        tension: [0.04, 0.84], message: 'A PROJECTOR STARTS IN THE NEXT ROOM',
        duration: 1.08, cue: 'projector-knock', pan: 'random',
      },
      {
        id: 'seat-rise', earliest: 17, weight: 0.92, maxRepeats: 2,
        tension: [0.12, 0.86], message: 'ONE SEAT SLOWLY FOLDS UPRIGHT',
        duration: 1.14, cue: 'seat-creak', effect: { silence: 0.55 },
      },
      {
        id: 'lobby-call', earliest: 27, weight: 0.68, maxRepeats: 2,
        tension: [0.18, 0.8], message: 'THE LOBBY BELL RINGS FOR YOU',
        duration: 1.16, cue: 'lobby-bell', pan: 'random',
      },
      {
        id: 'missing-frame', earliest: 39, weight: 0.5, maxRepeats: 1,
        tension: [0.28, 0.92], message: 'ONE SECOND IS MISSING FROM THE ROOM',
        duration: 1.3, cue: 'film-flutter', effect: { glitch: 0.72, silence: 1.3, flicker: 0.65 },
      },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xffd2a1, intensity: 59, distance: 19.2, angle: 0.36,
      drainPerSecond: 0.0065, emergencyRechargePerSecond: 0.0018, flashCost: 0.32,
    },
  },
  evidence: {
    recharge: 0.28,
    entries: [
      'REEL 02 / THE AUDIENCE ARRIVES AFTER THE CREDITS',
      'REEL 09 / EACH FRAME SHOWS THE CAMERA CLOSER',
      'REEL 16 / SCREEN ZERO PROJECTS THE ROOM BEHIND YOU',
    ],
  },
  monster: {
    name: 'The Usher',
    identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0.16, twitchStrength: 1.18 },
    sound: { breathPitch: 0.68, breathWeight: 0.62, stepWeight: 0.76, drag: 0.18 },
    skin: {
      type: 'faceless-shadow', body: 0x070405, accent: 0x281113,
      eye: 0xe8894d, emissiveIntensity: 0.22, scale: 1.08,
    },
    timing: {
      firstScare: [12, 20], scareInterval: [14, 26], firstChase: [43, 62],
      glimpseDuration: 1.28, stalkDuration: 22,
      pathRefresh: { stalk: 0.72, chase: 0.31 },
    },
    behavior: {
      sight: { range: 22.5, peripheralDot: 0.26, acquireRate: 1.21, threshold: 0.48 },
      hearing: { baseCells: 2, noiseCells: 9, chaseNoise: 0.75, reacquireNoise: 0.43 },
      chase: { lostSightDelay: 5.4, searchDuration: [8, 13], recovery: [18, 27] },
      wanderCells: [3, 7],
    },
    speeds: { watched: 0.22, stalk: 1.14, chase: 3.42 },
    stalkTriggerDistance: 10.7,
    catchDistance: 0.91,
  },
};
