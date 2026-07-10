import { readdir } from 'node:fs/promises';
import { createLevelCatalog } from './catalog.js';

export async function loadLevelsFromDisk(
  root = new URL('./', import.meta.url),
  { cacheBust = '' } = {},
) {
  const load = (source) => import(new URL(`${source}${cacheBust ? `?v=${cacheBust}` : ''}`, root));
  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .sort((left, right) => left.name.localeCompare(right.name));
  const modules = {};
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith('.level.js'))) {
    const source = `./${entry.name}`;
    modules[source] = await load(source);
  }
  for (const directory of directories) {
    const source = `./${directory.name}/level.js`;
    const files = await readdir(new URL(`./${directory.name}/`, root));
    if (files.includes('level.js')) modules[source] = await load(source);
  }
  return createLevelCatalog(modules);
}
