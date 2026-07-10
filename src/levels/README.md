# Adding a level

Levels are data plugins. Adding a valid file is enough to attach a level to the campaign; `src/main.js` and the registry do not need a new import.

## Fast path

The safest approach is to copy the existing level closest to the experience you want, then tune it:

```text
src/levels/level-3/level.js       # folder form
src/levels/level-3.level.js       # one-file form
```

Use exactly one form. The module must default-export one plain definition object. See [`_template/level.example.js`](_template/level.example.js) for a compact checklist; it is not loaded because its filename is deliberately different.

The same file is imported directly by Node for validation and multiplayer fingerprinting. Keep the entry self-contained and data-only; do not import local source helpers from it. It must also be Node-compatible: no `window`/`document`, CSS, Vite query imports (`?url`, `?raw`), top-level randomness, fetches, or side effects. Put static files in `public/` and store their public path as data if a runtime system supports that asset. Saving a discovered level during `npm run dev` reloads the catalog and restarts the in-memory test room service.

The registry sorts by `index`. A new campaign chapter therefore needs the next contiguous integer: `0, 1, 2, 3`, with no duplicates or gaps. `id` values must also be unique, stable, lowercase kebab-case strings. Moving a definition between the folder and one-file forms must not change its `id` or `index`.

## Definition contract

Every level requires these top-level sections:

| Section | Purpose |
| --- | --- |
| `id`, `index`, `name`, `exit` | Stable identity, campaign order, display name, and exit-sign label |
| `copy` | Start, pause, death, and win overlay text |
| `maze` | Desktop/mobile size, loops, room carving, and deterministic `seedSalt` |
| `surfaces`, `fog`, `lighting` | Materials, visibility, fixtures, and exposure |
| `audio` | Electrical bed, footsteps, impact, and ambient cue palette |
| `objective` | Supported objective type, count, color, and UI labels |
| `props` | Supported procedural prop types and spawn densities |
| `incidents` (optional) | Rare seeded scenes, count limits, spacing, type weights, and palette |
| `atmosphere` | Environmental story, weighted incidents, and progress milestones |
| `equipment.flashlight` | Light presentation, charge drain, recovery, and flash cost |
| `evidence` | Archive text and charge reward |
| `monster` | Supported identity, presentation, senses, timing, and movement |

Existing definitions are the executable schema. Copy all nested keys from a working sibling before changing values. The registry validates nested copy, maze, material, lighting, audio, objective, prop, atmosphere, equipment, evidence, incident, and monster contracts and reports the exact invalid path. A successful validation means the shape is supported; browser QA is still required to prove the content is playable and readable.

Configuration selects behavior already implemented by the engine. A new `props[].type`, objective type, surface pattern, monster identity, incident effect, or audio behavior also needs reusable runtime support and tests; inventing a string in the definition does not create that behavior.

The optional `incidents` profile controls rare static scenes planned by `src/incidents.js`. Built-in types are `collapsed-wanderer` (non-graphic), `abandoned-pack`, `chair-pile`, `black-motes`, and `shoe-trail`. Tune `density`, `minCount`, `maxCount`, `minCellDistance`, and per-type `weights`; only built-in types can be selected. Desktop renders at most 12 incidents and mobile at most 6, so `minCount` cannot exceed 6. Start, exit, objectives, archives, and blocking prop cells are protected from incident placement. Some physical scenes add collision, so their seeded placement is shared gameplay—not a client-only decoration.

### Copy and markup

Overlay `title` values may contain the existing `<br />` line break only; keep all other copy plain text. Event messages and archive entries should be short enough to read while moving. Do not include scripts, URLs, user data, or unsanitized HTML in level content.

### Deterministic variation

Backrooms layouts should feel unpredictable while remaining reproducible. Give each level a stable `maze.seedSalt`, then express variation through:

- maze size, loop ratio, room count, and room-size ranges;
- prop density and cluster ranges;
- fixture failure chance and flicker profile;
- atmosphere cadence, weights, repeat limits, tension windows, and milestones;
- monster timing, hearing, sight, search, and recovery ranges.

Do not precompute content at module scope and do not use `Math.random()` in a definition. Runtime systems derive separate seeded streams for topology, props, fixtures, objectives, evidence, atmosphere, and incidents. That separation keeps one tuning change from silently reshuffling every other system and ensures room members see the same shared world.

### Multiplayer boundaries

Level definitions are immutable shared input. The room seed and level index identify a world. The host simulates the monster; the server validates shared interactions and world transitions. A level contribution that adds shared state must update the protocol, authoritative validation, reconnect snapshot, host migration path, and tests. Pure visual noise may remain client-local only when it cannot affect gameplay.

## Validate and inspect

```bash
npm run validate:content
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:5173/?qa=1&level=3`, replacing `3` with the new index. Useful additions are `&monster=glimpse`, `&monster=chase`, `&shadow=1`, `&complete=1`, `&autowalk=1`, and `&touch=1`.

Before submitting, verify the normal entrance, readable objectives, reachable exit, three archives, hiding in a failed-light area, monster chase/recovery, chapter transition, mobile layout, and two-player layout agreement. Check several fresh campaign seeds rather than judging one favorable maze.

## Checklist

- The filename matches one discovery pattern, not both.
- `id` is unique and `index` is the next contiguous integer.
- Every required section is present and all ranges are ordered.
- Every referenced type is already supported or ships with runtime support.
- Randomness is seeded; shared outcomes are authoritative.
- Automated checks and browser QA pass.
