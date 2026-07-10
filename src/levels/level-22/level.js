// Auto-discovered campaign chapter; keep this module data-only and deterministic.
export default {
  id: 'airport-concourse',
  index: 22,
  name: 'Airport Concourse',
  exit: { label: 'GATE' },
  copy: {
    classification: 'THRESHOLD ARCHIVE / LEVEL 22',
    status: 'TERMINAL OUT OF SERVICE',
    start: {
      kicker: 'INTERNATIONAL CONCOURSE / NO DEPARTURES',
      title: 'EVERY GATE<br />LEADS BACK HERE.',
      body: 'Restore four gate breakers. The departure board lists only passengers already missing.',
      button: 'ENTER LEVEL 22',
    },
    pause: {
      kicker: 'BOARDING SUSPENDED',
      title: 'THE PA SYSTEM<br />KNOWS YOUR NAME.',
      body: 'Rows of empty seats face the corridor you just crossed.',
      button: 'RESUME BOARDING',
    },
    death: {
      kicker: 'PASSENGER UNACCOUNTED FOR',
      title: 'FINAL CALL<br />COMPLETED.',
      body: 'Your boarding pass printed after the terminal went dark.',
      button: 'REBOOK',
    },
    win: {
      kicker: 'SERVICE GATE RELEASED',
      title: 'THE JETWAY<br />DESCENDS.',
      body: 'A concrete freight lift waits beyond the gate with no aircraft attached.',
      button: 'DESCEND TO LEVEL 23',
    },
  },
  maze: {
    desktop: { cols: 27, rows: 19 },
    mobile: { cols: 19, rows: 15 },
    loopRatio: 0.34,
    roomDivisor: 42,
    minimumRooms: 10,
    roomSize: { min: 2, max: 5 },
    seedSalt: 0xa116c022,
  },
  surfaces: {
    wall: {
      base: [156, 164, 166], accent: [104, 116, 120], grime: [48, 54, 56],
      pattern: 'painted-concrete', roughness: 0.66, metalness: 0.04, bumpScale: 0.028,
      grimeOpacity: 0.14,
    },
    floor: {
      base: [104, 110, 108], accent: [62, 68, 68], grime: [34, 38, 38],
      pattern: 'tile', roughness: 0.44, metalness: 0.03, bumpScale: 0.018,
    },
    ceiling: {
      base: [178, 181, 174], accent: [132, 138, 134], grime: [76, 80, 78],
      pattern: 'acoustic-tile', roughness: 0.87, metalness: 0.01, bumpScale: 0.03,
      emissive: 0x2e322e, emissiveIntensity: 0.2,
    },
    trim: { color: 0x667074, roughness: 0.56, metalness: 0.32 },
  },
  fog: { color: 0x626b6c, density: { desktop: 0.024, mobile: 0.03 } },
  lighting: {
    exposure: 0.88,
    hemisphere: { sky: 0xdce4dc, ground: 0x202626, intensity: { desktop: 0.58, mobile: 0.66 } },
    ambient: { color: 0x899794, intensity: { desktop: 0.23, mobile: 0.3 } },
    fixture: {
      color: 0xe8fff4, panelColor: 0xf0fff8, deadPanelColor: 0x3b4240,
      intensity: 88, distance: 12.5, angle: 1.18, penumbra: 0.88, decay: 2,
      brokenChance: 0.2, pool: { desktop: 7, mobile: 4 },
      flicker: { idleRate: 3.6, idleDepth: 0.035, faultFloor: 0.02, recovery: 0.3 },
    },
  },
  audio: {
    drips: false, masterGain: 0.72, humGain: 0.055,
    oscillators: [
      { frequency: 50, type: 'sine', gain: 0.22 },
      { frequency: 100, type: 'triangle', gain: 0.035 },
      { frequency: 25, type: 'sine', gain: 0.1 },
    ],
    noise: { filter: 'bandpass', frequency: 780, q: 0.7, gain: 0.025 },
    heartbeat: { startFrequency: 64, endFrequency: 34 },
    impact: { startFrequency: 48, endFrequency: 17 },
    footstep: { walkLowpass: 330, runLowpass: 430 },
    ambience: {
      interval: [11, 23],
      cues: ['distant-ring', 'ballast-pop', 'distant-knock', 'fluorescent-dropout'],
      stereoWidth: 0.94,
      silenceChance: 0.2,
    },
  },
  objective: {
    type: 'fuse', count: 4, color: 0x74c9b5,
    labels: {
      hud: 'GATE POWER ISOLATED', item: 'BREAKER', itemPlural: 'BREAKERS',
      interact: 'E  RESET BREAKER', progress: 'GATE BREAKERS {current}/{total}',
      locked: 'THE SERVICE GATE HAS NO POWER', complete: 'JETWAY POWERED / FIND THE GATE',
    },
  },
  props: [
    { type: 'square-column', density: 0.03, color: 0x9ca4a4, accent: 0x646e70, cluster: [1, 3] },
    { type: 'airport-bench', density: 0.022, color: 0x31474a, accent: 0x7d8c8c, cluster: [2, 5] },
    { type: 'ceiling-vent', density: 0.05, color: 0x8a9494, accent: 0x465052, cluster: [1, 3] },
    { type: 'cable-tray', density: 0.045, color: 0x626c6e, accent: 0x303638, cluster: [2, 5] },
    { type: 'service-crate', density: 0.014, color: 0x55666a, accent: 0xa0a96d, cluster: [1, 2] },
  ],
  incidents: {
    density: 0.014, minCount: 3, maxCount: 9, minCellDistance: 4,
    weights: {
      'collapsed-wanderer': 0.65, 'abandoned-pack': 1.8, 'chair-pile': 1.7,
      'black-motes': 0.75, 'shoe-trail': 1.25,
    },
    palette: { cloth: 0x3a4548, clothLight: 0x748184, motes: 0x101516 },
  },
  atmosphere: {
    identity: 'endless-silent-airport-concourse',
    cadence: { first: [9, 15], interval: [14, 25] },
    pauseDuringChase: true,
    environmentalStory: [
      { id: 'departure-board', text: 'DELAYED / DELAYED / CANCELLED / ARRIVED', density: 0.008, placement: 'wall' },
      { id: 'gate-tape', text: 'GATE CLOSED 04:17 / DO NOT BOARD', density: 0.006, placement: 'exit' },
      { id: 'boarding-slip', text: 'SEAT 00 / TERMINAL BELOW', density: 0.007, placement: 'floor' },
    ],
    milestones: [
      { id: 'terminal-call', progress: 0.25, message: 'FINAL CALL FOR A PASSENGER WITH YOUR NAME', duration: 1.2, cue: 'distant-ring' },
      { id: 'gate-change', progress: 0.75, message: 'EVERY GATE NUMBER CHANGES TO 00', duration: 1.2, cue: 'ballast-pop', effect: { glitch: 0.4 } },
    ],
    events: [
      { id: 'arrival-chime', earliest: 7, weight: 1.2, maxRepeats: 3, tension: [0.02, 0.88], message: 'AN ARRIVAL CHIME SOUNDS BEHIND YOU', duration: 1.05, cue: 'distant-ring', pan: 'random' },
      { id: 'luggage-wheel', earliest: 14, weight: 1, maxRepeats: 2, tension: [0.08, 0.86], message: 'A LUGGAGE WHEEL CROSSES THE TILE', duration: 1.1, cue: 'distant-knock', pan: 'random' },
      { id: 'board-flip', earliest: 22, weight: 0.8, maxRepeats: 2, tension: [0.12, 0.9], message: 'THE DEPARTURE BOARD FLIPS IN THE DARK', duration: 1.15, cue: 'ballast-pop', effect: { flicker: 0.5 } },
      { id: 'terminal-blackout', earliest: 34, weight: 0.5, maxRepeats: 1, tension: [0.25, 0.92], message: 'THE ENTIRE TERMINAL HOLDS ITS BREATH', duration: 1.25, cue: 'fluorescent-dropout', effect: { flicker: 1, silence: 1.4 } },
    ],
  },
  equipment: {
    flashlight: {
      color: 0xe6fff4, intensity: 55, distance: 20, angle: 0.4,
      drainPerSecond: 0.0057, emergencyRechargePerSecond: 0.0019, flashCost: 0.29,
    },
  },
  evidence: {
    recharge: 0.28,
    entries: [
      'TERMINAL LOG 04 / NO AIRCRAFT HAVE LANDED SINCE THE LIGHTS FAILED',
      'TERMINAL LOG 12 / THE ANNOUNCEMENT USES VOICES FROM LOST CALLS',
      'TERMINAL LOG 19 / GATE 00 OPENS ONLY AFTER THE LAST PASSENGER BOARDS',
    ],
  },
  monster: {
    name: 'The Last Passenger', identity: 'still',
    presentation: { silhouette: 'wire-rib-sentinel', eyePulse: 0.08, twitchStrength: 0.9 },
    sound: { breathPitch: 0.72, breathWeight: 0.58, stepWeight: 0.46, drag: 0.1 },
    skin: {
      type: 'faceless-shadow', body: 0x101414, accent: 0x293032,
      eye: null, emissiveIntensity: 0, scale: 1.04,
    },
    timing: {
      firstScare: [11, 18], scareInterval: [14, 26], firstChase: [40, 56],
      glimpseDuration: 1.15, stalkDuration: 20, pathRefresh: { stalk: 0.72, chase: 0.3 },
    },
    behavior: {
      sight: { range: 23, peripheralDot: 0.25, acquireRate: 1.2, threshold: 0.47 },
      hearing: { baseCells: 3, noiseCells: 10, chaseNoise: 0.74, reacquireNoise: 0.4 },
      chase: { lostSightDelay: 5.6, searchDuration: [8, 13], recovery: [15, 23] },
      wanderCells: [4, 9],
    },
    speeds: { watched: 0.3, stalk: 1.28, chase: 3.55 },
    stalkTriggerDistance: 12.5,
    catchDistance: 0.92,
  },
};
