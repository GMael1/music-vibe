import * as THREE from 'three';
import {
  createJourneyUniforms,
  LAYER_MASK_GLSL,
  LAYER_MASK_UNIFORMS,
} from './JourneyUniforms.js';

export function getPsychedelicMaterial() {
  const uniforms = createJourneyUniforms();

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uJourney;
    uniform float uSub;
    uniform float uBass;
    uniform float uLowMid;
    uniform float uMid;
    uniform float uHighMid;
    uniform float uTreble;
    uniform float uSpectralLow;
    uniform float uSpectralMid;
    uniform float uSpectralHigh;
    uniform float uLevel;
    uniform float uBeat;
    uniform float uOnset;
    uniform float uFlux;
    uniform float uCentroid;
    uniform float uPitch;
    uniform float uSpread;
    uniform float uHue;
    uniform float uOpacity;
    uniform float uAspect;
    ${LAYER_MASK_UNIFORMS}
    varying vec2 vUv;

    ${LAYER_MASK_GLSL}

    mat2 rotate2d(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
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
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = rotate2d(0.47 + uMid * 0.08) * p * (2.02 + uTreble * 0.12) + 19.1;
        amplitude *= 0.5;
      }
      return value;
    }

    vec2 kaleidoscope(vec2 p, float segments) {
      float radius = length(p);
      float angle = atan(p.y, p.x);
      float wedge = 6.2831853 / segments;
      angle = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
      return vec2(cos(angle), sin(angle)) * radius;
    }

    vec3 hueShift(vec3 color, float hue) {
      const vec3 axis = vec3(0.57735);
      return color * cos(hue) + cross(axis, color) * sin(hue)
        + axis * dot(axis, color) * (1.0 - cos(hue));
    }

    vec3 palette(float t, vec3 phase) {
      vec3 a = vec3(0.46, 0.48, 0.52);
      vec3 b = vec3(0.46, 0.5, 0.48);
      vec3 c = vec3(1.0, 0.82, 0.72);
      return a + b * cos(6.2831853 * (c * t + phase));
    }

    void main() {
      vec2 centered = vUv * 2.0 - 1.0;
      centered.x *= uAspect;
      float radius = length(centered);
      float bassLens = sin(radius * (7.0 + uSpectralLow * 9.0) - uTime * 1.8)
        * uSpectralLow * 0.075 * mix(0.22, 1.0, uEnergy);
      vec2 p = centered * (1.12 + bassLens);
      p = rotate2d(uJourney * 0.55 + uLowMid * 0.18) * p;

      float topology = 2.0 + clamp(uPitch * 5.2 + uCentroid * 2.0 + uSpectralHigh * 1.2, 0.0, 8.0);
      float topologyBase = floor(topology);
      float topologyBlend = smoothstep(0.12, 0.88, fract(topology));
      vec2 foldedA = kaleidoscope(p, topologyBase);
      vec2 foldedB = kaleidoscope(p, topologyBase + 1.0);
      vec2 folded = mix(foldedA, foldedB, topologyBlend);
      float structuralMix = clamp(uSpectralMid * 0.5 + uSpectralHigh * 0.28
        + uSpread * 0.2 + uFlux * 0.25, 0.08, 0.9)
        * mix(0.16, 1.0, uEnergy);
      p = mix(p, folded, structuralMix);

      float flowSpeed = 0.08 + uEnergy * 0.2
        + (uLevel * 0.72 + uSpectralHigh * 0.52) * mix(0.12, 1.0, uEnergy);
      vec2 q = vec2(
        fbm(p * (1.0 + uBass * 0.42) + vec2(uTime * flowSpeed, -uJourney * 3.0)),
        fbm(p + vec2(4.7, 2.1) - vec2(uJourney * 2.0, uTime * flowSpeed * 0.7))
      );
      vec2 r = vec2(
        fbm(p + q * (1.4 + uLowMid * 1.8) + vec2(1.8, 8.2) + uTime * 0.42),
        fbm(p + q * (1.25 + uMid * 1.5) + vec2(7.3, 2.8) - uTime * 0.31)
      );

      float turbulence = 0.72 + uEnergy * 0.28
        + (uFlux * 1.6 + uOnset * 0.75) * uEnergy;
      float fieldA = fbm(p + r * turbulence);
      float fieldB = fbm(rotate2d(1.57) * p - q * (0.8 + uTreble));
      float field = mix(fieldA, fieldB, clamp(uCentroid * 0.5 + uPitch * 0.28, 0.0, 0.88));
      float ridges = pow(1.0 - abs(sin((field + length(r) * 0.32) * (8.0 + uSpectralHigh * 14.0 + uSpread * 4.0))), 4.0);
      float impact = exp(-abs(radius - (0.18 + uBeat * 0.55))
        * (22.0 + uSpectralHigh * 14.0)) * uBeat * mix(0.12, 1.0, uEnergy);
      float granularDetail = noise(p * (8.0 + uSpectralHigh * 16.0) + uTime * 2.0) * uSpectralHigh;

      vec3 phase = vec3(
        0.62 + uJourney * 0.08 + uBass * 0.08,
        0.14 + uCentroid * 0.22,
        0.34 + uSpectralHigh * 0.16
      );
      vec3 color = palette(field * 1.45 + length(q) * 0.45 + uJourney, phase);
      vec3 ink = vec3(0.004, 0.006, 0.02);
      color = mix(ink, color, smoothstep(0.1, 0.82, field));
      color += vec3(0.05, 0.95, 0.88) * ridges * (0.12 + uSpectralHigh * 0.65);
      color += vec3(1.0, 0.12, 0.38) * uSpectralLow * smoothstep(0.35, 0.9, r.x) * 0.46;
      color += vec3(0.62, 0.35, 1.0) * impact * 0.55;
      color += vec3(0.34, 0.82, 1.0) * granularDetail * 0.13;
      color *= 0.62 + uLevel * 0.34 + smoothstep(1.35, 0.1, radius) * 0.42;
      color = hueShift(color, uHue);

      float grain = (hash21(gl_FragCoord.xy + uTime * 31.0) - 0.5)
        * mix(0.006, 0.028, uEnergy);
      color += grain;
      gl_FragColor = vec4(color, uOpacity * luminousLayerCoverage(color, vUv));
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  return { material, uniforms, geometry: new THREE.PlaneGeometry(1, 1) };
}
