# Pale Entity production character

The Pale Entity is an original 2.45 m liminal-horror humanoid: starved torso,
long limbs, neutral pelvis, sightless sockets, a narrow vertical maw, and subtle
left/right asymmetry. General human anatomy and non-IP-specific horror lighting
set the reference direction; no franchise creature was copied.

## Finished asset contract

The visible body is one continuous, UV-authored MakeHuman hm08 anatomical
surface reshaped in Blender. The final body is **not** a joined primitive
mannequin: it contains no visible sphere, capsule, cylinder, cone, cube, or
overlapping static body-part mesh. The old procedural rig is now an invisible
gameplay proxy only; it is never exposed as a loading or error fallback.

Production deliverables:

- `pale-entity.blend` — source mesh, 24-bone Blender rig, materials, weights,
  ten in-place actions, and preview stage
- `../exports/pale-entity-skeletal.fbx` — Unreal skeletal-mesh import
- `../exports/pale-entity-{walk,run,crouch,arm-bend}.fbx` — Unreal test clips
- `../../../public/models/monsters/pale-entity.glb` — browser runtime asset
- `textures/` — deterministic embedded 2K base color, normal, roughness, AO,
  and packed ORM maps
- `validation.json` — Blender/glTF topology, scale, rig, texture, and hash report
- `previews/` — Blender front, side, three-quarter, rear, and deformation
  preflight renders
- `../unreal/` — UE 5.7 project, imported `.uasset` files, seven Level
  Sequences, full PNG deformation sequences, and validation reports

Current measured runtime asset: 106,304 triangles, one welded connected body,
one mesh node, two material draws, 24 glTF joints, four or fewer influences,
89.9% blended exported vertices, 2.447 m height, embedded 2K PBR maps, and a
7.74 MiB decoder-free GLB.

## Legal foundation

The topology/UV foundation is MakeHuman Community hm08
`male_muscle_13290.obj`, explicitly released under Creative Commons CC0 1.0.
The exact upstream commit, source SHA-256, license SHA-256, named copyright
holders, and legal text are stored in `source/PROVENANCE.md` and
`source/CC0-1.0.txt`. THRESHOLD authors the creature proportions, surface
sculpt, neutral pelvis, face treatment, textures, rig, weights, animation, and
presentation.

## Rebuild and acceptance

From the repository root:

```bash
blender --background --factory-startup \
  --python scripts/blender/hd_pale_candidate.py -- --root .
node scripts/validate-character-fidelity.js --only=pale
bash art/characters/unreal/Automation/build_qa.sh
bash art/characters/unreal/Automation/render_all.sh
```

`build_qa.sh` imports a genuine Unreal `SkeletalMesh`, one `Skeleton`, and four
`AnimSequence` assets, then builds the front, side, three-quarter, Walk, Run,
Crouch, and ArmBend sequences. `render_all.sh` renders those sequences through
Unreal Movie Render Queue at 1024×1024 and validates every output frame.
