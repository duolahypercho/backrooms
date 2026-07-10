export const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function stepBattery(state = {}, dt = 0, profile = {}) {
  const delta = Math.max(0, Number(dt) || 0);
  const drain = Math.max(0, Number(profile.drainPerSecond) || 0.0055);
  const recharge = Math.max(0, Number(profile.emergencyRechargePerSecond) || 0.002);
  const reserve = clamp01(profile.emergencyReserve ?? 0.12);
  let charge = clamp01(state.charge ?? 0.82);
  let on = Boolean(state.on);
  if (on && state.playing !== false) charge = Math.max(0, charge - drain * delta);
  else if (!on && charge < reserve) charge = Math.min(reserve, charge + recharge * delta);
  if (charge <= 0.0001) on = false;
  return { charge, on };
}

export function spendFlash(charge, cost = 0.28) {
  const current = clamp01(charge);
  const required = clamp01(cost);
  if (current + 0.0001 < required) return { charge: current, fired: false };
  return { charge: Math.max(0, current - required), fired: true };
}

export function stepNoiseImpulse(value, dt, decayPerSecond = 0.72) {
  return Math.max(0, (Number(value) || 0) - Math.max(0, Number(dt) || 0) * decayPerSecond);
}

export function stepHiding(state = {}, dt = 0, input = {}) {
  const delta = Math.max(0, Number(dt) || 0);
  const eligible = Boolean(
    input.shadowed
    && input.stationary
    && !input.flashlightOn
    && (Number(input.noise) || 0) < 0.16,
  );
  let settle = Math.max(0, Number(state.settle) || 0);
  if (eligible) settle = Math.min(1.25, settle + delta * (input.crouching ? 1.65 : 1));
  else settle = Math.max(0, settle - delta * 3.2);
  return { settle, hidden: eligible && settle >= 0.75 };
}

export function perceptionProfile(state = {}) {
  if (state.hidden) return { sightRange: 3.4, awarenessRate: 0.22, scoreBias: -38 };
  if (state.flashlight) return { sightRange: 27, awarenessRate: 1.55, scoreBias: 18 };
  if (state.crouching) return { sightRange: 13.5, awarenessRate: 0.68, scoreBias: -9 };
  return { sightRange: 20, awarenessRate: 1, scoreBias: 0 };
}

export function stepFear(value, dt, input = {}) {
  const delta = Math.max(0, Number(dt) || 0);
  const distance = Number(input.entityDistance);
  const proximity = Number.isFinite(distance) ? clamp01(1 - distance / 24) : 0;
  const baseModePressure = input.monsterMode === 'chase'
    ? 1
    : input.monsterMode === 'search'
      ? 0.62
      : input.monsterMode === 'stalk' || input.monsterMode === 'glimpse'
        ? 0.42
        : 0;
  const modePressure = baseModePressure * (input.pursuitFocused === false ? 0.24 : 1);
  const darkness = !input.flashlightOn && !input.reliableLight ? 0.22 : 0;
  const lowCharge = clamp01((0.18 - (Number(input.charge) || 0)) / 0.18) * 0.2;
  const isolation = input.nearTeammate ? 0 : 0.08;
  const hiddenRelief = input.hidden && modePressure < 0.8 ? -0.18 : 0;
  const target = clamp01(
    proximity * 0.58
      + modePressure * 0.55
      + clamp01(input.awareness) * 0.2
      + darkness
      + lowCharge
      + isolation
      + hiddenRelief,
  );
  const current = clamp01(value);
  const rate = target > current ? 0.72 : 0.19;
  return clamp01(current + (target - current) * (1 - Math.exp(-rate * delta)));
}
