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
      uniform float uFlux;
      uniform float uOnset;
      uniform float uPitch;
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

        float segments = 3.0 + floor(uPitch * mix(1.5, 4.0, uEnergy)
          + uEnergy * 3.0);
        vec2 folded = foldMandala(p, segments);
        float symmetry = 0.3 + uTrance * 0.58 + uSpectralMid * 0.12;
        vec2 q = mix(p, folded, symmetry);

        float breath = sin(radius * (12.0 + uSpectralLow * 10.0)
          - uTime * (0.12 + uBass * mix(0.12, 1.0, uEnergy)))
          * (0.014 + uSpectralLow * mix(0.018, 0.07, uEnergy));
        q *= 1.0 + breath;
        vec2 flow = vec2(
          fbm(q * (2.0 + uMid) + vec2(uTime * 0.11, uJourney)),
          fbm(q * (2.3 + uTreble) - vec2(uJourney, uTime * 0.09))
        ) - 0.5;
        q += flow * mix(0.09, 0.46 + uFlux * 0.45, uEnergy);

        float cellA = fbm(q * (3.2 + uSpectralHigh * 2.8) + flow * 1.4);
        float cellB = fbm(rotate2d(1.57) * q * 3.8 - flow * 1.2);
        float reaction = abs(cellA - cellB);
        float membrane = pow(1.0 - abs(sin((reaction + radius * 0.22)
          * (14.0 + uSpectralMid * 13.0))), 5.0);
        float tunnel = pow(0.5 + 0.5 * cos(angle * segments
          + radius * (13.0 + uTrance * 8.0) - uTime * 0.22), 7.0);
        float pulse = exp(-abs(radius - fract(uJourney * 0.12) * 1.25) * 24.0)
          * uOnset * mix(0.08, 1.0, uEnergy);

        vec3 earthBase = vec3(0.002, 0.003, 0.002);
        vec3 earthGlow = mix(vec3(0.55, 0.09, 0.018), vec3(1.35, 0.62, 0.08), cellA);
        earthGlow = mix(earthGlow, vec3(0.035, 0.82, 0.23), cellB * 0.56);
        vec3 cosmic = spectralPalette(cellA + cellB * 0.42 + radius * 0.16);
        vec3 glow = mix(earthGlow, cosmic, uCosmic);
        float gate = smoothstep(0.008, 0.17, uLevel);
        vec3 color = earthBase;
        color += glow * membrane * gate * (0.55 + uLevel * 0.9 + uTrance * 0.38);
        color += mix(vec3(0.2, 0.5, 0.12), cosmic, uCosmic)
          * tunnel * gate * (0.045 + uSpectralHigh * 0.28);
        color += mix(vec3(0.9, 0.33, 0.05), vec3(1.0), uCosmic)
          * pulse * gate * 0.32;
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
