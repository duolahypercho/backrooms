import { createServer as createViteServer } from 'vite';
import { createMultiplayerServer } from './multiplayer-server.js';
import { loadLevelsFromDisk } from '../src/levels/node-catalog.js';
import { loadCharactersFromDisk } from '../src/characters/node-catalog.js';
import { createGameContentFingerprint } from '../src/levels/fingerprint.js';

const isDiscoveredContent = (file = '') => {
  const path = String(file).replaceAll('\\', '/');
  if (path.includes('/_template/')) return false;
  return /\/src\/levels\/(?:[^/]+\/level\.js|[^/]+\.level\.js)$/.test(path)
    || /\/src\/characters\/(?:[^/]+\/character\.js|[^/]+\.character\.js)$/.test(path);
};

async function discoverContent(cacheBust = '') {
  const [levels, characters] = await Promise.all([
    loadLevelsFromDisk(undefined, { cacheBust }),
    loadCharactersFromDisk(undefined, { cacheBust }),
  ]);
  return { levels, characters };
}

function roomServerFor({ levels, characters }) {
  return createMultiplayerServer({
    maxLevel: levels.length - 1,
    levelIds: levels.map((level) => level.id),
    contentFingerprint: createGameContentFingerprint(levels, characters.definitions),
  });
}

let content = await discoverContent();
let multiplayer = roomServerFor(content);
let vite = null;
let closing = false;
let restarting = false;
let restartQueued = false;
let restartTimer = null;

async function restartMultiplayer() {
  if (closing) return;
  if (restarting) {
    restartQueued = true;
    return;
  }
  restarting = true;
  let replacement = null;
  try {
    const nextContent = await discoverContent(`${Date.now()}-${Math.random()}`);
    replacement = roomServerFor(nextContent);
    await multiplayer.close();
    multiplayer = replacement;
    content = nextContent;
    const address = await multiplayer.listen();
    const port = typeof address === 'object' && address ? address.port : multiplayer.config.port;
    console.log(`  Content reloaded: ${content.levels.length} level(s), ${content.characters.definitions.length} character(s)`);
    console.log(`  Co-op rooms restarted: ws://127.0.0.1:${port}${multiplayer.config.path}`);
  } catch (error) {
    if (replacement && replacement !== multiplayer) await replacement.close().catch(() => {});
    console.error('  Content reload rejected; fix the module and save again:', error.message);
  } finally {
    restarting = false;
    if (restartQueued) {
      restartQueued = false;
      await restartMultiplayer();
    }
  }
}

function scheduleMultiplayerRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => restartMultiplayer(), 80);
}

async function shutdown(exitCode = 0) {
  if (closing) return;
  closing = true;
  clearTimeout(restartTimer);
  await Promise.allSettled([
    vite?.close(),
    multiplayer.close(),
  ]);
  process.exit(exitCode);
}

try {
  const roomAddress = await multiplayer.listen();
  vite = await createViteServer({
    plugins: [{
      name: 'threshold-content-reload',
      async handleHotUpdate(context) {
        if (isDiscoveredContent(context.file)) await restartMultiplayer();
      },
      configureServer(server) {
        server.watcher.on('add', (file) => {
          if (isDiscoveredContent(file)) scheduleMultiplayerRestart();
        });
        server.watcher.on('unlink', (file) => {
          if (isDiscoveredContent(file)) scheduleMultiplayerRestart();
        });
      },
    }],
    server: {
      host: '0.0.0.0',
      strictPort: true,
    },
  });
  await vite.listen();
  vite.printUrls();
  const roomPort = typeof roomAddress === 'object' && roomAddress ? roomAddress.port : multiplayer.config.port;
  console.log(`  Co-op rooms: ws://127.0.0.1:${roomPort}${multiplayer.config.path}`);
  console.log(`  Auto-loaded levels: ${content.levels.length}`);
  console.log(`  Auto-loaded characters: ${content.characters.definitions.length}`);
} catch (error) {
  console.error('Unable to start THRESHOLD:', error);
  await shutdown(1);
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
