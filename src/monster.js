/**
 * Procedural, articulated horror humanoid for Three.js r178+.
 *
 * The module deliberately receives THREE as an argument so it does not create a
 * second Three.js dependency when consumed from a CDN or another bundle.
 */

const TAU = Math.PI * 2;
const BASE_HEIGHT = 2.48;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function seededRandom(seed) {
  let state = (Number(seed) || 0x7f4a7c15) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function colorWithOffset(THREE, color, offset) {
  const result = new THREE.Color(color);
  result.offsetHSL(0, 0, offset);
  return result;
}

/**
 * Builds a self-contained procedural monster.
 *
 * Supported config values:
 * - height: world-space standing height (default 2.48)
 * - skinColor, eyeColor, mouthColor, toothColor: Three.js color values
 * - eyeGlow: show dim emissive eye reflections (default true)
 * - eyeIntensity: emissive strength (default 0.7)
 * - detail: "low", "medium", or "high" (default "medium")
 * - castShadow / receiveShadow: mesh shadow flags
 * - seed: deterministic small anatomical asymmetries
 */
export function buildMonster(THREE, config = {}) {
  if (!THREE || typeof THREE.Group !== 'function' || typeof THREE.Mesh !== 'function') {
    throw new TypeError('buildMonster requires the active Three.js namespace.');
  }

  const options = {
    height: BASE_HEIGHT,
    skinColor: 0x11140f,
    eyeColor: 0xb7c1a5,
    mouthColor: 0x020202,
    toothColor: 0x9f9a7d,
    eyeGlow: true,
    eyeIntensity: 0.7,
    detail: 'medium',
    castShadow: true,
    receiveShadow: false,
    seed: 0x51f15e,
    ...config,
  };

  const detail = options.detail === 'high' ? 'high' : options.detail === 'low' ? 'low' : 'medium';
  const radialSegments = detail === 'high' ? 14 : detail === 'low' ? 8 : 11;
  const verticalSegments = detail === 'high' ? 10 : detail === 'low' ? 6 : 8;
  const random = seededRandom(options.seed);
  const asymmetry = (random() - 0.5) * 0.045;
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

  const skinMaterial = material({
    color: options.skinColor,
    roughness: 0.78,
    metalness: 0,
  });
  const jointMaterial = material({
    color: colorWithOffset(THREE, options.skinColor, -0.018),
    roughness: 0.86,
    metalness: 0,
  });
  const nailMaterial = material({
    color: colorWithOffset(THREE, options.skinColor, -0.045),
    roughness: 0.65,
    metalness: 0,
  });
  const mouthMaterial = material({
    color: options.mouthColor,
    roughness: 1,
    metalness: 0,
  });
  const toothMaterial = material({
    color: options.toothColor,
    roughness: 0.82,
    metalness: 0,
  });
  const eyeMaterialParameters = {
    color: options.eyeColor,
    roughness: 0.3,
    metalness: 0,
  };
  if (options.eyeGlow) {
    eyeMaterialParameters.emissive = options.eyeColor;
    eyeMaterialParameters.emissiveIntensity = Number.isFinite(Number(options.eyeIntensity))
      ? Number(options.eyeIntensity)
      : 0.7;
  }
  const eyeMaterial = material(eyeMaterialParameters);

  const sphereGeometry = geometry(new THREE.SphereGeometry(1, radialSegments, verticalSegments));
  const smallSphereGeometry = geometry(new THREE.SphereGeometry(
    1,
    Math.max(7, radialSegments - 2),
    Math.max(5, verticalSegments - 2),
  ));
  const pelvisGeometry = geometry(new THREE.SphereGeometry(1, radialSegments, verticalSegments));
  const abdomenGeometry = geometry(new THREE.CylinderGeometry(
    0.125,
    0.19,
    0.41,
    radialSegments,
    2,
  ));
  const neckGeometry = geometry(new THREE.CylinderGeometry(
    0.075,
    0.105,
    0.2,
    radialSegments,
    1,
  ));
  const upperArmGeometry = geometry(new THREE.CylinderGeometry(
    0.052,
    0.078,
    0.64,
    radialSegments,
    2,
  ));
  const forearmGeometry = geometry(new THREE.CylinderGeometry(
    0.038,
    0.059,
    0.69,
    radialSegments,
    2,
  ));
  const thighGeometry = geometry(new THREE.CylinderGeometry(
    0.064,
    0.105,
    0.61,
    radialSegments,
    2,
  ));
  const shinGeometry = geometry(new THREE.CylinderGeometry(
    0.045,
    0.068,
    0.53,
    radialSegments,
    2,
  ));
  const fingerGeometry = geometry(new THREE.CylinderGeometry(
    0.007,
    0.012,
    0.19,
    Math.max(5, radialSegments - 4),
    1,
  ));
  const clawGeometry = geometry(new THREE.ConeGeometry(
    0.012,
    0.065,
    Math.max(5, radialSegments - 4),
    1,
  ));
  const toothGeometry = geometry(new THREE.ConeGeometry(0.012, 0.052, 6, 1));
  const noseGeometry = geometry(new THREE.ConeGeometry(0.034, 0.09, 7, 1));
  const collarGeometry = geometry(new THREE.CylinderGeometry(0.014, 0.019, 0.23, 7, 1));

  const monster = new THREE.Group();
  monster.name = options.name || 'ProceduralHorrorMonster';
  monster.scale.setScalar(Math.max(0.1, Number(options.height) || BASE_HEIGHT) / BASE_HEIGHT);

  const rigRoot = new THREE.Group();
  rigRoot.name = 'monster_rig_root';
  monster.add(rigRoot);

  const createJoint = (name, parent, x, y, z) => {
    const joint = new THREE.Group();
    joint.name = name;
    joint.position.set(x, y, z);
    parent.add(joint);
    return joint;
  };

  const createMesh = (name, meshGeometry, meshMaterial, parent, position, scale) => {
    const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    const isTinyDetail = meshMaterial === eyeMaterial
      || meshMaterial === mouthMaterial
      || meshMaterial === toothMaterial
      || meshMaterial === nailMaterial;
    mesh.castShadow = Boolean(options.castShadow) && !isTinyDetail;
    mesh.receiveShadow = Boolean(options.receiveShadow);
    parent.add(mesh);
    return mesh;
  };

  // The pelvis is the animated center of mass. The model origin stays on the floor.
  const pelvis = createJoint('pelvis', rigRoot, 0, 1.26, 0);
  pelvis.rotation.x = -0.015;
  const pelvisMesh = createMesh(
    'pelvis_flesh',
    pelvisGeometry,
    skinMaterial,
    pelvis,
    [0, 0, 0],
    [0.22, 0.18, 0.15],
  );

  const spine = createJoint('spine', pelvis, 0, 0.095, -0.005);
  spine.rotation.x = 0.135;
  const abdomenMesh = createMesh(
    'abdomen',
    abdomenGeometry,
    skinMaterial,
    spine,
    [0, 0.205, 0],
    [1, 1, 0.73],
  );

  const chest = createJoint('chest', spine, 0, 0.39, 0.012);
  chest.rotation.x = 0.095;
  chest.rotation.z = asymmetry * 0.35;
  const chestMesh = createMesh(
    'ribcage',
    sphereGeometry,
    skinMaterial,
    chest,
    [0, 0.01, 0],
    [0.305, 0.335, 0.175],
  );
  const trapeziusMesh = createMesh(
    'trapezius',
    sphereGeometry,
    jointMaterial,
    chest,
    [0, 0.18, -0.005],
    [0.285, 0.125, 0.145],
  );

  // Subtle collarbones and vertebrae catch grazing light at medium range.
  for (const side of [-1, 1]) {
    const collar = createMesh(
      side < 0 ? 'collarbone_left' : 'collarbone_right',
      collarGeometry,
      jointMaterial,
      chest,
      [side * 0.105, 0.125, 0.15],
      [1, 1, 1],
    );
    collar.rotation.z = side * 1.08;
    collar.rotation.x = -0.08;
  }
  const spineNodules = [];
  if (detail !== 'low') {
    for (let index = 0; index < 4; index += 1) {
      const nodule = createMesh(
        `vertebra_${index + 1}`,
        smallSphereGeometry,
        jointMaterial,
        spine,
        [asymmetry * 0.25, 0.09 + index * 0.095, -0.105 - index * 0.011],
        [0.034, 0.042, 0.027],
      );
      spineNodules.push(nodule);
    }
  }

  const neck = createJoint('neck', chest, asymmetry * 0.35, 0.285, 0.055);
  neck.rotation.x = -0.085;
  const neckMesh = createMesh(
    'neck_flesh',
    neckGeometry,
    skinMaterial,
    neck,
    [0, 0.1, 0],
    [1, 1, 0.82],
  );

  const head = createJoint('head', neck, asymmetry, 0.18, 0.018);
  head.rotation.x = -0.055;
  head.rotation.z = -asymmetry * 0.7;
  const craniumMesh = createMesh(
    'cranium',
    sphereGeometry,
    skinMaterial,
    head,
    [0, 0.045, 0],
    [0.178, 0.235, 0.16],
  );
  const faceMesh = createMesh(
    'face',
    sphereGeometry,
    jointMaterial,
    head,
    [0, -0.005, 0.062],
    [0.157, 0.18, 0.125],
  );
  const nose = createMesh(
    'nose',
    noseGeometry,
    jointMaterial,
    head,
    [asymmetry * 0.4, 0.005, 0.173],
    [1, 1, 0.8],
  );
  nose.rotation.x = Math.PI / 2;

  const eyeSockets = [];
  const eyes = [];
  for (const side of [-1, 1]) {
    const socket = createMesh(
      side < 0 ? 'eye_socket_left' : 'eye_socket_right',
      smallSphereGeometry,
      mouthMaterial,
      head,
      [side * 0.062, 0.065 + side * asymmetry * 0.15, 0.161],
      [0.047, 0.039, 0.014],
    );
    eyeSockets.push(socket);
    const eye = createMesh(
      side < 0 ? 'eye_left' : 'eye_right',
      smallSphereGeometry,
      eyeMaterial,
      head,
      [side * 0.062, 0.065 + side * asymmetry * 0.15, 0.175],
      [0.014, 0.011, 0.007],
    );
    eyes.push(eye);
  }

  const mouth = createMesh(
    'mouth_cavity',
    smallSphereGeometry,
    mouthMaterial,
    head,
    [0, -0.078, 0.16],
    [0.102, 0.058, 0.014],
  );

  const jaw = createJoint('jaw', head, 0, -0.055, 0.035);
  const jawMesh = createMesh(
    'lower_jaw',
    sphereGeometry,
    skinMaterial,
    jaw,
    [0, -0.06, 0.052],
    [0.14, 0.105, 0.12],
  );

  const upperTeeth = [];
  const lowerTeeth = [];
  const toothCount = detail === 'low' ? 2 : 4;
  for (let index = 0; index < toothCount; index += 1) {
    const x = (index - (toothCount - 1) / 2) * 0.034;
    const upperTooth = createMesh(
      `upper_tooth_${index + 1}`,
      toothGeometry,
      toothMaterial,
      head,
      [x, -0.052, 0.174],
      [1, 0.65 + random() * 0.32, 0.72],
    );
    upperTooth.rotation.z = Math.PI;
    upperTeeth.push(upperTooth);
    const lowerTooth = createMesh(
      `lower_tooth_${index + 1}`,
      toothGeometry,
      toothMaterial,
      jaw,
      [x, -0.006, 0.158],
      [0.9, 0.55 + random() * 0.28, 0.7],
    );
    lowerTeeth.push(lowerTooth);
  }

  const sides = {};
  for (const [label, side] of [['left', -1], ['right', 1]]) {
    const shoulder = createJoint(
      `${label}_shoulder`,
      chest,
      side * 0.27,
      0.13 + (side < 0 ? asymmetry : -asymmetry),
      -0.008,
    );
    shoulder.rotation.x = 0.055 + side * asymmetry;
    shoulder.rotation.z = side * (0.12 + asymmetry * 0.3);
    createMesh(
      `${label}_shoulder_joint`,
      smallSphereGeometry,
      jointMaterial,
      shoulder,
      [0, 0, 0],
      [0.105, 0.105, 0.09],
    );

    const upperArm = createJoint(`${label}_upper_arm`, shoulder, 0, 0, 0);
    upperArm.rotation.z = side * 0.025;
    const upperArmMesh = createMesh(
      `${label}_upper_arm_flesh`,
      upperArmGeometry,
      skinMaterial,
      upperArm,
      [0, -0.32, 0],
      [1, 1, 0.82],
    );
    const elbow = createJoint(`${label}_elbow`, upperArm, 0, -0.64, 0);
    elbow.rotation.x = 0.08 + side * asymmetry * 0.4;
    createMesh(
      `${label}_elbow_joint`,
      smallSphereGeometry,
      jointMaterial,
      elbow,
      [0, 0, 0],
      [0.065, 0.073, 0.058],
    );

    const forearm = createJoint(`${label}_forearm`, elbow, 0, 0, 0);
    forearm.rotation.z = side * 0.018;
    const forearmMesh = createMesh(
      `${label}_forearm_flesh`,
      forearmGeometry,
      skinMaterial,
      forearm,
      [0, -0.345, 0],
      [1, 1, 0.8],
    );
    const wrist = createJoint(`${label}_wrist`, forearm, 0, -0.69, 0);
    wrist.rotation.z = side * 0.035;
    const hand = createJoint(`${label}_hand`, wrist, 0, 0, 0.005);
    const handMesh = createMesh(
      `${label}_hand_flesh`,
      sphereGeometry,
      skinMaterial,
      hand,
      [0, -0.075, 0.008],
      [0.061, 0.115, 0.043],
    );

    const fingers = [];
    const fingerCount = detail === 'low' ? 2 : 3;
    for (let fingerIndex = 0; fingerIndex < fingerCount; fingerIndex += 1) {
      const spread = fingerIndex - (fingerCount - 1) / 2;
      const finger = createJoint(
        `${label}_finger_${fingerIndex + 1}`,
        hand,
        spread * 0.026,
        -0.14 + Math.abs(spread) * 0.008,
        0.009 - Math.abs(spread) * 0.006,
      );
      finger.rotation.z = side * spread * -0.055;
      finger.rotation.x = 0.035 + Math.abs(spread) * 0.025;
      createMesh(
        `${label}_finger_${fingerIndex + 1}_flesh`,
        fingerGeometry,
        jointMaterial,
        finger,
        [0, -0.095, 0],
        [1, 0.88 - Math.abs(spread) * 0.06, 1],
      );
      const claw = createMesh(
        `${label}_claw_${fingerIndex + 1}`,
        clawGeometry,
        nailMaterial,
        finger,
        [0, -0.195, 0.002],
        [1, 1, 1],
      );
      claw.rotation.z = Math.PI;
      fingers.push(finger);
    }

    const hip = createJoint(`${label}_hip`, pelvis, side * 0.125, -0.06, 0);
    hip.rotation.z = side * 0.022;
    createMesh(
      `${label}_hip_joint`,
      smallSphereGeometry,
      jointMaterial,
      hip,
      [0, 0, 0],
      [0.105, 0.105, 0.09],
    );
    const upperLeg = createJoint(`${label}_upper_leg`, hip, 0, 0, 0);
    const upperLegMesh = createMesh(
      `${label}_thigh_flesh`,
      thighGeometry,
      skinMaterial,
      upperLeg,
      [0, -0.305, 0],
      [1, 1, 0.84],
    );
    const knee = createJoint(`${label}_knee`, upperLeg, 0, -0.61, 0);
    knee.rotation.x = 0.025;
    createMesh(
      `${label}_knee_joint`,
      smallSphereGeometry,
      jointMaterial,
      knee,
      [0, 0, 0.012],
      [0.075, 0.073, 0.068],
    );
    const lowerLeg = createJoint(`${label}_lower_leg`, knee, 0, 0, 0);
    const lowerLegMesh = createMesh(
      `${label}_shin_flesh`,
      shinGeometry,
      skinMaterial,
      lowerLeg,
      [0, -0.265, 0],
      [1, 1, 0.82],
    );
    const ankle = createJoint(`${label}_ankle`, lowerLeg, 0, -0.53, 0);
    const foot = createJoint(`${label}_foot`, ankle, 0, 0, 0.03);
    foot.rotation.x = -0.025;
    const footMesh = createMesh(
      `${label}_foot_flesh`,
      sphereGeometry,
      skinMaterial,
      foot,
      [0, -0.015, 0.075],
      [0.108, 0.065, 0.185],
    );

    sides[label] = {
      shoulder,
      upperArm,
      upperArmMesh,
      elbow,
      forearm,
      forearmMesh,
      wrist,
      hand,
      handMesh,
      fingers,
      hip,
      upperLeg,
      upperLegMesh,
      knee,
      lowerLeg,
      lowerLegMesh,
      ankle,
      foot,
      footMesh,
    };
  }

  const animatedNodes = {
    root: rigRoot,
    pelvis,
    spine,
    chest,
    neck,
    head,
    jaw,
    shoulderL: sides.left.shoulder,
    shoulderR: sides.right.shoulder,
    upperArmL: sides.left.upperArm,
    upperArmR: sides.right.upperArm,
    elbowL: sides.left.elbow,
    elbowR: sides.right.elbow,
    forearmL: sides.left.forearm,
    forearmR: sides.right.forearm,
    wristL: sides.left.wrist,
    wristR: sides.right.wrist,
    handL: sides.left.hand,
    handR: sides.right.hand,
    hipL: sides.left.hip,
    hipR: sides.right.hip,
    upperLegL: sides.left.upperLeg,
    upperLegR: sides.right.upperLeg,
    kneeL: sides.left.knee,
    kneeR: sides.right.knee,
    lowerLegL: sides.left.lowerLeg,
    lowerLegR: sides.right.lowerLeg,
    ankleL: sides.left.ankle,
    ankleR: sides.right.ankle,
    footL: sides.left.foot,
    footR: sides.right.foot,
  };

  const rest = {};
  for (const [key, node] of Object.entries(animatedNodes)) {
    rest[key] = {
      position: node.position.clone(),
      rotation: node.rotation.clone(),
      scale: node.scale.clone(),
    };
  }
  rest.chestMesh = { scale: chestMesh.scale.clone() };
  rest.abdomenMesh = { scale: abdomenMesh.scale.clone() };
  rest.neckMesh = { scale: neckMesh.scale.clone() };

  const rig = {
    ...animatedNodes,
    rigRoot,
    left: sides.left,
    right: sides.right,
    chestMesh,
    abdomenMesh,
    neckMesh,
    pelvisMesh,
    trapeziusMesh,
    craniumMesh,
    faceMesh,
    jawMesh,
    mouth,
    eyes,
    eyeSockets,
    teeth: { upper: upperTeeth, lower: lowerTeeth },
    spineNodules,
    rest,
  };

  monster.userData.isMonster = true;
  monster.userData.height = Math.max(0.1, Number(options.height) || BASE_HEIGHT);
  monster.userData.rig = rig;
  monster.userData.materials = {
    skin: skinMaterial,
    joints: jointMaterial,
    nails: nailMaterial,
    mouth: mouthMaterial,
    teeth: toothMaterial,
    eyes: eyeMaterial,
  };
  monster.userData.animation = {
    mode: 'idle',
    speed: 0,
    distance: Infinity,
    phase: 0,
    lastTime: null,
  };
  monster.userData.dispose = () => {
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
  };

  return monster;
}

function setRotation(node, rest, x = 0, y = 0, z = 0) {
  node.rotation.set(
    rest.rotation.x + x,
    rest.rotation.y + y,
    rest.rotation.z + z,
    rest.rotation.order,
  );
}

/**
 * Applies a deterministic procedural pose. Call once per rendered frame.
 *
 * `time` is elapsed seconds, `speed` is world units per second, `mode` may be
 * idle/glimpse/stalk/walk/run/chase/attack, and `distance` is player distance.
 */
export function animateMonster(monster, state = {}) {
  const rig = monster && monster.userData && monster.userData.rig;
  if (!rig || !rig.rest) return monster;

  const time = Number.isFinite(state.time) ? state.time : 0;
  const speed = Number.isFinite(state.speed) ? Math.abs(state.speed) : 0;
  const distance = Number.isFinite(state.distance) ? Math.max(0, state.distance) : Infinity;
  const mode = typeof state.mode === 'string' ? state.mode.toLowerCase() : 'idle';
  const isAttack = mode === 'attack';
  const isRunning = mode === 'run' || mode === 'chase' || isAttack;
  const isStalking = mode === 'stalk';
  const isGlimpse = mode === 'glimpse';
  const isIdle = mode === 'idle' || mode === 'hidden' || isGlimpse;
  const proximity = Number.isFinite(distance) ? clamp(1 - (distance - 1.2) / 14, 0, 1) : 0;
  const speedReference = isRunning ? 3.15 : isStalking ? 1.15 : 1.65;
  const motion = clamp(speed / speedReference, 0, 1.2);
  const stride = clamp(motion, 0, 1);
  const cyclesPerSecond = speed > 0.015
    ? (isRunning ? 0.82 + speed * 0.31 : 0.42 + speed * 0.34)
    : 0;
  const animationState = monster.userData.animation;
  const previousTime = animationState.lastTime;
  let phase = Number.isFinite(animationState.phase) ? animationState.phase : 0;
  if (Number.isFinite(previousTime) && time >= previousTime && time - previousTime <= 0.5) {
    phase += (time - previousTime) * TAU * cyclesPerSecond;
  } else {
    phase = time * TAU * cyclesPerSecond;
  }
  const gait = Math.sin(phase);
  const gaitQuarter = Math.cos(phase);
  const doubleStep = Math.abs(Math.sin(phase));
  const breathRate = isRunning ? 1.35 + stride * 0.55 : isStalking ? 0.82 : 0.48;
  const breath = Math.sin(time * TAU * breathRate);
  const breathLift = (breath + 1) * 0.5;
  const idleSway = Math.sin(time * 0.73) * Math.sin(time * 0.31 + 0.8);
  const headDrift = Math.sin(time * 0.47 + 1.1) * 0.65 + Math.sin(time * 0.19) * 0.35;
  const lean = isAttack ? 0.34 : isRunning ? 0.19 + stride * 0.13 : isStalking ? 0.145 : 0.09;
  const legAmplitude = (isRunning ? 0.72 : 0.46) * stride;
  const kneeAmplitude = (isRunning ? 0.92 : 0.52) * stride;
  const armAmplitude = (isRunning ? 0.78 : 0.42) * stride;
  const bodyBob = cyclesPerSecond > 0 ? doubleStep * (isRunning ? 0.047 : 0.026) * stride : 0;
  const breathingBob = breath * (isIdle ? 0.008 : 0.004);
  const groundCompensation = gait * gait * stride * (
    isRunning ? 0.28 : isStalking ? 0.12 : 0.11
  );

  rig.root.position.copy(rig.rest.root.position);
  rig.root.position.y += bodyBob + breathingBob - groundCompensation;
  setRotation(rig.root, rig.rest.root, 0, 0, -gaitQuarter * 0.012 * stride + idleSway * 0.006);

  rig.pelvis.position.copy(rig.rest.pelvis.position);
  rig.pelvis.position.x += gaitQuarter * 0.013 * stride;
  setRotation(
    rig.pelvis,
    rig.rest.pelvis,
    -lean * 0.13 + gaitQuarter * 0.018 * stride,
    -gait * 0.075 * stride,
    gaitQuarter * 0.025 * stride,
  );
  setRotation(
    rig.spine,
    rig.rest.spine,
    lean + breathLift * 0.012,
    gait * 0.052 * stride,
    -gaitQuarter * 0.018 * stride + idleSway * 0.012,
  );
  setRotation(
    rig.chest,
    rig.rest.chest,
    lean * 0.22 - breath * 0.012,
    gait * 0.065 * stride,
    gaitQuarter * 0.025 * stride - idleSway * 0.015,
  );

  const chestExpansion = breath * (isRunning ? 0.016 : 0.026);
  rig.chestMesh.scale.set(
    rig.rest.chestMesh.scale.x * (1 + chestExpansion * 0.7),
    rig.rest.chestMesh.scale.y * (1 + chestExpansion * 0.25),
    rig.rest.chestMesh.scale.z * (1 + chestExpansion),
  );
  rig.abdomenMesh.scale.set(
    rig.rest.abdomenMesh.scale.x * (1 + chestExpansion * 0.35),
    rig.rest.abdomenMesh.scale.y,
    rig.rest.abdomenMesh.scale.z * (1 + chestExpansion * 0.48),
  );
  rig.neckMesh.scale.set(
    rig.rest.neckMesh.scale.x,
    rig.rest.neckMesh.scale.y * (1 + breathLift * 0.006),
    rig.rest.neckMesh.scale.z,
  );

  const leftLeg = -gait * legAmplitude;
  const rightLeg = gait * legAmplitude;
  setRotation(rig.hipL, rig.rest.hipL, leftLeg, 0, -0.012 * stride);
  setRotation(rig.hipR, rig.rest.hipR, rightLeg, 0, 0.012 * stride);
  setRotation(rig.upperLegL, rig.rest.upperLegL, leftLeg * 0.08, 0, 0);
  setRotation(rig.upperLegR, rig.rest.upperLegR, rightLeg * 0.08, 0, 0);

  const leftKnee = Math.max(0, -gait) * kneeAmplitude + (isRunning ? 0.08 * stride : 0);
  const rightKnee = Math.max(0, gait) * kneeAmplitude + (isRunning ? 0.08 * stride : 0);
  setRotation(rig.kneeL, rig.rest.kneeL, leftKnee, 0, 0);
  setRotation(rig.kneeR, rig.rest.kneeR, rightKnee, 0, 0);
  setRotation(rig.lowerLegL, rig.rest.lowerLegL, 0, 0, 0);
  setRotation(rig.lowerLegR, rig.rest.lowerLegR, 0, 0, 0);
  setRotation(rig.ankleL, rig.rest.ankleL, -(leftLeg + leftKnee) * 0.48, 0, 0);
  setRotation(rig.ankleR, rig.rest.ankleR, -(rightLeg + rightKnee) * 0.48, 0, 0);
  setRotation(rig.footL, rig.rest.footL, Math.max(0, gait) * 0.1 * stride, 0, 0);
  setRotation(rig.footR, rig.rest.footR, Math.max(0, -gait) * 0.1 * stride, 0, 0);

  const shoulderRise = breathLift * (isRunning ? 0.017 : 0.009);
  rig.shoulderL.position.copy(rig.rest.shoulderL.position);
  rig.shoulderR.position.copy(rig.rest.shoulderR.position);
  rig.shoulderL.position.y += shoulderRise;
  rig.shoulderR.position.y += shoulderRise * 0.86;
  setRotation(rig.shoulderL, rig.rest.shoulderL, gait * armAmplitude, 0, -0.025 * stride);
  setRotation(rig.shoulderR, rig.rest.shoulderR, -gait * armAmplitude, 0, 0.025 * stride);
  setRotation(rig.upperArmL, rig.rest.upperArmL, gait * armAmplitude * 0.08, 0, 0);
  setRotation(rig.upperArmR, rig.rest.upperArmR, -gait * armAmplitude * 0.08, 0, 0);

  const leftElbow = 0.1 * stride + Math.max(0, gait) * armAmplitude * 0.58;
  const rightElbow = 0.1 * stride + Math.max(0, -gait) * armAmplitude * 0.58;
  setRotation(rig.elbowL, rig.rest.elbowL, leftElbow, 0, -gaitQuarter * 0.018 * stride);
  setRotation(rig.elbowR, rig.rest.elbowR, rightElbow, 0, gaitQuarter * 0.018 * stride);
  setRotation(rig.forearmL, rig.rest.forearmL, leftElbow * 0.1, 0, 0);
  setRotation(rig.forearmR, rig.rest.forearmR, rightElbow * 0.1, 0, 0);
  setRotation(rig.wristL, rig.rest.wristL, 0.035 + gaitQuarter * 0.055 * stride, 0, -0.025 * stride);
  setRotation(rig.wristR, rig.rest.wristR, 0.02 - gaitQuarter * 0.055 * stride, 0, 0.025 * stride);

  const stareWeight = isGlimpse ? 1 : isStalking ? 0.66 + proximity * 0.34 : 0.3 + proximity * 0.55;
  const headYaw = headDrift * (isGlimpse ? 0.09 : 0.045) * stareWeight - gait * 0.025 * stride;
  const headTilt = idleSway * 0.035 * stareWeight + (isGlimpse ? Math.sin(time * 0.22) * 0.025 : 0);
  setRotation(
    rig.neck,
    rig.rest.neck,
    -lean * 0.68 + breath * 0.012,
    headYaw * 0.32,
    -headTilt * 0.35,
  );
  setRotation(
    rig.head,
    rig.rest.head,
    -lean * 0.28 + proximity * 0.035 + gaitQuarter * 0.012 * stride,
    headYaw,
    headTilt,
  );

  // A close chase uses irregular jaw snaps, while idle modes only breathe the jaw.
  const jawPulse = Math.pow(Math.max(0, Math.sin(time * (isAttack ? 15.5 : 9.7) + 0.4)), 8);
  const baseJaw = isAttack
    ? 0.5
    : mode === 'chase'
      ? 0.1 + proximity * 0.18
      : isStalking
        ? 0.025 + proximity * 0.065
        : 0.012 + proximity * 0.018;
  const jawSnap = (isRunning ? 0.15 : isStalking ? 0.035 : 0.012) * jawPulse;
  setRotation(rig.jaw, rig.rest.jaw, baseJaw + jawSnap + breathLift * 0.009, 0, 0);

  // Fingers stay cheap but avoid reading as a single rigid paddle during a run.
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    rig[side].fingers.forEach((finger, index) => {
      const restFinger = finger.userData.monsterRest || {
        x: finger.rotation.x,
        y: finger.rotation.y,
        z: finger.rotation.z,
      };
      if (!finger.userData.monsterRest) finger.userData.monsterRest = restFinger;
      finger.rotation.set(
        restFinger.x + 0.025 * breathLift + jawPulse * 0.035,
        restFinger.y,
        restFinger.z + sign * Math.sin(time * 1.7 + index) * 0.008,
      );
    });
  }

  monster.userData.animation.mode = mode;
  monster.userData.animation.speed = speed;
  monster.userData.animation.distance = distance;
  monster.userData.animation.phase = phase;
  monster.userData.animation.lastTime = time;
  return monster;
}
