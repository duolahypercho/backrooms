export const ROOM_CAPACITY = 4;

const ROOM_SPAWN_OFFSETS = Object.freeze([
  Object.freeze({ x: -0.72, z: 0.62 }),
  Object.freeze({ x: 0.72, z: 0.62 }),
  Object.freeze({ x: -0.72, z: -0.62 }),
  Object.freeze({ x: 0.72, z: -0.62 }),
]);

export const SURVIVOR_LOOKS = Object.freeze([
  Object.freeze({ id: 'mustard', name: 'MUSTARD', color: 0x81794b, css: '#81794b' }),
  Object.freeze({ id: 'moss', name: 'MOSS', color: 0x596b59, css: '#596b59' }),
  Object.freeze({ id: 'rust', name: 'RUST', color: 0x795746, css: '#795746' }),
  Object.freeze({ id: 'flood', name: 'FLOOD', color: 0x4f686a, css: '#4f686a' }),
]);

const LOOK_BY_ID = new Map(SURVIVOR_LOOKS.map((look) => [look.id, look]));

export function survivorLook(value) {
  return LOOK_BY_ID.get(String(value || '').toLowerCase()) || SURVIVOR_LOOKS[0];
}

export function roomSpawnOffset(slotIndex = 0) {
  const normalizedIndex = Math.max(
    0,
    Math.min(ROOM_SPAWN_OFFSETS.length - 1, Math.trunc(Number(slotIndex) || 0)),
  );
  return ROOM_SPAWN_OFFSETS[normalizedIndex];
}

export function waitingRoomModel({
  players = [],
  selfId = '',
  hostId = '',
  localReady = false,
  localLook = SURVIVOR_LOOKS[0].id,
  localCharacterId,
  started = false,
  capacity = ROOM_CAPACITY,
} = {}) {
  const boundedCapacity = Math.max(1, Math.trunc(Number(capacity) || ROOM_CAPACITY));
  const connected = players
    .filter((player) => player && player.connected !== false)
    .slice(0, boundedCapacity)
    .map((player) => {
      const local = String(player.id) === String(selfId);
      const look = survivorLook(local ? localLook : player.state?.look);
      return {
        id: String(player.id || ''),
        name: String(player.name || player.state?.name || 'WANDERER').trim().slice(0, 18) || 'WANDERER',
        host: String(player.id) === String(hostId),
        local,
        ready: local ? Boolean(localReady) : player.state?.ready === true,
        look,
        characterId: local
          ? (typeof localCharacterId === 'string' && localCharacterId ? localCharacterId : undefined)
          : (typeof player.state?.characterId === 'string' && player.state.characterId
            ? player.state.characterId
            : undefined),
      };
    });

  const readyCount = connected.filter((player) => player.ready).length;
  const allReady = connected.length > 0 && readyCount === connected.length;
  const isHost = String(selfId) !== '' && String(selfId) === String(hostId);
  let action = 'ready';
  let actionLabel = 'READY UP';
  if (started) {
    action = 'enter';
    actionLabel = 'ENTER LEVEL';
  } else if (localReady && isHost && allReady) {
    action = 'start';
    actionLabel = 'START RUN';
  } else if (localReady) {
    action = 'cancel';
    actionLabel = 'CANCEL READY';
  }

  return {
    players: connected,
    emptySlots: Math.max(0, boundedCapacity - connected.length),
    capacity: boundedCapacity,
    readyCount,
    allReady,
    isHost,
    started: Boolean(started),
    action,
    actionLabel,
  };
}
