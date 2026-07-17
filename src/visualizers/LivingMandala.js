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
      uniform float uPeakHz1;
      uniform float uPeakHz2;
      uniform float uPeakStrength2;
      uniform float uSpread;
      uniform float uTonality;
      uniform float uSectionIntensity;
      uniform float uSectionNovelty;
      uniform float uTrance;
      uniform float uCosmic;
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

      vec2 foldMandala(vec2 p, float segments) {
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float wedge = TAU / segments;
        angle = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
        return vec2(cos(angle), sin(angle)) * radius;
      }

      vec3 spectralPalette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67) + uJourney * 0.03));
      }

      void main() {
        vec2 screen = vUv * 2.0 - 1.0;
        vec2 p = screen;
        p.x *= uAspect;
        p = rotate2d(uJourney * 0.18 + uTime * 0.018) * p;
        float radius = length(p);
        float angle = atan(p.y, p.x);

        float frequencyA = clamp(log(max(55.0, uPeakHz1) / 55.0) / log(5000.0 / 55.0), 0.0, 1.0);
        float frequencyB = clamp(log(max(55.0, uPeakHz2) / 55.0) / log(5000.0 / 55.0), 0.0, 1.0);
        float segmentPosition = 3.0 + frequencyA * 7.0 + frequencyB * uPeakStrength2 * 1.5;
        float segmentBase = floor(segmentPosition);
        float segmentBlend = smoothstep(0.08, 0.92, fract(segmentPosition));
        vec2 foldedA = foldMandala(p, segmentBase);
        vec2 foldedB = foldMandala(p, segmentBase + 1.0);
        vec2 folded = mix(foldedA, foldedB, segmentBlend);
        float segments = mix(segmentBase, segmentBase + 1.0, segmentBlend);
        float symmetry = 0.58 + uTrance * 0.24 + uTonality * 0.14 + uSpectralMid * 0.04;
        vec2 q = mix(p, folded, symmetry);

        float breath = sin(radius * (12.0 + uSpectralLow * 10.0)
          - uTime * (0.08 + uBass * mix(0.08, 0.42, uEnergy)))
          * (0.008 + uSpectralLow * mix(0.012, 0.045, uEnergy));
        q *= 1.0 + breath;
        vec2 flow = vec2(
          fbm(q * (2.0 + uMid) + vec2(uTime * 0.11, uJourney)),
          fbm(q * (2.3 + uTreble) - vec2(uJourney, uTime * 0.09))
        ) - 0.5;
        float morphActivity = 0.08 + uLevelSlow * 0.16 + uRelativeLevel * 0.22
          + uFlux * 0.12 + uSectionNovelty * 0.08;
        q += flow * mix(0.07, morphActivity, uEnergy);

        float cellA = fbm(q * (3.2 + uSpectralHigh * 2.8) + flow * 1.4);
        float cellB = fbm(rotate2d(1.57) * q * 3.8 - flow * 1.2);
        float reaction = abs(cellA - cellB);
        float definition = 3.2 + uRelativeLevel * 2.4 + uTonality * 1.2;
        float membrane = pow(1.0 - abs(sin((reaction + radius * 0.22)
          * (12.0 + frequencyA * 10.0 + uSpectralMid * 5.0))), definition);
        float tunnel = pow(0.5 + 0.5 * cos(angle * segments
          + radius * (11.0 + frequencyB * 8.0 + uTrance * 3.0) - uTime * 0.12), 5.0);
        float radialWeave = pow(0.5 + 0.5 * cos(
          angle * segments * 2.0
          + radius * (8.0 + frequencyA * 9.0)
          + (cellA - cellB) * 3.5
          - uTime * 0.08
        ), 6.0);

        vec3 earthBase = vec3(0.002, 0.003, 0.002);
        vec3 earthGlow = mix(vec3(0.92, 0.16, 0.035), vec3(2.1, 0.82, 0.12), cellA);
        earthGlow = mix(earthGlow, vec3(0.08, 1.45, 0.42), cellB * 0.56);
        vec3 cosmic = spectralPalette(cellA + cellB * 0.42 + radius * 0.16);
        vec3 glow = mix(earthGlow, cosmic, uCosmic);
        float gate = 0.46 + uPresence * 0.16 + uRelativeLevel * 0.58
          + uSectionIntensity * 0.1;
        vec3 color = earthBase;
        color += glow * membrane * gate * (0.92 + uLevelSlow * 0.48 + uTrance * 0.25);
        color += glow * pow(membrane, 0.28) * gate * (0.36 + uLevelSlow * 0.12);
        color += mix(vec3(0.2, 0.5, 0.12), cosmic, uCosmic)
          * tunnel * gate * (0.065 + uSpectralHigh * 0.22 + uPeakStrength2 * 0.09);
        color += mix(vec3(0.62, 0.18, 0.025), cosmic, uCosmic)
          * radialWeave * gate * (0.16 + uTonality * 0.12 + uRelativeLevel * 0.14);
        float innerPresence = exp(-radius * (2.8 + frequencyA * 1.7));
        color += mix(vec3(0.42, 0.12, 0.025), cosmic, uCosmic)
          * innerPresence * membrane * (0.035 + uLevelFast * 0.11);
        float dormantStructure = pow(max(membrane, radialWeave), 0.18);
        color += mix(vec3(0.34, 0.09, 0.016), cosmic * 0.28, uCosmic)
          * dormantStructure * (0.78 + uRelativeLevel * 0.55);
        color *= 2.35 + uRelativeLevel * 0.45;
        color *= smoothstep(1.45, 0.18, length(screen));
        color += (hash21(gl_FragCoord.xy + uTime * 19.0) - 0.5) * 0.008 * gate;
        gl_FragColor = vec4(color, uOpacity * luminousLayerCoverage(color, vUv));
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  return { material, uniforms, geometry: new THREE.PlaneGeometry(1, 1) };
}
