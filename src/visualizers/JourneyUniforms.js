import * as THREE from 'three';

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
    uRelativeLevel: { value: 0 },
    uLevelFast: { value: 0 },
    uLevelSlow: { value: 0 },
    uPresence: { value: 0 },
    uBeat: { value: 0 },
    uBeatPhase: { value: 0 },
    uBeatPulse: { value: 0 },
    uTempoBpm: { value: 0 },
    uMorphPhase: { value: 0 },
    uFrequencyShape: { value: 0.35 },
    uFormBlend: { value: 0.42 },
    uMotionEnergy: { value: 0.16 },
    uShapeShift: { value: 0.25 },
    uShapePhase: { value: 0 },
    uMusicDrive: { value: 0.18 },
    uFrequencyMotion: { value: 0 },
    uPulseEnvelope: { value: 0 },
    uSymmetryBase: { value: 6 },
    uOnset: { value: 0 },
    uFlux: { value: 0 },
    uCentroid: { value: 0.5 },
    uPitch: { value: 0.5 },
    uAbsolutePitch: { value: 0.3 },
    uDominantHz: { value: 110 },
    uPeakHz1: { value: 110 },
    uPeakHz2: { value: 220 },
    uPeakStrength1: { value: 0.5 },
    uPeakStrength2: { value: 0 },
    uSpread: { value: 0 },
    uTonality: { value: 0.5 },
    uTrance: { value: 0.5 },
    uCalm: { value: 0.5 },
    uEnergy: { value: 0.5 },
    uCosmic: { value: 0.2 },
    uLight: { value: 0.62 },
    uOpacity: { value: 1 },
    uAspect: { value: 16 / 9 },
    uPixelRatio: { value: 1 },
    uLayerAnchor: { value: new THREE.Vector2(0.5, 0.5) },
    uLayerRadius: { value: 10 },
    uLayerFeather: { value: 0.2 },
    uBlendSeed: { value: 0 },
    uBlueprintPhase: { value: 0 },
    uDefinitionBias: { value: 0.65 },
    uDynamicGain: { value: 0.7 },
    uSectionIntensity: { value: 0.35 },
    uSectionNovelty: { value: 0 },
  };
}

export const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const LAYER_MASK_UNIFORMS = `
  uniform float uCalm;
  uniform float uEnergy;
  uniform vec2 uLayerAnchor;
  uniform float uLayerRadius;
  uniform float uLayerFeather;
  uniform float uBlendSeed;
`;

export const LAYER_MASK_GLSL = `
  float layerHash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 37.17);
    return fract(p.x * p.y);
  }

  float layerNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(layerHash21(i), layerHash21(i + vec2(1.0, 0.0)), f.x),
      mix(layerHash21(i + vec2(0.0, 1.0)), layerHash21(i + 1.0), f.x), f.y);
  }

  float softLayerMask(vec2 uv) {
    if (uLayerRadius > 4.0) return 1.0;
    vec2 point = uv - uLayerAnchor;
    point.x *= uAspect;
    float drift = uTime * (0.012 + uEnergy * 0.038);
    vec2 noiseUv = uv * (2.25 + uBlendSeed * 0.17)
      + vec2(drift, -drift * 0.73) + uBlendSeed * vec2(1.91, 3.17);
    float broadNoise = layerNoise(noiseUv)
      + layerNoise(noiseUv * 1.91 - 4.7) * 0.45;
    float boundaryWarp = (broadNoise - 0.72) * uLayerFeather
      * mix(0.22, 0.42, uEnergy);
    float distanceToAnchor = length(point);
    return 1.0 - smoothstep(
      uLayerRadius - uLayerFeather + boundaryWarp,
      uLayerRadius + boundaryWarp,
      distanceToAnchor
    );
  }

  float luminousLayerCoverage(vec3 color, vec2 uv) {
    float luminance = dot(max(color, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
    float luminousCoverage = smoothstep(0.006, 0.24, luminance);
    return softLayerMask(uv) * mix(0.34, 1.0, luminousCoverage);
  }
`;
