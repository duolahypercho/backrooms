# Adding a multiplayer character

Characters are visual plugins for remote players. Adding one valid module makes it available to the deterministic character catalog; the remote-player manager and `src/main.js` do not need a new import.

## Fast path

Create either of these, using exactly one form:

```text
src/characters/hazmat-runner/character.js       # folder form
src/characters/hazmat-runner.character.js       # one-file form
```

The module must default-export a definition. Start from [`_template/character.example.js`](_template/character.example.js), which is intentionally excluded from discovery, or copy the built-in `threshold-surveyor` character when you need its full articulated rig and name-tag implementation.

Node imports the same module to validate and fingerprint the multiplayer catalog. Keep the entry self-contained (no local source-helper imports) and keep module top level Node-safe: no top-level browser globals, CSS, Vite query imports (`?url`, `?raw`), permission requests, fetches, or side effects. Browser-only work belongs lazily inside `createFactory`/`create` and should be guarded when a Node lifecycle test has no DOM. Put static files in `public/` and use stable public paths when runtime asset loading is needed. Saving a discovered character during `npm run dev` reloads the catalog and restarts in-memory test rooms.

## Definition contract

```js
export default {
  id: 'hazmat-runner',
  name: 'Hazmat Runner',
  version: '1.0.0',
  order: 200, // Optional finite catalog sort value.
  createFactory({ THREE, options, helpers }) {
    return {
      create(snapshot) {
        return avatar;
      },
      dispose() {},
    };
  },
};
```

- `id` is a unique, stable, lowercase kebab-case string.
- `name` is a non-empty display name.
- `version` is a non-empty release string. Bump it whenever geometry, animation, resource ownership, or runtime behavior changes; multiplayer uses it to reject mixed character builds before room entry.
- `order` is optional. The catalog sorts by finite `order`, then `id`, so selection is identical on peers running the same catalog.
- `createFactory` is synchronous and is called lazily once for this definition by each remote-player manager.

Use the supplied `THREE` namespace. Do not import a second copy of Three.js. `options` contains the manager's scale, shadow, color, name-tag, and flashlight presentation settings. Treat it as read-only. `helpers` may expose small engine utilities such as `clamp`; a character should not reach into `src/main.js`.

The factory owns resources shared by all avatars of that character—usually geometries and immutable materials. `create(snapshot)` returns a new avatar; `dispose()` releases shared GPU resources after every avatar has been disposed. Both factory and avatar cleanup should be safe to call once and should not leak scene nodes, textures, materials, geometries, lights, listeners, or timers.

## Avatar contract

`create(snapshot)` must synchronously return:

```js
{
  root,                         // THREE.Object3D located at the player's feet
  rig,                          // character-owned joints and render handles
  setColor(color) {},
  setName(name) {},
  setFlashlightEnabled(on) {},
  animate(entry, deltaSeconds) {},
  dispose() {},
}
```

The manager owns `root.position`, `root.rotation.y`, `root.visible`, scene attachment, and network interpolation. Build the model upward from floor origin and face local `+Z` when yaw is zero. Animation may move children inside `root`, but must not overwrite those manager-owned transforms.

`snapshot` can contain `id`, `characterId`, `name`, `color`, `position`, `yaw`, `pitch`, `speed`, `velocity`, `running`, `crouching`, `flashlight`, and `visible`. Treat strings and colors as untrusted presentation input: clamp values, limit text, and draw text as text rather than injecting HTML.

The `entry` passed to `animate` contains interpolated state including `displaySpeed`, `targetSpeed`, `displayPitch`, `running`, `crouching`, `crouchAmount`, `gaitPhase`, and `animationTime`. `deltaSeconds` is clamped by the manager. A plugin may smooth its own animation values, but network position and yaw stay with the manager.

`rig` is otherwise private to the character. To opt into manager-controlled distance fading for a name tag, expose:

```js
rig.tag = { sprite, material };
```

The manager adjusts `material.opacity` and `sprite.visible`. The character still creates, positions, updates, and disposes the sprite, texture, canvas, and material.

## Selection and multiplayer behavior

An explicit registered `snapshot.characterId` wins. If it is missing or unknown, every peer chooses the same fallback by hashing the stable player ID into the catalog sorted by `order` and `id`. Duplicate or malformed definitions fail immediately rather than producing different catalogs silently. Factory, avatar creation, and animation failures are quarantined at runtime and fall back to the built-in Surveyor so one community plugin cannot stop the render loop.

Characters are presentation only. They must not add colliders, change player speed, reveal hidden players, simulate damage, alter monster perception, or send network messages. Flashlights and beams on an avatar must mirror `setFlashlightEnabled`; they cannot become a second gameplay light source with independent state.

Animation can be locally interpolated, but any random cosmetic choice should be derived from a stable key such as the player ID. Avoid `Math.random()` so reconnects and peers do not show distracting identity changes.

## Performance and accessibility

- Share geometry and static materials through the factory; keep only color-changing materials per avatar.
- Keep draw calls, transparent layers, dynamic lights, and shadow casters modest for a four-player room.
- Disable raycasting on purely decorative beams and tags.
- Do not start audio, request permissions, fetch remote assets, or create global input handlers from a character plugin.
- Keep silhouettes readable in dark scenes without relying on rapid flashing.

## Validate and inspect

Add a Node test beside the character that imports the definition, creates a factory with `three`, creates one avatar, exercises every method and animation state, then disposes both layers.

```bash
npm run validate:content
npm test
npm run build
npm run dev
```

For visual QA, open two normal tabs at `http://127.0.0.1:5173/?character=hazmat-runner`, replacing the example ID, host a room in one, and join from the other. Verify idle, walk, run, crouch, pitch, color/name changes, flashlight on/off, distance fading, join/leave, reconnect, character switching, and host departure. Inspect both bright and failed-light areas and watch the console for resource or rendering errors.

## Checklist

- The filename matches one discovery pattern, not both.
- `id`, `name`, and `version` are valid; `order` is finite when present.
- Factory and avatar methods match the synchronous contract.
- The supplied Three.js namespace is reused.
- Manager-owned transforms and gameplay state remain untouched.
- Shared and per-avatar resources are disposed at the correct layer.
- Automated checks and two-client visual QA pass.
