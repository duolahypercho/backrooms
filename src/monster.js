/**
 * Procedural, articulated horror humanoid for Three.js r178+.
 *
 * The module deliberately receives THREE as an argument so it does not create a
 * second Three.js dependency when consumed from a CDN or another bundle.
 */

const TAU = Math.PI * 2;
const BASE_HEIGHT = 2.48;

const IDENTITY_PROFILES = Object.freeze({
  default: {
    id: 'husk',
    surface: { skinRoughness: 0.78, jointRoughness: 0.86 },
    anatomy: {
      shoulders: 1,
      chestWidth: 1,
      chestDepth: 1,
      pelvisWidth: 1,
      headWidth: 1,
      headHeight: 1,
      upperArmLength: 1,
      forearmLength: 1,
      handLength: 1,
      leftBulk: 1,
      rightBulk: 1,
    },
    motion: {
      rhythmWarp: 0.035,
      gaitLeft: 1,
      gaitRight: 1,
      sway: 1,
      headSnap: 0.11,
      snapPeriod: 7.1,
      shoulderSkew: 0.025,
      reach: 1,
      hunch: 1,
      armDrag: 0,
      stopMotionFps: 0,
    },
    presentation: {
      silhouette: 'starved-humanoid',
      eyePulse: 0.18,
      twitchStrength: 0.7,
    },
    sound: {
      breathPitch: 0.82,
      breathWeight: 0.72,
      stepWeight: 0.82,
      drag: 0.08,
    },
  },
  still: {
    id: 'still',
    surface: { skinRoughness: 0.84, jointRoughness: 0.93 },
    anatomy: {
      shoulders: 1.06,
      chestWidth: 0.72,
      chestDepth: 0.68,
      pelvisWidth: 0.67,
      headWidth: 1.06,
      headHeight: 1.02,
      upperArmLength: 1.19,
      forearmLength: 1.18,
      handLength: 1.02,
      leftBulk: 0.58,
      rightBulk: 0.54,
    },
    motion: {
      rhythmWarp: 0.075,
      gaitLeft: 0.91,
      gaitRight: 1.04,
      sway: 0.42,
      headSnap: 0.29,
      snapPeriod: 6.3,
      shoulderSkew: 0.055,
      reach: 1.08,
      hunch: 0.62,
      armDrag: 0.22,
      stopMotionFps: 8,
    },
    presentation: {
      silhouette: 'wire-rib-sentinel',
      eyePulse: 0,
      twitchStrength: 1.25,
    },
    sound: {
      breathPitch: 0.54,
      breathWeight: 0.44,
      stepWeight: 0.62,
      drag: 0.24,
    },
  },
  foreman: {
    id: 'foreman',
    surface: { skinRoughness: 0.84, jointRoughness: 0.91 },
    anatomy: {
      shoulders: 1.17,
      chestWidth: 1.12,
      chestDepth: 1.08,
      pelvisWidth: 1.03,
      headWidth: 0.96,
      headHeight: 0.93,
      upperArmLength: 1.03,
      forearmLength: 0.99,
      handLength: 1.04,
      leftBulk: 1.12,
      rightBulk: 0.94,
    },
    motion: {
      rhythmWarp: 0.12,
      gaitLeft: 0.78,
      gaitRight: 1.08,
      sway: 1.18,
      headSnap: 0.17,
      snapPeriod: 5.4,
      shoulderSkew: 0.14,
      reach: 0.94,
      hunch: 1.36,
      armDrag: 0.14,
      stopMotionFps: 0,
    },
    presentation: {
      silhouette: 'asymmetric-maintenance-husk',
      eyePulse: 0.34,
      twitchStrength: 0.92,
    },
    sound: {
      breathPitch: 0.72,
      breathWeight: 1.05,
      stepWeight: 1.28,
      drag: 0.18,
    },
  },
  wader: {
    id: 'wader',
    surface: { skinRoughness: 0.34, jointRoughness: 0.46 },
    anatomy: {
      shoulders: 0.88,
      chestWidth: 0.9,
      chestDepth: 0.78,
      pelvisWidth: 0.86,
      headWidth: 0.9,
      headHeight: 1.08,
      upperArmLength: 1.13,
      forearmLength: 1.15,
      handLength: 1.12,
      leftBulk: 0.97,
      rightBulk: 0.93,
    },
    motion: {
      rhythmWarp: 0.16,
      gaitLeft: 1.08,
      gaitRight: 0.86,
      sway: 1.42,
      headSnap: 0.2,
      snapPeriod: 4.9,
      shoulderSkew: 0.085,
      reach: 1.16,
      hunch: 1.18,
      armDrag: 0.27,
      stopMotionFps: 0,
    },
    presentation: {
      silhouette: 'waterlogged-dragger',
      eyePulse: 0.48,
      twitchStrength: 0.66,
    },
    sound: {
      breathPitch: 0.63,
      breathWeight: 0.92,
      stepWeight: 1.08,
      drag: 0.52,
    },
  },
});

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

function resolveIdentity(options) {
  const label = `${options.identity || ''} ${options.name || ''}`.toLowerCase();
  if (label.includes('still') || label.includes('faceless')) return 'still';
  if (label.includes('foreman') || label.includes('maintenance')) return 'foreman';
  if (label.includes('wader') || label.includes('waterlogged')) return 'wader';
  return 'default';
}

function hashUnit(value) {
  let integer = Number(value) >>> 0;
  integer = Math.imul(integer ^ (integer >>> 16), 0x21f0aaad);
  integer = Math.imul(integer ^ (integer >>> 15), 0x735a2d97);
  return ((integer ^ (integer >>> 15)) >>> 0) / 4294967296;
}

function deterministicSpike(time, seed, period) {
  const safePeriod = Math.max(1, period);
  const segment = Math.floor(Math.max(0, time) / safePeriod);
  const localTime = Math.max(0, time) - segment * safePeriod;
  const eventTime = safePeriod * (0.18 + hashUnit(seed + segment * 0x9e3779b9) * 0.64);
  const width = 0.065 + hashUnit(seed ^ (segment * 0x85ebca6b)) * 0.11;
  const distance = Math.abs(localTime - eventTime);
  if (distance >= width) return 0;
  const weight = 1 - distance / width;
  return weight * weight * (3 - weight * 2);
}

/**
 * Builds a self-contained procedural monster.
 *
 * Supported config values:
 * - height: world-space standing height (default 2.48)
 * - skinColor, eyeColor, mouthColor, toothColor: Three.js color values
 * - eyeGlow: show dim emissive eye reflections (default true)
 * - eyeIntensity: emissive strength (default 0.7)
 * - skinMap: optional shared grayscale detail texture used as a bump map
 * - detail: "low", "medium", or "high" (default "medium")
 * - castShadow / receiveShadow: mesh shadow flags
 * - seed: deterministic small anatomical asymmetries
 * - identity: "still", "foreman", or "wader" (also inferred from name)
 * - anatomy / motion / presentation / sound: per-identity hook overrides
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
    identity: '',
    ...config,
  };

  const identityKey = resolveIdentity(options);
  const identityDefaults = IDENTITY_PROFILES[identityKey] || IDENTITY_PROFILES.default;
  const identityProfile = {
    ...identityDefaults,
    anatomy: { ...identityDefaults.anatomy, ...(options.anatomy || {}) },
    motion: { ...identityDefaults.motion, ...(options.motion || {}) },
    presentation: { ...identityDefaults.presentation, ...(options.presentation || {}) },
    sound: { ...identityDefaults.sound, ...(options.sound || {}) },
  };
  const baseEyeIntensity = options.eyeGlow && Number.isFinite(Number(options.eyeIntensity))
    ? Number(options.eyeIntensity)
    : options.eyeGlow
      ? 0.7
      : 0;

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
    bumpMap: options.skinMap || null,
    bumpScale: options.skinMap ? (identityKey === 'wader' ? 0.045 : 0.032) : 0,
    roughness: identityProfile.surface.skinRoughness,
    metalness: 0,
    dithering: true,
  });
  const jointMaterial = material({
    color: colorWithOffset(THREE, options.skinColor, -0.018),
    bumpMap: options.skinMap || null,
    bumpScale: options.skinMap ? 0.024 : 0,
    roughness: identityProfile.surface.jointRoughness,
    metalness: 0,
    dithering: true,
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
  const accentMaterial = material({
    color: options.toothColor,
    roughness: identityKey === 'wader' ? 0.48 : 0.74,
    metalness: identityKey === 'foreman' ? 0.12 : 0,
  });
  const eyeMaterialParameters = {
    color: options.eyeColor,
    roughness: 0.3,
    metalness: 0,
  };
  if (options.eyeGlow) {
    eyeMaterialParameters.emissive = options.eyeColor;
    eyeMaterialParameters.emissiveIntensity = baseEyeIntensity;
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
    0.06,
    0.086,
    0.64,
    radialSegments,
    2,
  ));
  const forearmGeometry = geometry(new THREE.CylinderGeometry(
    0.044,
    0.066,
    0.69,
    radialSegments,
    2,
  ));
  const thighGeometry = geometry(new THREE.CylinderGeometry(
    0.072,
    0.114,
    0.61,
    radialSegments,
    2,
  ));
  const shinGeometry = geometry(new THREE.CylinderGeometry(
    0.051,
    0.076,
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

  // Identity is communicated first through silhouette. These proportions stay
  // inside the existing rig so locomotion, collision, and network authority do
  // not need identity-specific branches.
  const anatomy = identityProfile.anatomy;
  const scaleMesh = (mesh, x = 1, y = 1, z = 1) => {
    mesh.scale.x *= x;
    mesh.scale.y *= y;
    mesh.scale.z *= z;
  };
  scaleMesh(chestMesh, anatomy.chestWidth, 1, anatomy.chestDepth);
  scaleMesh(trapeziusMesh, anatomy.shoulders, 1, anatomy.chestDepth);
  scaleMesh(abdomenMesh, anatomy.chestWidth * 0.94, 1, anatomy.chestDepth);
  scaleMesh(pelvisMesh, anatomy.pelvisWidth, 1, anatomy.chestDepth * 0.94);
  scaleMesh(craniumMesh, anatomy.headWidth, anatomy.headHeight, 1);
  scaleMesh(faceMesh, anatomy.headWidth, anatomy.headHeight, identityKey === 'still' ? 0.82 : 1);
  scaleMesh(jawMesh, anatomy.headWidth, anatomy.headHeight, 1);
  neckMesh.scale.x *= anatomy.headWidth;
  sides.left.shoulder.position.x *= anatomy.shoulders;
  sides.right.shoulder.position.x *= anatomy.shoulders;
  sides.left.hip.position.x *= anatomy.pelvisWidth;
  sides.right.hip.position.x *= anatomy.pelvisWidth;

  for (const [label, side] of Object.entries(sides)) {
    const bulk = label === 'left' ? anatomy.leftBulk : anatomy.rightBulk;
    side.elbow.position.y *= anatomy.upperArmLength;
    side.wrist.position.y *= anatomy.forearmLength;
    scaleMesh(side.upperArmMesh, bulk, anatomy.upperArmLength, bulk);
    scaleMesh(side.forearmMesh, bulk, anatomy.forearmLength, bulk);
    scaleMesh(side.handMesh, bulk, anatomy.handLength, bulk);
    side.fingers.forEach((finger) => {
      finger.position.y *= anatomy.handLength;
      finger.scale.y *= anatomy.handLength;
    });
  }

  const secondaryMotion = [];
  if (identityKey === 'still') {
    nose.visible = false;
    mouth.visible = false;
    faceMesh.visible = false;
    jawMesh.visible = true;
    chestMesh.visible = true;
    trapeziusMesh.visible = true;
    abdomenMesh.visible = true;
    eyeSockets.forEach((socket, index) => {
      socket.visible = true;
      socket.position.z = 0.184;
      socket.position.y = 0.058 + (index === 0 ? -asymmetry * 0.18 : asymmetry * 0.18);
      socket.scale.set(0.043, 0.034, 0.011);
    });
    eyes.forEach((eye, index) => {
      eye.visible = Boolean(options.eyeGlow);
      eye.position.z = 0.193;
      eye.position.y = 0.058 + (index === 0 ? -asymmetry * 0.18 : asymmetry * 0.18);
      eye.scale.set(0.011, 0.008, 0.005);
    });
    upperTeeth.forEach((tooth) => { tooth.visible = false; });
    lowerTeeth.forEach((tooth) => { tooth.visible = false; });

    // Preserve the legacy wire-rib identity hooks, but back them with a complete
    // emaciated body. At chase distance this reads as stretched flesh over bone,
    // rather than disconnected primitives floating in the dark.
    craniumMesh.scale.multiply(new THREE.Vector3(1.03, 0.96, 0.98));
    neckMesh.scale.multiply(new THREE.Vector3(0.82, 1.1, 0.86));
    pelvisMesh.scale.multiply(new THREE.Vector3(0.93, 0.86, 0.92));

    createMesh(
      'still_facial_envelope',
      sphereGeometry,
      skinMaterial,
      head,
      [0, -0.006, 0.052],
      [0.16, 0.194, 0.134],
    );
    jawMesh.scale.multiply(new THREE.Vector3(0.94, 0.9, 0.9));

    const seamGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
    const mouthSeam = createMesh(
      'still_mouth_seam',
      seamGeometry,
      mouthMaterial,
      head,
      [asymmetry * 0.22, -0.075, 0.186],
      [0.086, 0.006, 0.006],
    );
    mouthSeam.rotation.z = asymmetry * 1.8;

    if (detail !== 'low') {
      for (const side of [-1, 1]) {
        const brow = createMesh(
          side < 0 ? 'still_brow_left' : 'still_brow_right',
          smallSphereGeometry,
          jointMaterial,
          head,
          [side * 0.061, 0.096 + side * asymmetry * 0.12, 0.176],
          [0.067, 0.022, 0.014],
        );
        brow.rotation.z = side * -0.1;
        createMesh(
          side < 0 ? 'still_cheek_left' : 'still_cheek_right',
          smallSphereGeometry,
          skinMaterial,
          head,
          [side * 0.073, -0.018, 0.166],
          [0.057, 0.068, 0.025],
        );
        if (detail === 'high') {
          createMesh(
            side < 0 ? 'still_ear_left' : 'still_ear_right',
            smallSphereGeometry,
            jointMaterial,
            head,
            [side * 0.169, 0.018, 0.018],
            [0.021, 0.051, 0.014],
          );
        }
      }
    }

    createMesh(
      'still_head_lobe_left',
      smallSphereGeometry,
      jointMaterial,
      head,
      [-0.09, 0.073, -0.035],
      [0.105, 0.14, 0.095],
    );
    createMesh(
      'still_head_lobe_right',
      smallSphereGeometry,
      skinMaterial,
      head,
      [0.095, 0.035, -0.045],
      [0.112, 0.13, 0.092],
    );

    const sternumGeometry = geometry(new THREE.CylinderGeometry(0.024, 0.035, 0.37, 7, 1));
    const sternum = createMesh(
      'still_sternum',
      sternumGeometry,
      jointMaterial,
      chest,
      [asymmetry * 0.2, -0.015, 0.122],
      [1, 1, 0.72],
    );
    sternum.rotation.z = asymmetry * 0.7;

    for (const side of [-1, 1]) {
      const pectoral = createMesh(
        side < 0 ? 'still_pectoral_left' : 'still_pectoral_right',
        smallSphereGeometry,
        skinMaterial,
        chest,
        [side * 0.105, 0.075 + side * asymmetry * 0.2, 0.082],
        [0.13, 0.14, 0.09],
      );
      pectoral.rotation.z = side * 0.07;
      createMesh(
        side < 0 ? 'still_oblique_left' : 'still_oblique_right',
        smallSphereGeometry,
        skinMaterial,
        spine,
        [side * 0.079, 0.205, 0.025],
        [0.075, 0.19, 0.071],
      );
    }

    const ribCount = detail === 'low' ? 3 : 5;
    for (let index = 0; index < ribCount; index += 1) {
      const ribGeometry = geometry(new THREE.TorusGeometry(
        0.205 + index * 0.011,
        detail === 'low' ? 0.016 : 0.013,
        detail === 'low' ? 5 : 7,
        detail === 'high' ? 22 : 16,
        5.15 + (index % 2) * 0.44,
      ));
      const rib = createMesh(
        `still_open_rib_${index + 1}`,
        ribGeometry,
        jointMaterial,
        chest,
        [asymmetry * (index - 2) * 0.7, 0.19 - index * 0.084, 0.119 - index * 0.004],
        [1.02 - index * 0.04, 0.34 + index * 0.012, 0.64],
      );
      rib.rotation.z = (index % 2 ? -0.08 : 0.06) + asymmetry * 2;
      rib.rotation.y = (index - 2) * 0.035;
      secondaryMotion.push({
        node: rib,
        rotation: rib.rotation.clone(),
        phase: 0.7 + index * 1.17,
        amplitude: 0.012 + index * 0.002,
      });
    }

    const neckLoopCount = detail === 'low' ? 2 : 3;
    for (let index = 0; index < neckLoopCount; index += 1) {
      const loopGeometry = geometry(new THREE.TorusGeometry(
        0.084 + index * 0.011,
        0.008,
        6,
        detail === 'high' ? 24 : 18,
        5.1 + index * 0.25,
      ));
      const loop = createMesh(
        `still_neck_loop_${index + 1}`,
        loopGeometry,
        jointMaterial,
        neck,
        [index % 2 ? 0.008 : -0.006, 0.11 - index * 0.055, 0.056],
        [1.02 + index * 0.05, 0.5, 0.72],
      );
      loop.rotation.z = index % 2 ? 0.17 : -0.12;
      loop.rotation.y = -0.08 + index * 0.07;
      secondaryMotion.push({
        node: loop,
        rotation: loop.rotation.clone(),
        phase: 2.4 + index * 1.9,
        amplitude: 0.012 + index * 0.003,
      });
    }

    const spineWireGeometry = geometry(new THREE.CylinderGeometry(0.014, 0.021, 0.25, 6, 1));
    const spineWire = [
      { x: -0.01, y: -0.11, angle: 0.05 },
      { x: 0.013, y: -0.32, angle: -0.07 },
      { x: -0.016, y: -0.52, angle: 0.09 },
    ];
    spineWire.forEach((segment, index) => {
      const bone = createMesh(
        `still_spine_wire_${index + 1}`,
        spineWireGeometry,
        jointMaterial,
        chest,
        [segment.x, segment.y, -0.102],
        [1, index === 2 ? 0.86 : 1, 0.82],
      );
      bone.rotation.z = segment.angle;
      bone.visible = detail === 'high';
    });

    spineNodules.forEach((nodule, index) => {
      nodule.position.x = (index % 2 ? 1 : -1) * (0.018 + index * 0.004);
      nodule.position.z = -0.112;
      nodule.scale.multiplyScalar(0.74 + index * 0.04);
      nodule.visible = detail === 'high';
    });

    for (const [label, side] of Object.entries(sides)) {
      side.upperArmMesh.scale.x *= 0.62;
      side.upperArmMesh.scale.z *= 0.64;
      side.forearmMesh.scale.x *= 0.64;
      side.forearmMesh.scale.z *= 0.66;
      side.handMesh.scale.multiply(new THREE.Vector3(0.82, 0.9, 0.78));
      side.fingers.forEach((finger) => {
        finger.visible = detail !== 'low';
        finger.scale.x *= 0.8;
        finger.scale.z *= 0.8;
      });
      side.upperLegMesh.scale.set(
        side.upperLegMesh.scale.x * 0.78,
        side.upperLegMesh.scale.y * 1.01,
        side.upperLegMesh.scale.z * 0.74,
      );
      side.lowerLegMesh.scale.set(
        side.lowerLegMesh.scale.x * 0.74,
        side.lowerLegMesh.scale.y * 1.02,
        side.lowerLegMesh.scale.z * 0.7,
      );
      side.footMesh.scale.multiply(new THREE.Vector3(0.78, 0.82, 0.88));

      if (detail !== 'low') {
        createMesh(
          `still_${label}_deltoid`,
          smallSphereGeometry,
          skinMaterial,
          side.shoulder,
          [0, -0.035, 0.002],
          [0.09, 0.125, 0.082],
        );
      }
      if (detail === 'high') {
        createMesh(
          `still_${label}_upper_arm_mass`,
          smallSphereGeometry,
          skinMaterial,
          side.upperArm,
          [0, -0.25, 0.004],
          [0.052, 0.19, 0.048],
        );
        createMesh(
          `still_${label}_forearm_mass`,
          smallSphereGeometry,
          jointMaterial,
          side.forearm,
          [0, -0.27, 0.004],
          [0.046, 0.205, 0.043],
        );
        createMesh(
          `still_${label}_thigh_mass`,
          smallSphereGeometry,
          skinMaterial,
          side.upperLeg,
          [0, -0.235, 0.002],
          [0.086, 0.225, 0.077],
        );
        createMesh(
          `still_${label}_calf_mass`,
          smallSphereGeometry,
          jointMaterial,
          side.lowerLeg,
          [0, -0.225, -0.008],
          [0.061, 0.19, 0.057],
        );
      }
    }

    sides.left.upperArm.rotation.z -= 0.13;
    sides.left.elbow.rotation.z += 0.07;
    sides.left.forearm.rotation.z -= 0.04;
    sides.left.wrist.position.y *= 1.07;
    sides.right.upperArm.rotation.z += 0.1;
    sides.right.elbow.rotation.z -= 0.16;
    sides.right.forearm.rotation.z += 0.13;
    sides.right.wrist.rotation.z -= 0.1;

    sides.left.upperLeg.rotation.z -= 0.045;
    sides.left.lowerLeg.rotation.z += 0.03;
    sides.right.upperLeg.rotation.z += 0.11;
    sides.right.knee.rotation.z -= 0.14;
    sides.right.lowerLeg.rotation.z += 0.12;
    sides.right.ankle.rotation.z -= 0.06;
  } else if (identityKey === 'foreman') {
    const strapGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
    const strap = createMesh(
      'foreman_warning_harness',
      strapGeometry,
      accentMaterial,
      chest,
      [-0.035, 0.005, 0.177],
      [0.026, 0.42, 0.014],
    );
    strap.rotation.z = -0.31;
    createMesh(
      'foreman_swollen_shoulder',
      sphereGeometry,
      jointMaterial,
      sides.left.shoulder,
      [-0.018, 0.015, -0.018],
      [0.145, 0.13, 0.12],
    );
    const cableGeometry = geometry(new THREE.CylinderGeometry(0.007, 0.016, 0.43, 6, 1));
    const cable = createJoint('foreman_loose_cable', sides.left.shoulder, -0.055, -0.06, -0.08);
    cable.rotation.z = -0.11;
    createMesh(
      'foreman_loose_cable_flesh',
      cableGeometry,
      accentMaterial,
      cable,
      [0, -0.215, 0],
      [1, 1, 1],
    );
    secondaryMotion.push({
      node: cable,
      rotation: cable.rotation.clone(),
      phase: 1.8,
      amplitude: 0.1,
    });
  } else if (identityKey === 'wader') {
    skinMaterial.metalness = 0.025;
    jointMaterial.metalness = 0.018;
    const tendrilGeometry = geometry(new THREE.CylinderGeometry(0.005, 0.017, 0.34, 5, 1));
    const attachments = [
      { parent: sides.left.hand, position: [-0.025, -0.14, -0.005], phase: 0.2, scale: 1.08 },
      { parent: sides.right.hand, position: [0.025, -0.14, -0.005], phase: 2.1, scale: 0.86 },
      { parent: chest, position: [-0.12, -0.2, -0.08], phase: 3.6, scale: 0.72 },
      { parent: chest, position: [0.14, -0.18, -0.06], phase: 5.2, scale: 0.9 },
    ];
    attachments.slice(0, detail === 'low' ? 2 : attachments.length).forEach((attachment, index) => {
      const tendril = createJoint(
        `wader_tendril_${index + 1}`,
        attachment.parent,
        attachment.position[0],
        attachment.position[1],
        attachment.position[2],
      );
      tendril.rotation.z = index % 2 ? 0.08 : -0.08;
      createMesh(
        `wader_tendril_${index + 1}_flesh`,
        tendrilGeometry,
        jointMaterial,
        tendril,
        [0, -0.17 * attachment.scale, 0],
        [1, attachment.scale, 1],
      );
      secondaryMotion.push({
        node: tendril,
        rotation: tendril.rotation.clone(),
        phase: attachment.phase,
        amplitude: 0.065 + index * 0.012,
      });
    });
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
    secondaryMotion,
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
    accent: accentMaterial,
  };
  monster.userData.identity = identityProfile.id;
  monster.userData.horror = {
    presentation: { ...identityProfile.presentation },
    sound: { ...identityProfile.sound },
    sample: {
      proximity: 0,
      breath: 0,
      twitch: 0,
      attack: 0,
      eyeIntensity: baseEyeIntensity,
    },
  };
  monster.userData.animation = {
    mode: 'idle',
    speed: 0,
    distance: Infinity,
    phase: 0,
    lastTime: null,
    seed: Number(options.seed) >>> 0,
    profile: identityProfile.motion,
    baseEyeIntensity,
  };
  monster.userData.dispose = () => {
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    options.skinMap?.dispose?.();
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
  const isSearching = mode === 'search';
  const isHunting = isStalking || isSearching;
  const isGlimpse = mode === 'glimpse';
  const isIdle = mode === 'idle' || mode === 'hidden' || isGlimpse;
  const animationState = monster.userData.animation;
  const motionProfile = animationState.profile || IDENTITY_PROFILES.default.motion;
  const seed = Number(animationState.seed) >>> 0;
  const stopMotionFps = Number(motionProfile.stopMotionFps) || 0;
  const quantizePose = stopMotionFps > 0 && (isGlimpse || isHunting) && speed < 1.8;
  const poseTime = quantizePose ? Math.floor(time * stopMotionFps) / stopMotionFps : time;
  const proximity = Number.isFinite(distance) ? clamp(1 - (distance - 1.2) / 14, 0, 1) : 0;
  const speedReference = isRunning ? 3.15 : isHunting ? 1.15 : 1.65;
  const motionAmount = clamp(speed / speedReference, 0, 1.2);
  const stride = clamp(motionAmount, 0, 1);
  const cyclesPerSecond = speed > 0.015
    ? (isRunning ? 0.82 + speed * 0.31 : 0.42 + speed * 0.34)
    : 0;
  const rhythmWarp = clamp(
    1 + motionProfile.rhythmWarp * (
      Math.sin(poseTime * 1.71 + (seed & 31)) * 0.68
      + Math.sin(poseTime * 0.47 + 1.9) * 0.32
    ),
    0.72,
    1.28,
  );
  const chaseSurge = isRunning
    ? 1 + deterministicSpike(time + 0.73, seed ^ 0xa511e9b3, 3.15) * 0.14
    : 1;
  const previousTime = animationState.lastTime;
  let phase = Number.isFinite(animationState.phase) ? animationState.phase : 0;
  if (Number.isFinite(previousTime) && time >= previousTime && time - previousTime <= 0.5) {
    phase += (time - previousTime) * TAU * cyclesPerSecond * rhythmWarp * chaseSurge;
  } else {
    phase = time * TAU * cyclesPerSecond;
  }
  const gait = Math.sin(phase);
  const gaitQuarter = Math.cos(phase);
  const doubleStep = Math.abs(Math.sin(phase));
  const breathRate = isRunning ? 1.35 + stride * 0.55 : isHunting ? 0.82 : 0.48;
  const breath = Math.sin(poseTime * TAU * breathRate);
  const breathLift = (breath + 1) * 0.5;
  const idleSway = Math.sin(poseTime * 0.73)
    * Math.sin(poseTime * 0.31 + 0.8)
    * motionProfile.sway;
  const headDrift = Math.sin(poseTime * 0.47 + 1.1) * 0.65
    + Math.sin(poseTime * 0.19) * 0.35;
  const twitchPeriod = motionProfile.snapPeriod * (isRunning ? 0.68 : 1);
  const twitchStrength = Number(monster.userData.horror?.presentation?.twitchStrength) || 1;
  const twitch = clamp(
    deterministicSpike(poseTime, seed ^ 0x68bc21eb, twitchPeriod) * twitchStrength,
    0,
    1.5,
  );
  const twitchSegment = Math.floor(Math.max(0, poseTime) / Math.max(1, twitchPeriod));
  const twitchDirection = hashUnit(seed ^ (twitchSegment * 0x27d4eb2d)) > 0.5 ? 1 : -1;
  const jawPulse = Math.pow(Math.max(0, Math.sin(poseTime * (isAttack ? 15.5 : 9.7) + 0.4)), 8);
  const lean = (
    isAttack ? 0.34 : isRunning ? 0.19 + stride * 0.13 : isHunting ? 0.145 : 0.09
  ) * motionProfile.hunch;
  const legAmplitude = (isRunning ? 0.72 : 0.46) * stride;
  const kneeAmplitude = (isRunning ? 0.92 : 0.52) * stride;
  const armAmplitude = (isRunning ? 0.78 : 0.42) * stride;
  const bodyBob = cyclesPerSecond > 0 ? doubleStep * (isRunning ? 0.047 : 0.026) * stride : 0;
  const breathingBob = breath * (isIdle ? 0.008 : 0.004);
  const groundCompensation = gait * gait * stride * (
    isRunning ? 0.28 : isHunting ? 0.12 : 0.11
  );

  rig.root.position.copy(rig.rest.root.position);
  rig.root.position.y += bodyBob + breathingBob - groundCompensation;
  setRotation(
    rig.root,
    rig.rest.root,
    0,
    twitch * twitchDirection * 0.012,
    -gaitQuarter * 0.012 * stride + idleSway * 0.006 + twitch * twitchDirection * 0.014,
  );

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
    gait * 0.052 * stride + twitch * twitchDirection * motionProfile.shoulderSkew * 0.34,
    -gaitQuarter * 0.018 * stride + idleSway * 0.012 + twitch * twitchDirection * 0.018,
  );
  setRotation(
    rig.chest,
    rig.rest.chest,
    lean * 0.22 - breath * 0.012,
    gait * 0.065 * stride + twitch * twitchDirection * motionProfile.shoulderSkew * 0.56,
    gaitQuarter * 0.025 * stride - idleSway * 0.015 + twitch * twitchDirection * 0.026,
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

  const leftLeg = -gait * legAmplitude * motionProfile.gaitLeft;
  const rightLeg = gait * legAmplitude * motionProfile.gaitRight;
  setRotation(rig.hipL, rig.rest.hipL, leftLeg, 0, -0.012 * stride);
  setRotation(rig.hipR, rig.rest.hipR, rightLeg, 0, 0.012 * stride);
  setRotation(rig.upperLegL, rig.rest.upperLegL, leftLeg * 0.08, 0, 0);
  setRotation(rig.upperLegR, rig.rest.upperLegR, rightLeg * 0.08, 0, 0);

  const leftKnee = Math.max(0, -gait) * kneeAmplitude * motionProfile.gaitLeft
    + (isRunning ? 0.08 * stride : 0);
  const rightKnee = Math.max(0, gait) * kneeAmplitude * motionProfile.gaitRight
    + (isRunning ? 0.08 * stride : 0);
  setRotation(rig.kneeL, rig.rest.kneeL, leftKnee, 0, 0);
  setRotation(rig.kneeR, rig.rest.kneeR, rightKnee, 0, 0);
  setRotation(rig.lowerLegL, rig.rest.lowerLegL, 0, 0, 0);
  setRotation(rig.lowerLegR, rig.rest.lowerLegR, 0, 0, 0);
  setRotation(rig.ankleL, rig.rest.ankleL, -(leftLeg + leftKnee) * 0.48, 0, 0);
  setRotation(rig.ankleR, rig.rest.ankleR, -(rightLeg + rightKnee) * 0.48, 0, 0);
  setRotation(rig.footL, rig.rest.footL, Math.max(0, gait) * 0.1 * stride, 0, 0);
  setRotation(rig.footR, rig.rest.footR, Math.max(0, -gait) * 0.1 * stride, 0, 0);

  const shoulderRise = breathLift * (isRunning ? 0.017 : 0.009);
  const attackReach = isAttack
    ? (0.5 + jawPulse * 0.34) * motionProfile.reach
    : mode === 'chase'
      ? proximity * 0.18 * motionProfile.reach
      : 0;
  const huntingReach = isHunting ? motionProfile.armDrag * (0.28 + proximity * 0.32) : 0;
  rig.shoulderL.position.copy(rig.rest.shoulderL.position);
  rig.shoulderR.position.copy(rig.rest.shoulderR.position);
  rig.shoulderL.position.y += shoulderRise;
  rig.shoulderR.position.y += shoulderRise * 0.86;
  setRotation(
    rig.shoulderL,
    rig.rest.shoulderL,
    gait * armAmplitude * motionProfile.gaitRight - attackReach - huntingReach,
    0,
    -0.025 * stride - twitch * twitchDirection * motionProfile.shoulderSkew,
  );
  setRotation(
    rig.shoulderR,
    rig.rest.shoulderR,
    -gait * armAmplitude * motionProfile.gaitLeft - attackReach - huntingReach * 0.72,
    0,
    0.025 * stride + twitch * twitchDirection * motionProfile.shoulderSkew * 0.68,
  );
  setRotation(rig.upperArmL, rig.rest.upperArmL, gait * armAmplitude * 0.08, 0, 0);
  setRotation(rig.upperArmR, rig.rest.upperArmR, -gait * armAmplitude * 0.08, 0, 0);

  const leftElbow = 0.1 * stride
    + Math.max(0, gait) * armAmplitude * 0.58
    + attackReach * 0.44;
  const rightElbow = 0.1 * stride
    + Math.max(0, -gait) * armAmplitude * 0.58
    + attackReach * 0.38;
  setRotation(rig.elbowL, rig.rest.elbowL, leftElbow, 0, -gaitQuarter * 0.018 * stride);
  setRotation(rig.elbowR, rig.rest.elbowR, rightElbow, 0, gaitQuarter * 0.018 * stride);
  setRotation(rig.forearmL, rig.rest.forearmL, leftElbow * 0.1, 0, 0);
  setRotation(rig.forearmR, rig.rest.forearmR, rightElbow * 0.1, 0, 0);
  setRotation(rig.wristL, rig.rest.wristL, 0.035 + gaitQuarter * 0.055 * stride, 0, -0.025 * stride);
  setRotation(rig.wristR, rig.rest.wristR, 0.02 - gaitQuarter * 0.055 * stride, 0, 0.025 * stride);

  const stareWeight = isGlimpse ? 1 : isHunting ? 0.66 + proximity * 0.34 : 0.3 + proximity * 0.55;
  const snapWeight = isGlimpse ? 1.18 : isHunting ? 1 : isRunning ? 0.54 : 0.28;
  const searchSweep = isSearching ? Math.sin(poseTime * 0.84 + 0.7) * 0.17 : 0;
  const headSnap = twitch * twitchDirection * motionProfile.headSnap * snapWeight;
  const headYaw = headDrift * (isGlimpse ? 0.09 : 0.045) * stareWeight
    - gait * 0.025 * stride
    + searchSweep
    + headSnap;
  const headTilt = idleSway * 0.035 * stareWeight
    + (isGlimpse ? Math.sin(poseTime * 0.22) * 0.025 : 0)
    - headSnap * 0.38;
  setRotation(
    rig.neck,
    rig.rest.neck,
    -lean * 0.68 + breath * 0.012,
    headYaw * 0.28,
    -headTilt * 0.35 + headSnap * 0.14,
  );
  setRotation(
    rig.head,
    rig.rest.head,
    -lean * 0.28 + proximity * 0.035 + gaitQuarter * 0.012 * stride,
    headYaw,
    headTilt,
  );

  // A close chase uses irregular jaw snaps, while idle modes only breathe the jaw.
  const baseJaw = isAttack
    ? 0.5
    : mode === 'chase'
      ? 0.1 + proximity * 0.18
      : isHunting
        ? 0.025 + proximity * 0.065
        : 0.012 + proximity * 0.018;
  const jawSnap = (isRunning ? 0.15 : isHunting ? 0.035 : 0.012) * jawPulse;
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
        restFinger.z + sign * Math.sin(poseTime * 1.7 + index) * 0.008,
      );
    });
  }

  for (const secondary of rig.secondaryMotion || []) {
    secondary.node.rotation.copy(secondary.rotation);
    secondary.node.rotation.x += Math.sin(
      poseTime * (isRunning ? 5.2 : 1.35) + secondary.phase,
    ) * secondary.amplitude * (0.45 + stride * 0.75);
    secondary.node.rotation.z += (
      Math.sin(poseTime * 0.92 + secondary.phase * 1.7) * 0.62
      + gait * stride * 0.38
    ) * secondary.amplitude;
  }

  const horror = monster.userData.horror;
  const eyeMaterial = monster.userData.materials?.eyes;
  const eyePulseAmount = Number(horror?.presentation?.eyePulse) || 0;
  const baseEyeIntensity = Number(animationState.baseEyeIntensity) || 0;
  const eyeIntensity = baseEyeIntensity * (
    1
    + eyePulseAmount * (0.18 + proximity * 0.5 + breathLift * 0.2 + twitch * 0.42)
  );
  if (eyeMaterial && 'emissiveIntensity' in eyeMaterial) eyeMaterial.emissiveIntensity = eyeIntensity;
  if (horror?.sample) {
    horror.sample.proximity = proximity;
    horror.sample.breath = breathLift;
    horror.sample.twitch = twitch;
    horror.sample.attack = clamp(attackReach, 0, 1);
    horror.sample.eyeIntensity = eyeIntensity;
  }

  monster.userData.animation.mode = mode;
  monster.userData.animation.speed = speed;
  monster.userData.animation.distance = distance;
  monster.userData.animation.phase = phase;
  monster.userData.animation.lastTime = time;
  return monster;
}
