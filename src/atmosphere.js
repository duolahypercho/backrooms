const DEFAULT_FIRST_WINDOW = [12, 20];
const DEFAULT_INTERVAL_WINDOW = [16, 28];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function range(value, fallback) {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  const minimum = Math.max(0, finite(value[0], fallback[0]));
  const maximum = Math.max(minimum, finite(value[1], fallback[1]));
  return [minimum, maximum];
}

function createRandom(seed) {
  let state = (finite(seed, 0x51f15e) >>> 0) || 0x51f15e;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return state;
    },
    set state(value) {
      state = (finite(value, 0x51f15e) >>> 0) || 0x51f15e;
    },
  };
}

function weightedChoice(items, random) {
  const total = items.reduce((sum, item) => sum + Math.max(0, finite(item.weight, 1)), 0);
  if (total <= 0) return null;
  let cursor = random() * total;
  for (const item of items) {
    cursor -= Math.max(0, finite(item.weight, 1));
    if (cursor <= 0) return item;
  }
  return items.at(-1) || null;
}

function toOutput(event, source, random) {
  const requestedPan = event.pan;
  const pan = requestedPan === 'random'
    ? random() * 2 - 1
    : clamp(finite(requestedPan, 0), -1, 1);
  return {
    id: String(event.id),
    source,
    message: typeof event.message === 'string' ? event.message : '',
    duration: clamp(finite(event.duration, 1.1), 0.25, 5),
    cue: typeof event.cue === 'string' ? event.cue : '',
    intensity: clamp(finite(event.intensity, 0.7), 0, 1),
    pan,
    effect: event.effect && typeof event.effect === 'object' ? { ...event.effect } : {},
  };
}

/**
 * Creates a deterministic, local-only atmosphere scheduler. It never changes
 * gameplay state, so co-op clients can run it independently without adding
 * protocol traffic or affecting monster authority.
 */
export function createAtmosphereDirector(profile = {}, options = {}) {
  const random = createRandom(options.seed);
  const firstWindow = range(profile.cadence?.first, DEFAULT_FIRST_WINDOW);
  const intervalWindow = range(profile.cadence?.interval, DEFAULT_INTERVAL_WINDOW);
  const events = Array.isArray(profile.events) ? profile.events.filter(Boolean) : [];
  const milestones = Array.isArray(profile.milestones)
    ? [...profile.milestones].filter(Boolean).sort((a, b) => finite(a.progress) - finite(b.progress))
    : [];
  const counts = new Map();
  const lastFired = new Map();
  const firedMilestones = new Set();
  const origin = Math.max(0, finite(options.elapsed, 0));
  const maxEvents = Math.max(0, Math.trunc(finite(profile.maxEvents, 10)));
  let eventCount = 0;
  let nextEvent = origin;

  const schedule = (elapsed, window, multiplier = 1) => {
    const [minimum, maximum] = window;
    nextEvent = elapsed + (minimum + random.next() * (maximum - minimum)) * multiplier;
  };
  schedule(origin, firstWindow);

  function update(input = {}) {
    const elapsed = Math.max(0, finite(input.elapsed, 0));
    const tension = clamp(finite(input.tension, 0), 0, 1);
    const completed = Math.max(0, finite(input.objectivesCompleted, 0));
    const total = Math.max(0, finite(input.objectiveTotal, 0));
    const objectiveProgress = total > 0 ? clamp(completed / total, 0, 1) : 0;
    const output = [];

    if (objectiveProgress > 0) {
      for (const milestone of milestones) {
        const id = String(milestone.id || `milestone-${milestone.progress}`);
        if (firedMilestones.has(id)) continue;
        if (objectiveProgress + 0.0001 < clamp(finite(milestone.progress, 1), 0, 1)) continue;
        firedMilestones.add(id);
        output.push(toOutput({ ...milestone, id }, 'milestone', () => random.next()));
      }
    }

    if (!events.length || eventCount >= maxEvents || elapsed < nextEvent) return output;
    const monsterMode = String(input.monsterMode || 'hidden');
    if (profile.pauseDuringChase !== false && monsterMode === 'chase') {
      nextEvent = elapsed + 2;
      return output;
    }

    const available = events.filter((event) => {
      const id = String(event.id || '');
      if (!id || elapsed < Math.max(0, finite(event.earliest, 0))) return false;
      if (Number.isFinite(Number(event.latest)) && elapsed > Number(event.latest)) return false;
      if ((counts.get(id) || 0) >= Math.max(1, Math.trunc(finite(event.maxRepeats, 1)))) return false;
      const tensionWindow = range(event.tension, [0, 1]);
      if (tension < tensionWindow[0] || tension > tensionWindow[1]) return false;
      const progressWindow = range(event.objectiveProgress, [0, 1]);
      if (objectiveProgress < progressWindow[0] || objectiveProgress > progressWindow[1]) return false;
      if (event.requiresMoving === true && !input.moving) return false;
      if (event.requiresStill === true && input.moving) return false;
      const cooldown = Math.max(0, finite(event.cooldown, intervalWindow[0]));
      return elapsed - (lastFired.get(id) ?? -Infinity) >= cooldown;
    });

    const selected = weightedChoice(available, () => random.next());
    if (!selected) {
      nextEvent = elapsed + 3.5;
      return output;
    }

    const id = String(selected.id);
    counts.set(id, (counts.get(id) || 0) + 1);
    lastFired.set(id, elapsed);
    eventCount += 1;
    output.push(toOutput(selected, 'ambient', () => random.next()));
    schedule(elapsed, intervalWindow, 1 - tension * 0.16);
    return output;
  }

  return {
    update,
    reset(elapsed = 0) {
      counts.clear();
      lastFired.clear();
      firedMilestones.clear();
      eventCount = 0;
      schedule(Math.max(0, finite(elapsed, 0)), firstWindow);
    },
    snapshot() {
      return {
        nextEvent,
        eventCount,
        randomState: random.state,
        counts: Object.fromEntries(counts),
        lastFired: Object.fromEntries(lastFired),
        firedMilestones: [...firedMilestones],
      };
    },
  };
}

export function validateAtmosphereProfile(profile = {}) {
  const errors = [];
  const seen = new Set();
  const entries = [
    ...(Array.isArray(profile.events) ? profile.events : []),
    ...(Array.isArray(profile.milestones) ? profile.milestones : []),
  ];
  for (const entry of entries) {
    const id = String(entry?.id || '');
    if (!id) errors.push('Atmosphere entry is missing an id.');
    else if (seen.has(id)) errors.push(`Duplicate atmosphere id: ${id}`);
    else seen.add(id);
  }
  for (const milestone of Array.isArray(profile.milestones) ? profile.milestones : []) {
    const progress = Number(milestone.progress);
    if (!Number.isFinite(progress) || progress <= 0 || progress > 1) {
      errors.push(`Milestone ${milestone.id || '(unknown)'} must use progress in (0, 1].`);
    }
  }
  return errors;
}
