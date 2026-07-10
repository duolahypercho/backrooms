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
  const fabricMap = typeof document !== 'undefined'
    && typeof THREE.TextureLoader === 'function'
    && options.materialTextureUrl
    ? new THREE.TextureLoader().load(options.materialTextureUrl)
    : null;
  if (fabricMap) {
    fabricMap.colorSpace = THREE.SRGBColorSpace;
    fabricMap.wrapS = THREE.RepeatWrapping;
    fabricMap.wrapT = THREE.RepeatWrapping;
    fabricMap.repeat.set(3.1, 4.2);
    fabricMap.anisotropy = Math.max(1, Number(options.materialAnisotropy) || 4);
  }
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
    torso: geometry(new THREE.CapsuleGeometry(0.16, 0.24, 8, 24)),
    pelvis: geometry(new THREE.CapsuleGeometry(0.115, 0.035, 6, 20)),
    neck: geometry(new THREE.CylinderGeometry(0.074, 0.086, 0.12, 18, 1)),
    collar: geometry(new THREE.TorusGeometry(0.093, 0.018, 10, 24)),
    head: geometry(new THREE.SphereGeometry(1, 28, 20)),
    visor: geometry(new THREE.SphereGeometry(1, 26, 16)),
    visorFrame: geometry(new THREE.TorusGeometry(1, 0.16, 10, 28)),
    respirator: geometry(new THREE.CylinderGeometry(0.052, 0.074, 0.082, 18, 1)),
    respiratorFilter: geometry(new THREE.CylinderGeometry(0.026, 0.033, 0.036, 14, 1)),
    backpack: geometry(new THREE.BoxGeometry(0.28, 0.39, 0.13)),
    backpackPanel: geometry(new THREE.BoxGeometry(0.205, 0.245, 0.026)),
    canister: geometry(new THREE.CylinderGeometry(0.037, 0.042, 0.25, 18, 1)),
    antenna: geometry(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8, 1)),
    patch: geometry(new THREE.BoxGeometry(0.105, 0.085, 0.018)),
    chestPanel: geometry(new THREE.CapsuleGeometry(0.09, 0.1, 6, 18)),
    harnessStrap: geometry(new THREE.BoxGeometry(0.031, 0.39, 0.018)),
    reflector: geometry(new THREE.BoxGeometry(0.19, 0.025, 0.014)),
    belt: geometry(new THREE.BoxGeometry(0.335, 0.058, 0.218)),
    buckle: geometry(new THREE.BoxGeometry(0.057, 0.047, 0.018)),
    pouch: geometry(new THREE.CapsuleGeometry(0.036, 0.045, 5, 14)),
    jointPad: geometry(new THREE.SphereGeometry(1, 18, 12)),
    kneePad: geometry(new THREE.CapsuleGeometry(0.046, 0.038, 5, 14)),
    upperArm: geometry(new THREE.CapsuleGeometry(0.059, 0.222, 6, 20)),
    lowerArm: geometry(new THREE.CapsuleGeometry(0.049, 0.232, 6, 18)),
    hand: geometry(new THREE.SphereGeometry(1, 18, 12)),
    upperLeg: geometry(new THREE.CapsuleGeometry(0.077, 0.276, 7, 22)),
    lowerLeg: geometry(new THREE.CapsuleGeometry(0.059, 0.312, 7, 20)),
    shoe: geometry(new THREE.CapsuleGeometry(0.056, 0.12, 6, 18)),
    sole: geometry(new THREE.BoxGeometry(0.138, 0.027, 0.242)),
    flashlightBody: geometry(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 14, 1)),
    flashlightLens: geometry(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 16, 1)),
    flashlightBeam: geometry(new THREE.CylinderGeometry(2.6, 0, 8, 12, 1, true)),
    dark: material({ color: 0x101411, roughness: 0.72, metalness: 0.08 }),
    hardware: material({ color: 0x4c5350, roughness: 0.5, metalness: 0.42 }),
    visorMaterial: material({
      color: 0x172120,
      emissive: 0x07100f,
      emissiveIntensity: 0.24,
      roughness: 0.12,
      metalness: 0.32,
    }),
    reflective: material({
      color: 0xd6d2a6,
      emissive: 0x33311e,
      emissiveIntensity: 0.14,
      roughness: 0.38,
      metalness: 0.12,
    }),
    glove: material({ color: 0x171a17, roughness: 0.9, metalness: 0 }),
    boot: material({ color: 0x0d0f0d, roughness: 0.94, metalness: 0 }),
    fabricMap,
    lens: material({
      color: options.flashlightColor,
      emissive: options.flashlightColor,
      emissiveIntensity: 1.35,
      roughness: 0.16,
      metalness: 0.05,
    }),
  };

  for (const side of [-1, 1]) {
    const hosePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.064, -0.062, 0.138),
      new THREE.Vector3(side * 0.084, -0.13, 0.112),
      new THREE.Vector3(side * 0.1, -0.225, 0.074),
      new THREE.Vector3(side * 0.09, -0.31, 0.035),
    ]);
    resources[side < 0 ? 'leftBreathingHose' : 'rightBreathingHose'] = geometry(
      new THREE.TubeGeometry(hosePath, 16, 0.008, 8, false),
    );
  }

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
    fabricMap?.dispose();
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
  sprite.scale.set(0.92, 0.23, 1);
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
    map: resources.fabricMap,
    bumpMap: resources.fabricMap,
    bumpScale: resources.fabricMap ? 0.018 : 0,
    roughness: 0.86,
    metalness: 0.02,
  });
  const accent = clothing.clone();
  accent.color.offsetHSL(0, -0.04, -0.105);
  const ownedMaterials = [clothing, accent];

  const addMesh = (
    name,
    meshGeometry,
    meshMaterial,
    parent,
    position,
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
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

  // The root is the networked floor point; keep the boot soles just above it.
  const hips = joint('hips', bodyRoot, [0, 0.995, 0]);
  addMesh('pelvis', resources.pelvis, accent, hips, [0, 0, 0], [1.28, 0.78, 0.86]);
  addMesh('utility_belt', resources.belt, resources.dark, hips, [0, 0.01, 0]);
  addMesh('belt_buckle', resources.buckle, resources.hardware, hips, [0, 0.008, 0.119]);
  addMesh('left_belt_pouch', resources.pouch, accent, hips, [-0.126, -0.04, 0.11], [0.96, 0.86, 0.58]);
  addMesh('right_belt_pouch', resources.pouch, accent, hips, [0.126, -0.04, 0.11], [0.96, 0.86, 0.58]);

  const torso = joint('torso', hips, [0, 0.12, 0]);
  addMesh('torso_flesh', resources.torso, clothing, torso, [0, 0.26, 0], [1.22, 1, 0.74]);
  addMesh('neck_seal', resources.neck, accent, torso, [0, 0.525, 0]);
  addMesh(
    'collar_ring',
    resources.collar,
    resources.dark,
    torso,
    [0, 0.49, 0],
    [1, 1, 1],
    [Math.PI / 2, 0, 0],
  );

  addMesh('chest_panel', resources.chestPanel, accent, torso, [0, 0.275, 0.132], [1.05, 0.8, 0.14]);
  addMesh('left_harness_strap', resources.harnessStrap, resources.dark, torso, [-0.09, 0.285, 0.148]);
  addMesh('right_harness_strap', resources.harnessStrap, resources.dark, torso, [0.09, 0.285, 0.148]);
  addMesh(
    'chest_harness_strap',
    resources.harnessStrap,
    resources.dark,
    torso,
    [0, 0.365, 0.149],
    [0.78, 1, 1],
    [0, 0, Math.PI / 2],
  );
  addMesh('chest_reflector', resources.reflector, resources.reflective, torso, [0, 0.185, 0.151]);
  addMesh('team_patch', resources.patch, resources.reflective, torso, [-0.086, 0.315, 0.153]);

  addMesh('backpack', resources.backpack, accent, torso, [0, 0.27, -0.16]);
  addMesh('backpack_access_panel', resources.backpackPanel, resources.dark, torso, [0, 0.275, -0.239]);
  addMesh('left_air_canister', resources.canister, resources.hardware, torso, [-0.086, 0.26, -0.257]);
  addMesh('right_air_canister', resources.canister, resources.hardware, torso, [0.086, 0.26, -0.257]);
  addMesh('radio_antenna', resources.antenna, resources.dark, torso, [0.103, 0.535, -0.21]);
  addMesh('backpack_reflector', resources.reflector, resources.reflective, torso, [0, 0.39, -0.256]);

  const head = joint('head', torso, [0, 0.56, 0.006]);
  addMesh('hood', resources.head, clothing, head, [0, 0, 0], [0.12, 0.145, 0.12]);
  addMesh('visor_frame', resources.visorFrame, resources.dark, head, [0, 0.018, 0.126], [0.11, 0.067, 0.02]);
  const visor = addMesh(
    'visor',
    resources.visor,
    resources.visorMaterial,
    head,
    [0, 0.018, 0.116],
    [0.101, 0.058, 0.011],
  );
  visor.castShadow = false;
  const respirator = addMesh(
    'respirator',
    resources.respirator,
    resources.dark,
    head,
    [0, -0.063, 0.125],
    [1, 1, 1],
    [Math.PI / 2, 0, 0],
  );
  respirator.castShadow = false;
  for (const side of [-1, 1]) {
    const filter = addMesh(
      side < 0 ? 'left_respirator_filter' : 'right_respirator_filter',
      resources.respiratorFilter,
      resources.hardware,
      head,
      [side * 0.065, -0.062, 0.14],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
    filter.castShadow = false;
  }
  addMesh('left_breathing_hose', resources.leftBreathingHose, resources.dark, head, [0, 0, 0]);
  addMesh('right_breathing_hose', resources.rightBreathingHose, resources.dark, head, [0, 0, 0]);

  const arms = {};
  for (const [label, side] of [['left', -1], ['right', 1]]) {
    const shoulder = joint(`${label}_shoulder`, torso, [side * 0.205, 0.405, 0]);
    shoulder.rotation.z = side * 0.08;
    addMesh(
      `${label}_shoulder_pad`,
      resources.jointPad,
      accent,
      shoulder,
      [0, -0.008, 0],
      [0.071, 0.052, 0.074],
    );
    addMesh(`${label}_upper_arm`, resources.upperArm, clothing, shoulder, [0, -0.17, 0]);
    const elbow = joint(`${label}_elbow`, shoulder, [0, -0.34, 0]);
    addMesh(`${label}_lower_arm`, resources.lowerArm, accent, elbow, [0, -0.165, 0]);
    addMesh(
      `${label}_elbow_pad`,
      resources.jointPad,
      resources.dark,
      elbow,
      [0, -0.02, 0.052],
      [0.047, 0.052, 0.023],
    );
    const hand = joint(`${label}_hand`, elbow, [0, -0.33, 0]);
    addMesh(
      `${label}_wrist_seal`,
      resources.collar,
      resources.dark,
      hand,
      [0, 0.005, 0],
      [0.56, 0.56, 0.5],
      [Math.PI / 2, 0, 0],
    );
    addMesh(`${label}_glove`, resources.hand, resources.glove, hand, [0, -0.035, 0], [0.06, 0.08, 0.052]);
    arms[label] = { shoulder, elbow, hand };
  }

  const legs = {};
  for (const [label, side] of [['left', -1], ['right', 1]]) {
    const hip = joint(`${label}_hip`, hips, [side * 0.105, -0.04, 0]);
    addMesh(
      `${label}_hip_panel`,
      resources.jointPad,
      accent,
      hip,
      [0, -0.015, 0.035],
      [0.065, 0.055, 0.04],
    );
    addMesh(`${label}_upper_leg`, resources.upperLeg, clothing, hip, [0, -0.215, 0]);
    const knee = joint(`${label}_knee`, hip, [0, -0.43, 0]);
    addMesh(`${label}_lower_leg`, resources.lowerLeg, accent, knee, [0, -0.215, 0]);
    addMesh(
      `${label}_knee_pad`,
      resources.kneePad,
      resources.dark,
      knee,
      [0, -0.055, 0.064],
      [1.05, 1, 0.42],
    );
    const foot = joint(`${label}_foot`, knee, [0, -0.43, 0.045]);
    addMesh(
      `${label}_boot`,
      resources.shoe,
      resources.boot,
      foot,
      [0, -0.025, 0.06],
      [1.05, 1, 1],
      [Math.PI / 2, 0, 0],
    );
    addMesh(`${label}_boot_sole`, resources.sole, resources.dark, foot, [0, -0.079, 0.06]);
    addMesh(
      `${label}_boot_toe`,
      resources.jointPad,
      resources.boot,
      foot,
      [0, -0.038, 0.145],
      [0.064, 0.042, 0.077],
    );
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
  const lateralSway = quarter * motion * (running ? 0.018 : 0.011);

  rig.bodyRoot.position.y = -crouch * 0.13 + bob - groundCompensation;
  rig.bodyRoot.rotation.set(0, 0, lateralSway);
  rig.hips.position.set(-quarter * motion * 0.012, 0.995, 0);
  rig.hips.rotation.set(-runLean * 0.2 + crouch * 0.055, -gait * motion * 0.055, quarter * motion * 0.018);
  rig.torso.position.y = 0.12 - crouch * 0.1;
  rig.torso.rotation.set(runLean + crouch * 0.28 + breath, gait * motion * 0.065, -quarter * motion * 0.02);
  rig.head.position.y = 0.56 + breath * 0.28;
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
  rig.arms.left.elbow.rotation.set(0.12 + Math.max(0, gait) * motion * 0.34, 0, -motion * 0.018);
  rig.arms.right.elbow.rotation.set(0.12 + Math.max(0, -gait) * motion * 0.34, 0, motion * 0.018);
  if (rig.tag) {
    rig.tag.sprite.position.y = rig.tag.standingHeight
      + (rig.tag.crouchHeight - rig.tag.standingHeight) * crouch;
  }
}

export default Object.freeze({
  id: 'threshold-surveyor',
  name: 'Threshold Surveyor',
  version: '1.4.0',
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
