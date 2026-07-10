import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLevelsFromDisk } from './levels/node-catalog.js';
import { RENDER_LIGHTING, resolveRenderLighting } from './render-lighting.js';

test('every level resolves to readable physical lighting on desktop and mobile', async () => {
  const levels = await loadLevelsFromDisk();
  assert.ok(levels.length >= 6);

  for (const level of levels) {
    const desktop = resolveRenderLighting(level);
    const mobile = resolveRenderLighting(level, { mobile: true });
    for (const profile of [desktop, mobile]) {
      for (const value of Object.values(profile)) {
        assert.ok(Number.isFinite(value) && value > 0, `${level.id} has invalid resolved lighting`);
      }
      assert.ok(profile.exposure >= RENDER_LIGHTING.minimumExposure);
      assert.ok(profile.fixtureIntensity >= 70, `${level.id} fixture is too dim`);
      assert.ok(profile.flashlightIntensity >= 200, `${level.id} flashlight is too dim`);
    }

    assert.ok(desktop.fogDensity < level.fog.density.desktop);
    assert.ok(mobile.fogDensity < level.fog.density.mobile);
    assert.ok(mobile.hemisphereIntensity >= desktop.hemisphereIntensity);
    assert.ok(mobile.ambientIntensity >= desktop.ambientIntensity);
  }
});

test('calibration preserves each level profile instead of flattening the campaign', async () => {
  const levels = await loadLevelsFromDisk();
  const resolved = levels.map((level) => resolveRenderLighting(level));
  assert.ok(new Set(resolved.map((profile) => profile.fixtureIntensity)).size > 3);
  assert.ok(new Set(resolved.map((profile) => profile.flashlightIntensity)).size > 3);
  assert.ok(new Set(resolved.map((profile) => profile.fogDensity)).size > 3);
});
