/** Returns ordinary numbers even when cells is a typed array larger than 256. */
export function enumerateCellIndexes(cells) {
  return Array.from(cells || [], (_, index) => index);
}

/**
 * Chooses required cells with preferred-first spacing and an exact-count
 * fallback. Randomness is injected so shared placement stays deterministic.
 */
export function chooseSpacedCells(
  preferred,
  fallback,
  count,
  random,
  spacing,
  distanceBetween,
) {
  if (count <= 0) return [];
  const preferredOrder = [...new Set(preferred)];
  const preferredSet = new Set(preferredOrder);
  const fallbackOrder = [...new Set(fallback)].filter((cell) => !preferredSet.has(cell));
  const shuffle = (items) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  };
  shuffle(preferredOrder);
  shuffle(fallbackOrder);
  const selected = [];
  for (const candidates of [preferredOrder, fallbackOrder]) {
    for (const candidate of candidates) {
      if (selected.every((cell) => distanceBetween(candidate, cell) > spacing)) {
        selected.push(candidate);
        if (selected.length === count) return selected;
      }
    }
  }
  for (const candidates of [preferredOrder, fallbackOrder]) {
    for (const candidate of candidates) {
      if (!selected.includes(candidate)) selected.push(candidate);
      if (selected.length === count) return selected;
    }
  }
  throw new Error(`Cannot place ${count} required shared content cells.`);
}
