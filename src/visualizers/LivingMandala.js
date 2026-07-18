import * as THREE from 'three';
import {
  createJourneyUniforms,
  FULLSCREEN_VERTEX_SHADER,
  LAYER_MASK_GLSL,
  LAYER_MASK_UNIFORMS,
} from './JourneyUniforms.js';

export function getLivingMandalaMaterial() {
  const uniforms = createJourneyUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader: `
      uniform float uTime;
      uniform float uJourney;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uSpectralLow;
      uniform float uSpectralMid;
      uniform float uSpectralHigh;
      uniform float uLevel;
      uniform float uRelativeLevel;
      uniform float uLevelFast;
      uniform float uLevelSlow;
      uniform float uPresence;
      uniform float uFlux;
      uniform float uBeatPhase;
      uniform float uBeatPulse;
      uniform float uMorphPhase;
      uniform float uFrequencyShape;
      uniform float uFormBlend;
      uniform float uMotionEnergy;
      uniform float uPulseEnvelope;
      uniform float uSymmetryBase;
      uniform float uPeakHz1;
      uniform float uPeakHz2;
      uniform float uPeakStrength2;
      uniform float uSpread;
      uniform float uTonality;
      uniform float uSectionIntensity;
      uniform float uSectionNovelty;
      uniform float uTrance;
      uniform float uCosmic;
      uniform float uLight;
      uniform float uOpacity;
      uniform float uAspect;
      ${LAYER_MASK_UNIFORMS}
      varying vec2 vUv;

      const float TAU = 6.28318530718;

      ${LAYER_MASK_GLSL}

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int index = 0; index < 5; index++) {
          value += noise(p) * amplitude;
          p = rotate2d(0.62) * p * 2.03 + 7.13;
          amplitude *= 0.5;
        }
        return value;
      }

      vec2 kaleidoscopeFold(vec2 p, float segments, float rotation) {
        float radius = length(p);
        float wedge = TAU / segments;
        float angle = mod(atan(p.y, p.x) + rotation + wedge * 0.5, wedge) - wedge * 0.5;
        angle = abs(angle);
        return vec2(cos(angle), sin(angle)) * radius;
      }

      float motifDistance(vec2 p, float size, float shapeMix, float petalMix) {
        float circle = abs(length(p) - size);
        float diamond = abs((abs(p.x) + abs(p.y)) * 0.70710678 - size);
        float petal = abs(length(p * vec2(0.72, 1.52)) - size);
        return mix(mix(circle, diamond, shapeMix), petal, petalMix);
      }

      float lensDistance(vec2 p, float size, float separation) {
        float a = length(p - vec2(separation, 0.0)) - size;
        float b = length(p + vec2(separation, 0.0)) - size;
        return abs(max(a, b));
      }

      vec3 spectralPalette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67) + uJourney * 0.03));
      }

      void main() {
        vec2 screen = vUv * 2.0 - 1.0;
        vec2 p = screen;
        p.x *= uAspect;
        p = rotate2d(uJourney * 0.055 + uMorphPhase * 0.19) * p;
        float radius = length(p);

        float frequencyShape = clamp(uFrequencyShape, 0.0, 1.0);
        float formBlend = clamp(uFormBlend, 0.0, 1.0);
        float segments = max(4.0, floor(uSymmetryBase + 0.5));
        vec2 q = kaleidoscopeFold(
          p,
          segments,
          uMorphPhase * 0.34 + uJourney * 0.08
        );

        vec2 organic = vec2(
          fbm(q * (2.1 + frequencyShape * 0.55) + vec2(uMorphPhase * 0.16, 3.4)),
          fbm(rotate2d(0.91) * q * 2.3 - vec2(5.2, uMorphPhase * 0.13))
        ) - 0.5;
        q += organic * (0.008 + uMotionEnergy * 0.025 + uFlux * 0.018);

        float breath = 1.0 + sin(TAU * uBeatPhase) * uPulseEnvelope * 0.025
          + uLevelSlow * 0.035;
        q *= breath;
        float drift = uMorphPhase * (0.46 + uMotionEnergy * 0.34);
        float shapeMix = smoothstep(0.18, 0.82, formBlend);
        float petalMix = smoothstep(0.38, 0.92, uSpectralHigh * 0.68 + uSpread * 0.32);

        vec2 anchorInner = vec2(
          0.22 + frequencyShape * 0.055 + sin(drift * 0.71) * 0.018,
          0.018 + sin(drift * 0.83 + 1.2) * 0.014
        );
        vec2 anchorMiddle = vec2(
          0.51 + frequencyShape * 0.11 + sin(drift * 0.47 + 2.1) * 0.032,
          0.075 + uSpectralMid * 0.055 + cos(drift * 0.64) * 0.022
        );
        vec2 anchorOuter = vec2(
          0.84 + frequencyShape * 0.17 + cos(drift * 0.39 + 0.7) * 0.045,
          0.13 + uSpectralHigh * 0.07 + sin(drift * 0.58 + 2.8) * 0.032
        );

        float innerSize = 0.075 + uSpectralLow * 0.026 + uLevelSlow * 0.012;
        float middleSize = 0.105 - frequencyShape * 0.018 + uSpectralMid * 0.018;
        float outerSize = 0.12 - frequencyShape * 0.028 + uSpectralHigh * 0.022;
        float dInner = motifDistance(q - anchorInner, innerSize, shapeMix, petalMix * 0.35);
        float dMiddle = motifDistance(
          rotate2d(0.28 + formBlend * 0.34) * (q - anchorMiddle),
          middleSize,
          1.0 - shapeMix,
          petalMix
        );
        float dOuter = lensDistance(
          rotate2d(-0.22 + frequencyShape * 0.3) * (q - anchorOuter),
          outerSize,
          0.035 + uSpectralHigh * 0.025
        );
        float ringA = abs(radius - (0.36 + frequencyShape * 0.08 + sin(drift * 0.42) * 0.018));
        float ringB = abs(radius - (0.7 + frequencyShape * 0.12 + cos(drift * 0.31) * 0.025));
        float spoke = abs(q.y - (0.017 + uSpectralMid * 0.018) * sin(
          q.x * (9.0 + frequencyShape * 5.0) - drift * 0.72
        ));
        float motifDistanceField = min(min(dInner, dMiddle), dOuter);
        float latticeDistance = min(min(ringA, ringB), spoke);
        float lineWidth = 0.008 + uLevelSlow * 0.006 + uLight * 0.0025;
        float aa = max(fwidth(motifDistanceField), 0.0012);
        float motifLine = 1.0 - smoothstep(lineWidth, lineWidth + aa * 1.8, motifDistanceField);
        float latticeLine = 1.0 - smoothstep(
          lineWidth * 0.45,
          lineWidth * 0.45 + fwidth(latticeDistance) * 1.8,
          latticeDistance
        );
        float motifAura = exp(-motifDistanceField * (27.0 - uLight * 7.0));
        float latticeAura = exp(-latticeDistance * 42.0);
        float centerGem = exp(-length(q) * (8.5 - uSpectralLow * 2.0));

        vec3 earthBase = vec3(0.002, 0.003, 0.002);
        vec3 earthGlow = mix(
          vec3(0.54, 0.065, 0.012),
          vec3(1.18, 0.42, 0.045),
          clamp(q.x * 0.82 + uSpectralMid * 0.28, 0.0, 1.0)
        );
        earthGlow = mix(earthGlow, vec3(0.035, 0.62, 0.17), uSpectralHigh * 0.46);
        vec3 cosmic = spectralPalette(q.x * 0.42 + q.y * 0.24 + formBlend * 0.18);
        vec3 glow = mix(earthGlow, cosmic, uCosmic);
        float gate = mix(0.3, 0.78, uLight) + uPresence * 0.08 + uLevelSlow * 0.28
          + uSectionIntensity * 0.06 + uBeatPulse * 0.025;
        vec3 color = earthBase;
        color += glow * motifLine * gate * (1.25 + uRelativeLevel * 0.62);
        color += glow * motifAura * gate * (0.28 + uLevelFast * 0.2);
        color += mix(vec3(0.18, 0.48, 0.1), cosmic, uCosmic)
          * latticeLine * gate * (0.22 + uTonality * 0.2);
        color += mix(vec3(0.5, 0.12, 0.015), cosmic, uCosmic)
          * latticeAura * gate * (0.065 + uSpectralMid * 0.08);
        color += mix(vec3(0.7, 0.19, 0.025), cosmic, uCosmic)
          * centerGem * (0.12 + uLevelSlow * 0.32 + uPulseEnvelope * 0.18);
        color += glow * pow(motifAura, 0.32) * (0.035 + uLight * 0.045);
        color *= mix(0.82, 1.62, uLight) + uRelativeLevel * 0.22;
        color *= smoothstep(1.45, 0.18, length(screen));
        gl_FragColor = vec4(color, uOpacity * luminousLayerCoverage(color, vUv));
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    extensions: { derivatives: true },
  });

  return { material, uniforms, geometry: new THREE.PlaneGeometry(1, 1) };
}
