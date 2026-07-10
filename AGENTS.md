# THRESHOLD contribution guide

This file is the working agreement for humans and coding agents contributing to the repository. Keep changes small, deterministic, multiplayer-safe, and easy for the next contributor to understand.

## Start here

```bash
npm install
npm run dev
```

The game runs at `http://127.0.0.1:5173/`; the same command starts the local room server on port `8787`. Read [the level guide](src/levels/README.md) before adding a level and [the character guide](src/characters/README.md) before adding a multiplayer avatar.

## Source map

- `src/main.js` owns the first-person game loop and connects the content systems.
- `src/levels/` contains auto-discovered level definitions. A new valid definition joins the campaign without a registry edit.
- `src/characters/` contains auto-discovered remote-player character factories.
- `src/monster.js`, `src/atmosphere.js`, `src/incidents.js`, and `src/survival.js` implement reusable horror systems.
- `src/multiplayer.js` and `server/` implement room transport and authoritative shared state.
- `src/voice-chat.js` implements opt-in peer-to-peer spatial voice.

Do not put another large configuration array back into `src/main.js`. Reusable behavior belongs in a focused module; content belongs in its level or character definition.

## Content plugins

The build discovers these naming patterns eagerly:

- `src/levels/<slug>/level.js` or `src/levels/<slug>.level.js`
- `src/characters/<slug>/character.js` or `src/characters/<slug>.character.js`

Choose either the folder form or one-file form, not both. Folder names and IDs use stable lowercase kebab-case. Never add a manual import or registry entry for new content. The `_template` files are documentation and are intentionally named so they cannot load.

The browser build and Node room server import the same modules. Auto-discovered entry files must be self-contained; do not import local source helpers from them because the development catalog reloader watches and cache-busts the entry itself. Keep level modules plain data-only ESM. Keep character module top level Node-safe: no top-level `window`, `document`, CSS imports, Vite query imports such as `?url`/`?raw`, permission requests, or browser-only side effects. Put static assets in `public/` and reference stable paths, or create browser objects lazily inside the character factory. During `npm run dev`, saving an auto-discovered content module reloads the catalog and restarts the in-memory room service, so active test rooms are intentionally cleared.

Registries fail fast on invalid exports, duplicate IDs, duplicate level indexes, and gaps in the campaign sequence. Treat that error as useful feedback; do not weaken validation to make incomplete content load.

## Determinism and multiplayer authority

A multiplayer room must produce the same topology and content placement for every player.

- Represent variation as configuration: ranges, weights, densities, and event tables.
- Use the seeded random source supplied by a runtime system. Do not call `Math.random()` while constructing a level, placing shared objects, choosing shared incidents, or advancing shared AI.
- A level's `maze.seedSalt` must be a stable unsigned integer and unique enough to separate it from other levels.
- Cosmetic effects may stay local only when they cannot affect collision, objectives, damage, hiding, detection, or navigation.
- The active host owns monster simulation. The server owns room membership, epochs, world transitions, and validation of shared interactions. Clients send intents; they do not declare that an objective completed, a player died, or the world changed.
- New shared state requires protocol validation, stale-epoch handling, reconnect snapshots, host migration behavior, and tests. Never trust client-provided position, identity, timing, or completion data without bounds and authority checks.

## Safe workflow

1. Inspect `git status` and preserve unrelated work already in progress.
2. Read the nearest guide and copy the closest working example.
3. Make one coherent change. Avoid broad formatting or generated-file churn.
4. Do not commit secrets, `.env`, `node_modules/`, `dist/`, recordings, or local certificates.
5. Run the automated checks and then inspect the affected content in the browser.
6. Leave the worktree understandable. Do not commit or push unless the repository owner asked you to.

Required checks:

```bash
npm run validate:content
npm test
npm run build
```

Useful visual QA URLs while `npm run dev` is running:

- `http://127.0.0.1:5173/?qa=1&level=0` — load a level directly
- `http://127.0.0.1:5173/?qa=1&level=0&monster=glimpse` — inspect a monster reveal
- `http://127.0.0.1:5173/?qa=1&level=0&monster=chase` — inspect chase presentation
- `http://127.0.0.1:5173/?qa=1&level=0&shadow=1` — force a broken-light hiding area
- `http://127.0.0.1:5173/?qa=1&level=0&complete=1` — unlock the exit for transition QA
- `http://127.0.0.1:5173/?qa=1&level=0&touch=1` — inspect touch controls

Replace the numeric level index as needed. Also test the normal start overlay, pause/resume, death/restart, reduced motion, and a narrow viewport. For multiplayer changes, open two normal tabs, host in one, join in the other, and verify reconnect plus host departure. QA mode is deliberately solo-only.

## Definition of done

A contribution is done when validation passes, tests and production build pass, every affected level can be entered and exited, no console error appears, shared behavior agrees in two clients, and the relevant guide remains accurate.
