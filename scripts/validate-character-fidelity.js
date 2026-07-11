#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const ASSETS = [
  {
    label: 'Hazmat Explorer',
    path: 'public/models/characters/hazmat-explorer.glb',
    candidatePath: 'art/characters/candidates/hazmat-hd/hazmat-hd.glb',
    material: 'MAT_SuitTint',
    clips: ['Idle', 'Walk', 'Run', 'CrouchIdle', 'CrouchWalk'],
    height: 1.84,
    requiredNodes: [['Head', 'HeadAim'], ['flashlight_socket']],
  },
  {
    label: 'Pale Entity',
    path: 'public/models/monsters/pale-entity.glb',
    candidatePath: 'art/characters/candidates/pale-hd/pale-entity-web.glb',
    material: 'PaleEntity_Skin',
    clips: ['Idle', 'Glimpse', 'Stalk', 'Search', 'Chase', 'Attack'],
    height: 2.45,
    requiredNodes: [['PaleEntity_Armature'], ['PaleEntity_Mesh'], ['ROOT']],
  },
];

function parseGlb(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32LE(0), GLB_MAGIC, `${path} must be a GLB`);
  assert.equal(bytes.readUInt32LE(4), 2, `${path} must use glTF 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${path} has a bad declared length`);
  let json = null;
  let binary = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= bytes.length, `${path} contains a truncated GLB chunk`);
    if (type === JSON_CHUNK) json = JSON.parse(bytes.subarray(start, end).toString('utf8').trim());
    if (type === BIN_CHUNK) binary = bytes.subarray(start, end);
    offset = end;
  }
  assert.ok(json && binary, `${path} must embed JSON and binary chunks`);
  return { bytes, json, binary };
}

function imageBytes(gltf, binary, image) {
  if (Number.isInteger(image?.bufferView)) {
    const view = gltf.bufferViews?.[image.bufferView];
    assert.ok(view, 'embedded image references a missing bufferView');
    const start = Number(view.byteOffset) || 0;
    return binary.subarray(start, start + view.byteLength);
  }
  if (typeof image?.uri === 'string' && image.uri.startsWith('data:')) {
    return Buffer.from(image.uri.slice(image.uri.indexOf(',') + 1), 'base64');
  }
  throw new Error('PBR images must be embedded in the GLB');
}

function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF') {
    const signature = bytes.subarray(12, 16).toString('ascii');
    if (signature === 'VP8X') {
      return [
        1 + bytes.readUIntLE(24, 3),
        1 + bytes.readUIntLE(27, 3),
      ];
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
      }
      offset += 2 + Math.max(2, length);
    }
  }
  throw new Error('PBR image format does not expose readable dimensions');
}

function textureImage(gltf, textureInfo) {
  const texture = gltf.textures?.[textureInfo?.index];
  const source = texture?.source ?? texture?.extensions?.EXT_texture_webp?.source;
  return gltf.images?.[source];
}

const COMPONENT_READERS = Object.freeze({
  5120: { bytes: 1, read: (buffer, offset) => buffer.readInt8(offset), scale: 127 },
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset), scale: 255 },
  5122: { bytes: 2, read: (buffer, offset) => buffer.readInt16LE(offset), scale: 32767 },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset), scale: 65535 },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset), scale: 4294967295 },
  5126: { bytes: 4, read: (buffer, offset) => buffer.readFloatLE(offset), scale: 1 },
});
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 });

function readAccessor(gltf, binary, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  assert.ok(accessor, `missing accessor ${accessorIndex}`);
  assert.ok(!accessor.sparse, `accessor ${accessorIndex} uses unsupported sparse storage`);
  const view = gltf.bufferViews?.[accessor.bufferView];
  assert.ok(view, `accessor ${accessorIndex} references a missing bufferView`);
  const format = COMPONENT_READERS[accessor.componentType];
  const components = TYPE_COMPONENTS[accessor.type];
  assert.ok(format && components, `accessor ${accessorIndex} has an unsupported format`);
  const packedStride = format.bytes * components;
  const stride = view.byteStride || packedStride;
  assert.ok(stride >= packedStride, `accessor ${accessorIndex} has an invalid byte stride`);
  const start = (Number(view.byteOffset) || 0) + (Number(accessor.byteOffset) || 0);
  const end = start + Math.max(0, accessor.count - 1) * stride + packedStride;
  assert.ok(end <= binary.length, `accessor ${accessorIndex} exceeds its binary buffer`);
  return Array.from({ length: accessor.count }, (_, rowIndex) => (
    Array.from({ length: components }, (_, componentIndex) => {
      const value = format.read(binary, start + rowIndex * stride + componentIndex * format.bytes);
      if (!accessor.normalized || accessor.componentType === 5126) return value;
      return accessor.componentType === 5120 || accessor.componentType === 5122
        ? Math.max(-1, value / format.scale)
        : value / format.scale;
    })
  ));
}

function triangleCount(gltf) {
  let count = 0;
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const vertices = gltf.accessors?.[primitive.attributes?.POSITION]?.count || 0;
      const indices = Number.isInteger(primitive.indices)
        ? gltf.accessors?.[primitive.indices]?.count || 0
        : vertices;
      const mode = primitive.mode ?? 4;
      count += mode === 4 ? Math.floor(indices / 3) : mode === 5 || mode === 6 ? Math.max(0, indices - 2) : 0;
    }
  }
  return count;
}

function surfaceTopology(gltf, binary, primitives) {
  let totalTriangles = 0;
  let largestComponent = 0;
  let maximumEdge = 0;

  for (const primitive of primitives) {
    assert.equal(primitive.mode ?? 4, 4, 'character surfaces must use indexed triangles');
    const positions = readAccessor(gltf, binary, primitive.attributes.POSITION);
    const indices = Number.isInteger(primitive.indices)
      ? readAccessor(gltf, binary, primitive.indices).map(([index]) => index)
      : positions.map((_, index) => index);
    const parent = Int32Array.from({ length: positions.length }, (_, index) => index);
    const find = (value) => {
      let root = value;
      while (parent[root] !== root) root = parent[root];
      while (parent[value] !== value) {
        const next = parent[value];
        parent[value] = root;
        value = next;
      }
      return root;
    };
    const unite = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    };
    // glTF duplicates positions at UV, tangent, normal, and material seams.
    // Weld coincident export vertices before measuring authored surface
    // connectivity; otherwise a single continuous anatomical mesh is falsely
    // reported as dozens of islands.
    const coincidentPositions = new Map();
    positions.forEach((position, index) => {
      const key = position.map((value) => Math.round(value * 100000)).join(',');
      const existing = coincidentPositions.get(key);
      if (existing === undefined) coincidentPositions.set(key, index);
      else unite(existing, index);
    });
    const edgeLength = (left, right) => Math.hypot(
      positions[left][0] - positions[right][0],
      positions[left][1] - positions[right][1],
      positions[left][2] - positions[right][2],
    );

    for (let index = 0; index + 2 < indices.length; index += 3) {
      const triangle = indices.slice(index, index + 3);
      triangle.forEach((vertex) => assert.ok(vertex < positions.length, 'triangle index exceeds its position accessor'));
      unite(triangle[0], triangle[1]);
      unite(triangle[1], triangle[2]);
      maximumEdge = Math.max(
        maximumEdge,
        edgeLength(triangle[0], triangle[1]),
        edgeLength(triangle[1], triangle[2]),
        edgeLength(triangle[2], triangle[0]),
      );
    }
    const componentTriangles = new Map();
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const root = find(indices[index]);
      componentTriangles.set(root, (componentTriangles.get(root) || 0) + 1);
    }
    const primitiveTriangles = Math.floor(indices.length / 3);
    totalTriangles += primitiveTriangles;
    for (const triangleTotal of componentTriangles.values()) {
      largestComponent = Math.max(largestComponent, triangleTotal);
    }
  }

  return {
    connectedRatio: totalTriangles > 0 ? largestComponent / totalTriangles : 0,
    maximumEdge,
  };
}

function geometryBounds(gltf) {
  const minima = [Infinity, Infinity, Infinity];
  const maxima = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) continue;
      for (let axis = 0; axis < 3; axis += 1) {
        minima[axis] = Math.min(minima[axis], accessor.min[axis]);
        maxima[axis] = Math.max(maxima[axis], accessor.max[axis]);
      }
    }
  }
  return { minima, maxima, height: maxima[1] - minima[1] };
}

function validateAsset(spec) {
  const path = resolve(spec.path);
  const { bytes, json: gltf, binary } = parseGlb(path);
  const extensions = new Set(gltf.extensionsUsed || []);
  ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].forEach((extension) => {
    assert.ok(!extensions.has(extension), `${spec.label} uses ${extension} without a configured runtime decoder`);
  });
  (gltf.images || []).forEach((image) => {
    assert.ok(
      Number.isInteger(image.bufferView) || String(image.uri || '').startsWith('data:'),
      `${spec.label} contains an external texture URL`,
    );
  });
  (gltf.buffers || []).forEach((buffer) => {
    assert.ok(!buffer.uri, `${spec.label} contains an external binary buffer URL`);
  });
  const materialIndex = (gltf.materials || []).findIndex(({ name }) => name === spec.material);
  assert.notEqual(materialIndex, -1, `${spec.label} lost ${spec.material}`);
  const material = gltf.materials[materialIndex];
  const pbr = material.pbrMetallicRoughness || {};
  const maps = {
    albedo: pbr.baseColorTexture,
    normal: material.normalTexture,
    roughness: pbr.metallicRoughnessTexture,
    ao: material.occlusionTexture,
  };
  Object.entries(maps).forEach(([name, info]) => {
    assert.ok(info && Number.isInteger(info.index), `${spec.label} ${spec.material} needs a ${name} texture`);
    const image = textureImage(gltf, info);
    assert.ok(image, `${spec.label} ${name} texture references no image`);
    const payload = imageBytes(gltf, binary, image);
    const dimensions = imageDimensions(payload);
    assert.ok(
      dimensions[0] >= 2048 && dimensions[1] >= 2048,
      `${spec.label} ${name} map is ${dimensions.join('x')}; require at least 2048x2048`,
    );
    assert.ok(payload.length >= 64 * 1024, `${spec.label} ${name} map is suspiciously flat (${payload.length} bytes)`);
    if (name !== 'albedo') {
      assert.equal(image.mimeType, 'image/png', `${spec.label} ${name} map must be lossless PNG`);
    }
  });

  const primaryPrimitives = (gltf.meshes || []).flatMap(({ primitives = [] }) => (
    primitives.filter((primitive) => primitive.material === materialIndex)
  ));
  assert.ok(primaryPrimitives.length > 0, `${spec.label} has no geometry using ${spec.material}`);
  primaryPrimitives.forEach((primitive) => {
    assert.ok(Number.isInteger(primitive.attributes?.POSITION), `${spec.label} primary surface needs positions`);
    assert.ok(Number.isInteger(primitive.attributes?.NORMAL), `${spec.label} primary surface needs normals`);
    assert.ok(Number.isInteger(primitive.attributes?.TANGENT), `${spec.label} primary surface needs tangents for its normal map`);
    assert.ok(Number.isInteger(primitive.attributes?.TEXCOORD_0), `${spec.label} primary surface needs UVs`);
    assert.ok(Number.isInteger(primitive.attributes?.JOINTS_0), `${spec.label} primary surface needs skin joints`);
    assert.ok(Number.isInteger(primitive.attributes?.WEIGHTS_0), `${spec.label} primary surface needs blended weights`);
  });

  let weightedVertices = 0;
  let blendedVertices = 0;
  primaryPrimitives.forEach((primitive) => {
    readAccessor(gltf, binary, primitive.attributes.WEIGHTS_0).forEach((weights) => {
      const influences = weights.filter((weight) => weight > 0.001).length;
      if (influences > 0) weightedVertices += 1;
      if (influences > 1) blendedVertices += 1;
    });
  });
  const blendedWeightRatio = weightedVertices > 0 ? blendedVertices / weightedVertices : 0;
  assert.ok(
    blendedWeightRatio >= 0.08,
    `${spec.label} only blends ${(blendedWeightRatio * 100).toFixed(1)}% of primary-surface vertices; require 8%`,
  );
  const topology = surfaceTopology(gltf, binary, primaryPrimitives);
  assert.ok(
    topology.connectedRatio >= 0.5,
    `${spec.label} largest continuous primary surface is only ${(topology.connectedRatio * 100).toFixed(1)}%; require 50%`,
  );
  assert.ok(
    topology.maximumEdge <= 0.75,
    `${spec.label} contains a ${topology.maximumEdge.toFixed(3)}m triangle edge, indicating stretched topology`,
  );

  const triangles = triangleCount(gltf);
  assert.ok(triangles >= 50000, `${spec.label} has only ${triangles} triangles; high-detail floor is 50000`);
  assert.ok(triangles <= 180000, `${spec.label} exceeds the 180000 triangle browser budget`);
  assert.ok(bytes.length <= 12 * 1024 * 1024, `${spec.label} exceeds the 12 MiB delivery budget`);
  assert.ok((gltf.skins || []).length >= 1, `${spec.label} needs a skin`);
  const joints = Math.max(...(gltf.skins || []).map(({ joints = [] }) => joints.length));
  assert.ok(joints >= 18 && joints <= 96, `${spec.label} bone count ${joints} is outside 18..96`);
  const clips = new Set((gltf.animations || []).map(({ name }) => name));
  spec.clips.forEach((clip) => assert.ok(clips.has(clip), `${spec.label} is missing ${clip}`));
  const normalizedNodeNames = new Set((gltf.nodes || []).map(({ name = '' }) => (
    String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
  )));
  spec.requiredNodes.forEach((alternatives) => {
    assert.ok(
      alternatives.some((name) => normalizedNodeNames.has(name.toLowerCase().replace(/[^a-z0-9]/g, ''))),
      `${spec.label} is missing required node ${alternatives.join(' or ')}`,
    );
  });
  const jointNodes = new Set((gltf.skins || []).flatMap(({ joints = [] }) => joints));
  for (const animation of gltf.animations || []) {
    for (const channel of animation.channels || []) {
      assert.ok(
        jointNodes.has(channel.target?.node),
        `${spec.label} ${animation.name} animates a non-joint model root`,
      );
    }
  }
  const bounds = geometryBounds(gltf);
  assert.ok(Math.abs(bounds.minima[1]) <= 0.025, `${spec.label} feet are not at ground: ${bounds.minima[1]}`);
  assert.ok(Math.abs(bounds.height - spec.height) <= 0.1, `${spec.label} height ${bounds.height}m misses ${spec.height}m`);
  assert.equal((gltf.cameras || []).length, 0, `${spec.label} must not ship cameras`);
  assert.equal(gltf.extensions?.KHR_lights_punctual?.lights?.length || 0, 0, `${spec.label} must not ship lights`);
  const meshNodes = (gltf.nodes || []).filter((node) => Number.isInteger(node.mesh)).length;
  const drawCalls = (gltf.nodes || []).reduce((count, node) => (
    count + (Number.isInteger(node.mesh) ? (gltf.meshes?.[node.mesh]?.primitives?.length || 0) : 0)
  ), 0);
  assert.ok(meshNodes <= 36, `${spec.label} exports ${meshNodes} mesh nodes; browser budget is 36`);
  assert.ok(drawCalls <= 48, `${spec.label} exports ${drawCalls} draw calls; browser budget is 48`);
  return {
    asset: spec.label,
    triangles,
    joints,
    meshNodes,
    drawCalls,
    blendedWeightRatio: Number(blendedWeightRatio.toFixed(3)),
    connectedSurfaceRatio: Number(topology.connectedRatio.toFixed(3)),
    maximumTriangleEdge: Number(topology.maximumEdge.toFixed(3)),
    sizeMiB: Number((bytes.length / 1024 / 1024).toFixed(2)),
    height: Number(bounds.height.toFixed(3)),
    textures: Object.keys(maps),
  };
}

const argumentsList = process.argv.slice(2);
const candidateMode = argumentsList.includes('--candidate');
const onlyArgument = argumentsList.find((argument) => argument.startsWith('--only='));
const unknownArguments = argumentsList.filter((argument) => (
  argument !== '--candidate' && argument !== onlyArgument
));
assert.deepEqual(unknownArguments, [], `unknown arguments: ${unknownArguments.join(', ')}`);
const selectedAssets = onlyArgument
  ? ASSETS.filter((spec) => spec.label.toLowerCase().includes(onlyArgument.slice('--only='.length).toLowerCase()))
  : ASSETS;
assert.ok(selectedAssets.length > 0, `${onlyArgument} did not match a character asset`);
const reports = selectedAssets.map((spec) => validateAsset({
  ...spec,
  path: candidateMode ? spec.candidatePath : spec.path,
}));
console.log(JSON.stringify(reports, null, 2));
