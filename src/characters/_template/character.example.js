/**
 * DOCUMENTATION TEMPLATE — NOT AUTO-LOADED.
 *
 * Fill every TODO, then copy this file to either `my-character/character.js`
 * or `my-character.character.js` (never both). The simple geometry keeps the
 * lifecycle visible; copy threshold-surveyor for a production articulated rig.
 */
export default Object.freeze({
  id: 'todo-character-slug',
  name: 'TODO Character Name',
  version: '1.0.0', // Bump whenever this plugin's visual/runtime behavior changes.
  order: 200,

  createFactory({ THREE, options, helpers = {} }) {
    if (!THREE || typeof THREE.Group !== 'function') {
      throw new TypeError('TODO Character requires the active Three.js namespace.');
    }

    const clamp = helpers.clamp
      || ((value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)));
    const bodyGeometry = new THREE.BoxGeometry(0.42, 1.25, 0.28);
    const headGeometry = new THREE.SphereGeometry(0.2, 10, 8);
    const markerGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.025);
    let factoryDisposed = false;

    return {
      create(snapshot) {
        if (factoryDisposed) throw new Error('TODO Character factory was already disposed.');

        const root = new THREE.Group();
        root.name = `remote_player_${String(snapshot.id)}`;
        root.scale.setScalar(options.avatarScale ?? 1);

        const bodyRoot = new THREE.Group();
        root.add(bodyRoot);
        const material = new THREE.MeshStandardMaterial({
          color: snapshot.color ?? options.defaultColor ?? 0x596653,
          roughness: 0.9,
        });
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: options.flashlightColor ?? 0xffedbd,
          emissive: options.flashlightColor ?? 0xffedbd,
          emissiveIntensity: 1.4,
        });

        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 0.78;
        body.castShadow = Boolean(options.castShadow);
        bodyRoot.add(body);

        const head = new THREE.Mesh(headGeometry, material);
        head.position.set(0, 1.57, 0.02);
        head.castShadow = Boolean(options.castShadow);
        bodyRoot.add(head);

        // Local +Z is forward. This marker stands in for a synced flashlight.
        const flashlightMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        flashlightMarker.position.set(0.14, 1.55, 0.2);
        flashlightMarker.visible = snapshot.flashlight !== false && options.flashlights !== false;
        bodyRoot.add(flashlightMarker);

        const rig = { bodyRoot, body, head, flashlightMarker };
        let disposed = false;

        return {
          root,
          rig,
          setColor(color) {
            material.color.set(color);
          },
          setName(_name) {
            // TODO: update a safe canvas/Sprite name tag, or intentionally no-op.
          },
          setFlashlightEnabled(enabled) {
            flashlightMarker.visible = Boolean(enabled) && options.flashlights !== false;
          },
          animate(entry, deltaSeconds) {
            const speedAlpha = 1 - Math.exp(-9 * deltaSeconds);
            const stateAlpha = 1 - Math.exp(-11 * deltaSeconds);
            entry.displaySpeed += (entry.targetSpeed - entry.displaySpeed) * speedAlpha;
            entry.crouchAmount += ((entry.crouching ? 1 : 0) - entry.crouchAmount) * stateAlpha;
            entry.gaitPhase += deltaSeconds * (3.5 + entry.displaySpeed * 1.4);
            const motion = clamp(entry.displaySpeed / 3.5, 0, 1);
            rig.bodyRoot.position.y = -entry.crouchAmount * 0.25
              + Math.abs(Math.sin(entry.gaitPhase)) * motion * 0.025;
            rig.head.rotation.x = -entry.displayPitch;
            rig.body.rotation.z = Math.sin(entry.gaitPhase) * motion * 0.025;
          },
          dispose() {
            if (disposed) return;
            if (root.parent) root.parent.remove(root);
            material.dispose();
            markerMaterial.dispose();
            disposed = true;
          },
        };
      },
      dispose() {
        if (factoryDisposed) return;
        bodyGeometry.dispose();
        headGeometry.dispose();
        markerGeometry.dispose();
        factoryDisposed = true;
      },
    };
  },
});
