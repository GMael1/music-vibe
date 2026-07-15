import * as THREE from 'three';
import {
  createJourneyUniforms,
  LAYER_MASK_GLSL,
  LAYER_MASK_UNIFORMS,
} from './JourneyUniforms.js';

function createParticleGeometry() {
  const particleCount = 46000;
  const seeds = new Float32Array(particleCount * 3);
  let state = 0x934b21;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3;
    seeds[offset] = random();
    seeds[offset + 1] = random();
    seeds[offset + 2] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  return geometry;
}

export function getRitualCurrentMaterial() {
  const uniforms = createJourneyUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uJourney;
      uniform float uBass;
      uniform float uLowMid;
      uniform float uMid;
      uniform float uSpectralLow;
      uniform float uSpectralMid;
      uniform float uSpectralHigh;
      uniform float uLevel;
      uniform float uFlux;
      uniform float uOnset;
      uniform float uTrance;
      uniform float uCosmic;
      uniform float uOpacity;
      uniform float uPixelRatio;
      uniform float uAspect;
      ${LAYER_MASK_UNIFORMS}
      varying vec3 vColor;
      varying float vAlpha;

      const float TAU = 6.28318530718;

      ${LAYER_MASK_GLSL}

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      vec3 cosmicPalette(float t) {
        vec3 a = vec3(0.5);
        vec3 b = vec3(0.5);
        vec3 c = vec3(1.0);
        vec3 d = vec3(0.04, 0.35, 0.68) + uJourney * vec3(0.02, 0.04, 0.07);
        return a + b * cos(TAU * (c * t + d));
      }

      void main() {
        float along = position.x;
        float laneValue = position.y * 11.0;
        float lane = floor(laneValue);
        float dust = fract(laneValue);
        float seed = position.z;
        float lanePhase = lane * 1.713 + hash11(lane) * TAU;
        float slowTime = uTime * (0.08 + uEnergy * 0.4 + uFlux * 0.12 * uEnergy);

        float turns = 1.2 + mod(lane, 4.0) * 0.42 + uMid * 0.5;
        float angle = along * TAU * turns + lanePhase + slowTime;
        float baseRadius = 0.055 + lane * 0.036 + dust * 0.07;
        float breathing = sin(along * TAU * 2.0 + lanePhase - slowTime * 1.7)
          * (0.012 + uSpectralLow * 0.035);
        float radius = baseRadius + breathing;

        vec2 spiral = vec2(cos(angle), sin(angle)) * radius;
        spiral.x += sin(along * TAU * 1.7 + lanePhase + uJourney * 2.0)
          * (0.055 + uLowMid * 0.08);
        spiral.y += cos(along * TAU * 1.35 - lanePhase * 0.4 - slowTime)
          * (0.04 + uBass * 0.055);

        float fold = sin(angle * (2.0 + floor(uSpectralMid * 3.0)) + uJourney) * 0.5 + 0.5;
        vec2 mandala = vec2(cos(angle), sin(angle))
          * (0.11 + fold * (0.25 + uTrance * 0.09));
        float formation = smoothstep(0.08, 0.72, uSpectralMid + uLevel * 0.45);
        vec2 current = mix(spiral, mandala,
          formation * mix(0.08, 0.67, uEnergy));

        float pressure = exp(-abs(fract(along - uJourney * 0.07) - 0.5) * 12.0)
          * uOnset * mix(0.08, 1.0, uEnergy);
        current += normalize(current + vec2(0.0001)) * pressure * 0.035;
        current += vec2(
          sin(seed * 91.0 + slowTime * 2.0),
          cos(seed * 73.0 - slowTime * 1.6)
        ) * (0.002 + uSpectralHigh * 0.009);

        vec3 transformed = vec3(current, (seed - 0.5) * 0.08);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        gl_PointSize = uPixelRatio * (0.72 + seed * 1.35
          + uSpectralHigh * 1.35 + pressure * 1.6);

        vec3 earth = mix(vec3(0.15, 0.035, 0.012), vec3(1.2, 0.48, 0.08), dust);
        earth = mix(earth, vec3(0.08, 0.5, 0.19), hash11(lane + 2.0) * 0.5);
        vec3 cosmic = cosmicPalette(seed + along * 0.42 + lane * 0.07);
        vColor = mix(earth, cosmic, uCosmic);
        float gate = smoothstep(0.006, 0.19, uLevel);
        vec2 layerUv = current + 0.5;
        vAlpha = gate * uOpacity * softLayerMask(layerUv)
          * (0.18 + dust * 0.42 + uSpectralHigh * 0.34);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceToCenter = length(point);
        float core = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
        float halo = exp(-distanceToCenter * 7.0) * 0.45;
        gl_FragColor = vec4(vColor * (core + halo), vAlpha * (core + halo));
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { material, uniforms, geometry: createParticleGeometry(), objectType: 'points' };
}
