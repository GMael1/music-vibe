export function createJourneyUniforms() {
  return {
    uTime: { value: 0 },
    uJourney: { value: 0 },
    uSub: { value: 0 },
    uBass: { value: 0 },
    uLowMid: { value: 0 },
    uMid: { value: 0 },
    uHighMid: { value: 0 },
    uTreble: { value: 0 },
    uSpectralLow: { value: 0 },
    uSpectralMid: { value: 0 },
    uSpectralHigh: { value: 0 },
    uLevel: { value: 0 },
    uBeat: { value: 0 },
    uOnset: { value: 0 },
    uFlux: { value: 0 },
    uCentroid: { value: 0.5 },
    uPitch: { value: 0.5 },
    uSpread: { value: 0 },
    uTrance: { value: 0.5 },
    uCosmic: { value: 0.2 },
    uOpacity: { value: 1 },
    uAspect: { value: 16 / 9 },
    uPixelRatio: { value: 1 },
  };
}

export const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
