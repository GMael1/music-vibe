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

      vec2 mandalaDomain(vec2 p, float segments) {
        float radius = length(p);
        float angle = atan(p.y, p.x);
        return vec2(cos(angle * segments), sin(angle * segments)) * radius;
      }

      vec3 spectralPalette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67) + uJourney * 0.03));
      }

      void main() {
        vec2 screen = vUv * 2.0 - 1.0;
        vec2 p = screen;
        p.x *= uAspect;
        p = rotate2d(uJourney * 0.08 + uMorphPhase * 0.08) * p;
        float radius = length(p);
        float angle = atan(p.y, p.x);

        float frequencyShape = clamp(uFrequencyShape, 0.0, 1.0);
        float formBlend = clamp(uFormBlend, 0.0, 1.0);
        float segments = max(4.0, floor(uSymmetryBase + 0.5));
        vec2 folded = mandalaDomain(p, segments);
        float symmetry = 0.66 + uTrance * 0.2 + uTonality * 0.1 + uSpectralMid * 0.025;
        vec2 q = mix(p, folded, symmetry);

        float tempoWave = sin(TAU * uBeatPhase);
        float breath = sin(
          radius * (8.0 + frequencyShape * 8.0 + uSpectralLow * 3.0)
            - uMorphPhase * 0.9
        ) * (0.0025 + uSpectralLow * mix(0.002, 0.007, uEnergy))
          + tempoWave * uPulseEnvelope * 0.0035;
        vec2 radialDirection = p / max(radius, 0.001);
        q += radialDirection * breath;

        vec2 flowDomain = q * (1.7 + frequencyShape * 0.75);
        vec2 flow = vec2(
          fbm(flowDomain + vec2(uMorphPhase * 0.55, uJourney * 0.8)),
          fbm(rotate2d(0.73) * flowDomain + vec2(-uJourney * 0.7, uMorphPhase * 0.43))
        ) - 0.5;
        float warpStrength = 0.04 + uMotionEnergy * 0.2 + uLevelSlow * 0.052
          + uSectionIntensity * 0.028 + uSectionNovelty * 0.026;
        q += flow * warpStrength;
        vec2 qTwist = rotate2d(0.16 + sin(uMorphPhase * 0.18) * 0.05)
          * q * (1.07 + formBlend * 0.12) + flow * 0.42;

        float cellScale = 2.65 + frequencyShape * 2.55 + formBlend * 0.72
          + uSpectralHigh * 0.65 + uSectionNovelty * 0.38;
        float cellA = fbm(
          q * cellScale + flow * 1.45
            + vec2(uMorphPhase * 0.22, -uMorphPhase * 0.14)
        );
        float cellB = fbm(
          qTwist * (cellScale * 1.08) - flow * 1.05
            - vec2(uMorphPhase * 0.13, uMorphPhase * 0.19)
        );
        float cellC = fbm(
          rotate2d(1.57) * q * (3.35 + frequencyShape * 2.0)
            + vec2(-uMorphPhase * 0.18, uMorphPhase * 0.12)
        );
        float reaction = mix(abs(cellA - cellB), abs(cellB - cellC), formBlend);
        float definition = 3.15 + uLevelSlow * 0.64 + uTonality * 0.92;
        float ridge = 1.0 - abs(sin(
          (reaction + radius * (0.17 + formBlend * 0.1) + cellC * 0.055
            + uLevelSlow * 0.028 + uSectionIntensity * 0.016)
            * (11.0 + frequencyShape * 9.0 + uSpectralMid * 3.5)
            + uMorphPhase * 0.18
        ));
        float membrane = pow(
          smoothstep(0.18 - fwidth(ridge), 1.0, ridge),
          definition
        );
        float tunnel = pow(0.5 + 0.5 * cos(
          angle * segments
            + radius * (8.5 + frequencyShape * 10.0 + formBlend * 3.0)
            + (cellA - cellB) * 2.8
            - uMorphPhase * 0.55
        ), 5.0);
        float radialWeave = pow(0.5 + 0.5 * cos(
          angle * segments * 2.0
            + radius * (7.0 + frequencyShape * 9.0)
            + (cellC - cellA) * 3.1
            + uMorphPhase * 0.32
        ), 6.0);
        float halo = pow(smoothstep(0.38, 0.9, cellC), 2.2)
          * (0.5 + 0.5 * cos(radius * (9.0 + frequencyShape * 6.0) - uMorphPhase * 0.4));

        vec3 earthBase = vec3(0.002, 0.003, 0.002);
        vec3 earthGlow = mix(vec3(0.48, 0.075, 0.018), vec3(1.12, 0.38, 0.055), cellA);
        earthGlow = mix(earthGlow, vec3(0.035, 0.72, 0.19), cellB * 0.56);
        vec3 cosmic = spectralPalette(cellA + cellB * 0.34 + cellC * 0.12 + radius * 0.16);
        vec3 glow = mix(earthGlow, cosmic, uCosmic);
        float lightFloor = mix(0.24, 0.72, uLight);
        float gate = lightFloor + uPresence * 0.1 + uLevelSlow * 0.34
          + uSectionIntensity * 0.08 + uBeatPulse * 0.035;
        vec3 color = earthBase;
        color += glow * membrane * gate * (0.88 + uLevelSlow * 0.46 + uTrance * 0.22);
        color += glow * pow(membrane, 0.28) * gate * (0.36 + uLevelSlow * 0.12);
        color += mix(vec3(0.2, 0.5, 0.12), cosmic, uCosmic)
          * tunnel * gate * mix(0.055, 0.21, formBlend) * (0.8 + uSpectralHigh * 0.42);
        color += mix(vec3(0.62, 0.18, 0.025), cosmic, uCosmic)
          * radialWeave * gate * mix(0.2, 0.08, formBlend)
          * (0.76 + uTonality * 0.24 + uRelativeLevel * 0.18);
        color += mix(vec3(0.09, 0.32, 0.08), cosmic, uCosmic)
          * halo * gate * (0.025 + uSpectralMid * 0.085);
        float innerPresence = exp(-radius * (2.8 + frequencyShape * 1.7));
        color += mix(vec3(0.42, 0.12, 0.025), cosmic, uCosmic)
          * innerPresence * membrane * (0.035 + uLevelFast * 0.11);
        float dormantStructure = pow(max(membrane, radialWeave), 0.18);
        color += mix(vec3(0.13, 0.035, 0.008), cosmic * 0.12, uCosmic)
          * dormantStructure * (0.56 + uRelativeLevel * 0.48);
        color *= mix(0.78, 1.68, uLight) + uRelativeLevel * 0.28;
        color *= smoothstep(1.45, 0.18, length(screen));
        color += (hash21(gl_FragCoord.xy + uMorphPhase * 3.0) - 0.5) * 0.0025 * gate;
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
