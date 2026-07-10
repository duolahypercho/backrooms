/**
 * Built-in procedural teammate character.
 *
 * Character plugin contract:
 *   default { id, name, version?, order?, createFactory({ THREE, options, helpers? }) }
 *   factory { create(snapshot): Avatar, dispose() }
 *   Avatar  { root, rig, setColor, setName, setFlashlightEnabled,
 *             animate(entry, deltaSeconds), dispose }
 */

const TAU = Math.PI * 2;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function makeResources(THREE, options) {
  const geometries = new Set();
  const materials = new Set();
  const geometry = (value) => {
    geometries.add(value);
    return value;
  };
  const material = (parameters) => {
    const value = new THREE.MeshStandardMaterial(parameters);
    materials.add(value);
    return value;
  };

  const resources = {
    torso: geometry(new THREE.CylinderGeometry(0.205, 0.15, 0.52, 7, 1)),
    pelvis: geometry(new THREE.BoxGeometry(0.29, 0.18, 0.2)),
    head: geometry(new THREE.SphereGeometry(1, 9, 7)),
    visor: geometry(new THREE.BoxGeometry(0.19, 0.075, 0.025)),
    backpack: geometry(new THREE.BoxGeometry(0.28, 0.39, 0.13)),
    patch: geometry(new THREE.BoxGeometry(0.105, 0.085, 0.018)),
    upperArm: geometry(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 7, 1)),
    lowerArm: geometry(new THREE.CylinderGeometry(0.044, 0.054, 0.33, 7, 1)),
    hand: geometry(new THREE.SphereGeometry(1, 7, 5)),
    upperLeg: geometry(new THREE.CylinderGeometry(0.07, 0.085, 0.43, 7, 1)),
    lowerLeg: geometry(new THREE.CylinderGeometry(0.052, 0.067, 0.43, 7, 1)),
    shoe: geometry(new THREE.BoxGeometry(0.13, 0.095, 0.23)),
    flashlightBody: geometry(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 8, 1)),
    flashlightLens: geometry(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 8, 1)),
    flashlightBeam: geometry(new THREE.CylinderGeometry(2.6, 0, 8, 12, 1, true)),
    dark: material({ color: 0x101411, roughness: 0.68, metalness: 0.08 }),
    visorMaterial: material({ color: 0x151c1b, roughness: 0.18, metalness: 0.28 }),
    glove: material({ color: 0x171a17, roughness: 0.9, metalness: 0 }),
    boot: material({ color: 0x0d0f0d, roughness: 0.94, metalness: 0 }),
    lens: material({
      color: options.flashlightColor,
      emissive: options.flashlightColor,
      emissiveIntensity: 2.4,
      roughness: 0.16,
      metalness: 0.05,
    }),
  };

  resources.beamMaterial = new THREE.MeshBasicMaterial({
    color: options.flashlightColor,
    transparent: true,
    opacity: options.beamOpacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  materials.add(resources.beamMaterial);
  resources.dispose = () => {
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
  };
  return resources;
}

function makeNameTag(THREE, name, color, standingHeight, crouchHeight) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.name = 'remote_player_name_tag';
  sprite.position.set(0, standingHeight, 0);
  sprite.scale.set(1.28, 0.32, 1);
  sprite.renderOrder = 3;
  sprite.raycast = () => {};

  const tag = {
    canvas,
    context,
    texture,
    material: spriteMaterial,
    sprite,
    standingHeight,
    crouchHeight,
    name: '',
    color: new THREE.Color(color),
    draw(nextName, nextColor) {
      this.name = String(nextName || 'TEAMMATE').trim().slice(0, 22) || 'TEAMMATE';
      if (nextColor !== undefined) this.color.set(nextColor);
      const ctx = this.context;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5, 8, 7, 0.76)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(16, 17, 480, 94, 24);
      else ctx.rect(16, 17, 480, 94);
      ctx.fill();
      ctx.strokeStyle = 'rgba(225, 232, 216, 0.26)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = `#${this.color.getHexString()}`;
      ctx.beginPath();
      ctx.arc(55, 64, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#edf0e7';
      ctx.font = '600 38px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.name, 84, 64, 382);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      spriteMaterial.dispose();
    },
  };
  tag.draw(name, color);
  return tag;
}

function createAvatar(THREE, resources, options, snapshot) {
  const root = new THREE.Group();
  root.name = `remote_player_${String(snapshot.id)}`;
  root.scale.setScalar(options.avatarScale);

  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'remote_player_body_root';
  root.add(bodyRoot);

  const clothing = new THREE.MeshStandardMaterial({
    color: snapshot.color ?? options.defaultColor,
    roughness: 0.86,
    metalness: 0.02,
  });
  const accent = clothing.clone();
  accent.color.offsetHSL(0, -0.04, -0.105);
  const ownedMaterials = [clothing, accent];

  const addMesh = (name, meshGeometry, meshMaterial, parent, position, scale = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = Boolean(options.castShadow);
    mesh.receiveShadow = Boolean(options.receiveShadow);
    parent.add(mesh);
    return mesh;
  };
  const joint = (name, parent, position) => {
    const value = new THREE.Group();
    value.name = name;
    value.position.set(position[0], position[1], position[2]);
    parent.add(value);
    return value;
  };

  const hips = joint('hips', bodyRoot, [0, 0.94, 0]);
  addMesh('pelvis', resources.pelvis, accent, hips, [0, 0, 0]);
  const torso = joint('torso', hips, [0, 0.12, 0]);
  addMesh('torso_flesh', resources.torso, clothing, torso, [0, 0.26, 0]);
  addMesh('backpack', resources.backpack, accent, torso, [0, 0.27, -0.155]);
  addMesh('team_patch', resources.patch, resources.lens, torso, [-0.095, 0.29, 0.176]);

  const head = joint('head', torso, [0, 0.56, 0.006]);
  addMesh('hood', resources.head, clothing, head, [0, 0, 0], [0.155, 0.17, 0.15]);
  const visor = addMesh('visor', resources.visor, resources.visorMaterial, head, [0, 0.012, 0.143]);
  visor.castShadow = false;

  const arms = {};
  for (const [label, side] of [['left', -1], ['right', 1]]) {
    const shoulder = joint(`${label}_shoulder`, torso, [side * 0.205, 0.405, 0]);
    shoulder.rotation.z = side * 0.08;
    addMesh(`${label}_upper_arm`, resources.upperArm, clothing, shoulder, [0, -0.17, 0]);
    const elbow = joint(`${label}_elbow`, shoulder, [0, -0.34, 0]);
    addMesh(`${label}_lower_arm`, resources.lowerArm, accent, elbow, [0, -0.165, 0]);
    const hand = joint(`${label}_hand`, elbow, [0, -0.33, 0]);
    addMesh(`${label}_glove`, resources.hand, resources.glove, hand, [0, -0.035, 0], [0.06, 0.08, 0.052]);
    arms[label] = { shoulder, elbow, hand };
  }

  const legs = {};
  for (const [label, side] of [['left', -1], ['right', 1]]) {
    const hip = joint(`${label}_hip`, hips, [side * 0.105, -0.04, 0]);
    addMesh(`${label}_upper_leg`, resources.upperLeg, clothing, hip, [0, -0.215, 0]);
    const knee = joint(`${label}_knee`, hip, [0, -0.43, 0]);
    addMesh(`${label}_lower_leg`, resources.lowerLeg, accent, knee, [0, -0.215, 0]);
    const foot = joint(`${label}_foot`, knee, [0, -0.43, 0.045]);
    addMesh(`${label}_boot`, resources.shoe, resources.boot, foot, [0, -0.025, 0.06]);
    legs[label] = { hip, knee, foot };
  }

  const flashlightMount = joint('flashlight_mount', head, [0.125, -0.015, 0.135]);
  const flashlightBody = addMesh(
    'flashlight_body',
    resources.flashlightBody,
    resources.dark,
    flashlightMount,
    [0, 0, 0.045],
  );
  flashlightBody.rotation.x = Math.PI / 2;
  const flashlightLens = addMesh(
    'flashlight_lens',
    resources.flashlightLens,
    resources.lens,
    flashlightMount,
    [0, 0, 0.13],
  );
  flashlightLens.rotation.x = Math.PI / 2;
  flashlightLens.castShadow = false;

  const flashlightTarget = new THREE.Object3D();
  flashlightTarget.name = 'remote_flashlight_target';
  flashlightTarget.position.set(0, 0, 6);
  flashlightMount.add(flashlightTarget);
  const flashlight = new THREE.SpotLight(
    options.flashlightColor,
    options.flashlightIntensity,
    options.flashlightDistance,
    options.flashlightAngle,
    0.72,
    2,
  );
  flashlight.name = 'remote_player_flashlight';
  flashlight.position.copy(flashlightLens.position);
  flashlight.castShadow = false;
  flashlight.target = flashlightTarget;
  flashlightMount.add(flashlight);

  const beam = new THREE.Mesh(resources.flashlightBeam, resources.beamMaterial);
  beam.name = 'remote_flashlight_beam';
  beam.position.z = 4.13;
  beam.rotation.x = Math.PI / 2;
  beam.frustumCulled = true;
  beam.renderOrder = 1;
  beam.raycast = () => {};
  flashlightMount.add(beam);

  const tag = options.nameTags
    ? makeNameTag(
      THREE,
      snapshot.name,
      snapshot.color ?? options.defaultColor,
      options.nameTagHeight,
      options.crouchNameTagHeight,
    )
    : null;
  if (tag) root.add(tag.sprite);

  const rig = {
    bodyRoot,
    hips,
    torso,
    head,
    arms,
    legs,
    flashlight,
    flashlightTarget,
    flashlightBody,
    flashlightLens,
    beam,
    tag,
  };
  const setFlashlightEnabled = (enabled) => {
    const visible = Boolean(enabled) && options.flashlights;
    flashlight.visible = visible;
    flashlightLens.visible = visible;
    beam.visible = visible && options.flashlightBeams;
  };
  setFlashlightEnabled(snapshot.flashlight !== false);

  return {
    root,
    rig,
    setColor(color) {
      clothing.color.set(color);
      accent.color.copy(clothing.color).offsetHSL(0, -0.04, -0.105);
      if (tag) tag.draw(tag.name, color);
    },
    setName(name) {
      if (tag && String(name || '') !== tag.name) tag.draw(name, clothing.color);
    },
    setFlashlightEnabled,
    animate: animateAvatar,
    dispose() {
      if (root.parent) root.parent.remove(root);
      if (tag) tag.dispose();
      ownedMaterials.forEach((item) => item.dispose());
      if (typeof flashlight.dispose === 'function') flashlight.dispose();
    },
  };
}

function animateAvatar(entry, deltaSeconds) {
  const { rig } = entry.avatar;
  const speedAlpha = 1 - Math.exp(-9 * deltaSeconds);
  const stateAlpha = 1 - Math.exp(-11 * deltaSeconds);
  entry.displaySpeed += (entry.targetSpeed - entry.displaySpeed) * speedAlpha;
  entry.crouchAmount += ((entry.crouching ? 1 : 0) - entry.crouchAmount) * stateAlpha;
  const running = entry.running || entry.displaySpeed > 2.85;
  const motion = clamp(entry.displaySpeed / (running ? 4.5 : 2.3), 0, 1);
  const cycleRate = entry.displaySpeed > 0.04 ? 4.2 + entry.displaySpeed * 1.55 : 0;
  entry.gaitPhase = (entry.gaitPhase + deltaSeconds * cycleRate) % TAU;

  const gait = Math.sin(entry.gaitPhase);
  const quarter = Math.cos(entry.gaitPhase);
  const crouch = entry.crouchAmount;
  const stride = motion * (running ? 0.78 : 0.56) * (1 - crouch * 0.35);
  const bob = Math.abs(Math.sin(entry.gaitPhase)) * motion * (running ? 0.035 : 0.018);
  const groundCompensation = gait * gait * motion * (running ? 0.22 : 0.065) * (1 - crouch * 0.5);
  const runLean = running ? motion * 0.13 : 0;
  const breath = Math.sin(entry.animationTime * (running ? 8.4 : 3.1)) * (running ? 0.012 : 0.007);

  rig.bodyRoot.position.y = -crouch * 0.13 + bob - groundCompensation;
  rig.hips.rotation.set(-runLean * 0.2 + crouch * 0.055, -gait * motion * 0.055, quarter * motion * 0.018);
  rig.torso.position.y = 0.12 - crouch * 0.1;
  rig.torso.rotation.set(runLean + crouch * 0.28 + breath, gait * motion * 0.065, -quarter * motion * 0.02);
  rig.head.rotation.set(
    -entry.displayPitch - runLean * 0.32 - crouch * 0.08,
    -gait * motion * 0.025,
    quarter * motion * 0.012,
  );

  const leftLeg = -gait * stride;
  const rightLeg = gait * stride;
  rig.legs.left.hip.rotation.set(leftLeg - crouch * 0.65, 0, 0);
  rig.legs.right.hip.rotation.set(rightLeg - crouch * 0.65, 0, 0);
  rig.legs.left.knee.rotation.set(Math.max(0, -gait) * stride * 0.85 + crouch * 1.1, 0, 0);
  rig.legs.right.knee.rotation.set(Math.max(0, gait) * stride * 0.85 + crouch * 1.1, 0, 0);
  rig.legs.left.foot.rotation.set(-leftLeg * 0.32 - crouch * 0.64, 0, 0);
  rig.legs.right.foot.rotation.set(-rightLeg * 0.32 - crouch * 0.64, 0, 0);

  const armSwing = gait * stride * (running ? 0.92 : 0.7);
  rig.arms.left.shoulder.rotation.set(armSwing + crouch * 0.08, 0, -0.08);
  rig.arms.right.shoulder.rotation.set(-armSwing + crouch * 0.08, 0, 0.08);
  rig.arms.left.elbow.rotation.set(0.08 + Math.max(0, gait) * motion * 0.32, 0, 0);
  rig.arms.right.elbow.rotation.set(0.08 + Math.max(0, -gait) * motion * 0.32, 0, 0);
  if (rig.tag) {
    rig.tag.sprite.position.y = rig.tag.standingHeight
      + (rig.tag.crouchHeight - rig.tag.standingHeight) * crouch;
  }
}

export default Object.freeze({
  id: 'threshold-surveyor',
  name: 'Threshold Surveyor',
  version: '1.0.0',
  order: 100,
  createFactory({ THREE, options }) {
    if (!THREE || typeof THREE.Group !== 'function') {
      throw new TypeError('Threshold Surveyor requires the active Three.js namespace.');
    }
    const resources = makeResources(THREE, options);
    let disposed = false;
    return {
      create(snapshot) {
        if (disposed) throw new Error('Threshold Surveyor factory has been disposed.');
        return createAvatar(THREE, resources, options, snapshot);
      },
      dispose() {
        if (disposed) return;
        resources.dispose();
        disposed = true;
      },
    };
  },
});
