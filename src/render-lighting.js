export const RENDER_LIGHTING = Object.freeze({
  fogDensityScale: 0.9,
  exposureScale: 1.25,
  minimumExposure: 0.95,
  hemisphereScale: 1.1,
  ambientScale: 1,
  fixtureCandelaScale: 1.2,
  flashlightCandelaScale: 5,
  localBounceScale: 4,
  cameraFlashScale: 4,
  panelEmissionScale: 1,
});

export function resolveRenderLighting(level, { mobile = false } = {}) {
  const mode = mobile ? 'mobile' : 'desktop';
  const flashlight = level.equipment?.flashlight || {};
  return Object.freeze({
    fogDensity: level.fog.density[mode] * RENDER_LIGHTING.fogDensityScale,
    exposure: Math.max(
      RENDER_LIGHTING.minimumExposure,
      level.lighting.exposure * RENDER_LIGHTING.exposureScale,
    ),
    hemisphereIntensity: level.lighting.hemisphere.intensity[mode]
      * RENDER_LIGHTING.hemisphereScale,
    ambientIntensity: level.lighting.ambient.intensity[mode]
      * RENDER_LIGHTING.ambientScale,
    fixtureIntensity: level.lighting.fixture.intensity
      * RENDER_LIGHTING.fixtureCandelaScale,
    flashlightIntensity: (flashlight.intensity ?? (mobile ? 38 : 52))
      * RENDER_LIGHTING.flashlightCandelaScale,
    flashlightBounceIntensity: 1.25 * RENDER_LIGHTING.localBounceScale,
    panelEmissionIntensity: 3.1 * RENDER_LIGHTING.panelEmissionScale,
  });
}
