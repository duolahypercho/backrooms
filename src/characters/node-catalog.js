import { readdir } from 'node:fs/promises';
import { createCharacterCatalog } from './catalog.js';

/** Node-side equivalent of the Vite glob used by src/characters/index.js. */
export async function loadCharactersFromDisk(
  root = new URL('./', import.meta.url),
  { cacheBust = '' } = {},
) {
  const load = (source) => import(new URL(`${source}${cacheBust ? `?v=${cacheBust}` : ''}`, root));
  const entries = await readdir(root, { withFileTypes: true });
  const modules = {};
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith('.character.js'))) {
    const source = `./${entry.name}`;
    modules[source] = await load(source);
  }
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const directory of directories) {
    const source = `./${directory.name}/character.js`;
    const files = await readdir(new URL(`./${directory.name}/`, root));
    if (files.includes('character.js')) modules[source] = await load(source);
  }
  return createCharacterCatalog(modules);
}
