import * as THREE from 'three';
import {
  createJourneyUniforms,
  LAYER_MASK_GLSL,
  LAYER_MASK_UNIFORMS,
} from './JourneyUniforms.js';

export function getChladniMaterial() {
  const uniforms = {
    ...createJourneyUniforms(),
    uFamilyA: { value: 0 },
    uFamilyB: { value: 0 },
    uModeAX: { value: 3 },
    uModeAY: { value: 5 },
    uModeBX: { value: 3 },
    uModeBY: { value: 5 },
    uRotationA: { value: 0 },
    uRotationB: { value: 0 },
    uSeedA: { value: 0 },
    uSeedB: { value: 0 },
    uFamilyMix: { value: 0 },
    uModeInstability: { value: 0 },
  };
  uniforms.uOpacity.value = 0.94;

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
    uniform float uRelativeLevel;
    uniform float uLevelFast;
    uniform float uLevelSlow;
    uniform float uPresence;
    uniform float uBeat;
    uniform float uOnset;
    uniform float uFlux;
    uniform float uCentroid;
    uniform float uPitch;
    uniform float uAbsolutePitch;
    uniform float uSpread;
    uniform float uTonality;
    uniform float uFamilyA;
    uniform float uFamilyB;
    uniform float uModeAX;
    uniform float uModeAY;
    uniform float uModeBX;
    uniform float uModeBY;
    uniform float uRotationA;
    uniform float uRotationB;
    uniform float uSeedA;
    uniform float uSeedB;
    uniform float uFamilyMix;
    uniform float uModeInstability;
    uniform float uBlueprintPhase;
    uniform float uDefinitionBias;
    uniform float uDynamicGain;
    uniform float uSectionIntensity;
    uniform float uSectionNovelty;
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

    vec3 hueShift(vec3 color, float hue) {
      const vec3 axis = vec3(0.57735);
      return color * cos(hue) + cross(axis, color) * sin(hue)
        + axis * dot(axis, color) * (1.0 - cos(hue));
    }

    float rectangularField(vec2 p, float n, float m) {
      float x = p.x * 3.14159265;
      float y = p.y * 3.14159265;
      return cos(n * x) * cos(m * y) - cos(m * x) * cos(n * y);
    }

    float radialField(vec2 p, float n, float m, float seed) {
      float radius = length(p) * (1.0 + seed * 0.16);
      float angle = atan(p.y, p.x);
      float rings = sin(radius * 3.14159265 * (n * 0.72 + 1.4));
      float spokes = cos(angle * max(2.0, floor(m * 0.72)) + seed * 6.2831853);
      return rings * spokes;
    }

    float diagonalField(vec2 p, float n, float m, float seed) {
      vec2 q = rotate2d(0.785398 + (seed - 0.5) * 0.22) * p;
      float diagonalA = sin((q.x + q.y) * n * 2.4) * sin((q.x - q.y) * m * 2.4);
      float diagonalB = cos(q.x * m * 2.1) * cos(q.y * n * 2.1);
      return diagonalA - diagonalB * 0.62;
    }

    float coupledField(vec2 p, float n, float m, float seed) {
      float separation = 0.18 + seed * 0.28;
      vec2 offset = vec2(separation, (seed - 0.5) * 0.16);
      float sourceA = sin(length(p - offset) * 3.14159265 * (n + 1.2));
      float sourceB = sin(length(p + offset) * 3.14159265 * (m + 0.8));
      float bridge = sin(p.y * 3.14159265 * (n + m) * 0.5) * 0.34;
      return sourceA - sourceB + bridge;
    }

    float membraneField(vec2 p, float n, float m, float seed) {
      float angle = atan(p.y, p.x);
      float superRadius = pow(pow(abs(p.x), 2.6) + pow(abs(p.y), 2.6), 1.0 / 2.6);
      float breathingEdge = superRadius * (1.0 + sin(angle * max(2.0, floor(m * 0.55)) + seed * 6.2831853) * 0.16);
      float radial = sin(breathingEdge * 3.14159265 * (n * 0.65 + 1.8));
      float lobes = cos(angle * max(2.0, floor(m * 0.48)) + sin(superRadius * 5.0 + seed * 4.0));
      return radial + lobes * (0.48 + uSpread * 0.2);
    }

    float resonanceField(vec2 p, float family, float n, float m, float rotation, float seed) {
      vec2 q = rotate2d(rotation) * p;
      if (family < 0.5) return rectangularField(q, n, m);
      if (family < 1.5) return radialField(q, n, m, seed);
      if (family < 2.5) return diagonalField(q, n, m, seed);
      if (family < 3.5) return coupledField(q, n, m, seed);
      return membraneField(q, n, m, seed);
    }

    vec2 fluidWarp(vec2 p) {
      float acousticMotion = mix(uLevelSlow, uLevelFast, 0.62) * uDynamicGain;
      float hover = uModeInstability * (0.016 + acousticMotion * 0.035);
      float flow = 0.004 + hover + (uFlux * 0.035 + uSpread * 0.012)
        * mix(0.18, 1.0, uEnergy);
      vec2 curl = vec2(
        noise(p * (1.8 + uSpectralMid * 1.7) + vec2(uTime * 0.32, uJourney * 3.0)),
        noise(p * (2.1 + uSpectralHigh * 1.9) - vec2(uJourney * 2.0, uTime * 0.27))
      ) - 0.5;
      return p + curl * flow;
    }

    float sandDensity(vec2 warpedP) {
      float fieldA = resonanceField(warpedP, uFamilyA, uModeAX, uModeAY, uRotationA, uSeedA);
      float fieldB = resonanceField(warpedP, uFamilyB, uModeBX, uModeBY, uRotationB, uSeedB);
      float familyBlend = smoothstep(0.03, 0.97, uFamilyMix);
      float definition = mix(4.2, 12.5, clamp(
        uDefinitionBias * 0.38 + uRelativeLevel * 0.42 + uTonality * 0.16
          + uSectionIntensity * 0.12,
        0.0,
        1.0
      ));
      float densityA = exp(-abs(fieldA) * definition);
      float densityB = exp(-abs(fieldB) * definition);
      float coexistence = min(densityA, densityB) * uModeInstability * 0.42;
      return clamp(mix(densityA, densityB, familyBlend) + coexistence, 0.0, 1.0);
    }

    void main() {
      vec2 plateUv = vUv * 2.0 - 1.0;
      vec2 p = plateUv;
      p.x *= uAspect;
      p *= 0.77;
      p = rotate2d((uBlueprintPhase - 0.5) * 0.18) * p;

      vec2 warpedP = fluidWarp(p);
      float density = sandDensity(warpedP);
      float epsilon = 0.0035;
      float densityX = sandDensity(warpedP + vec2(epsilon, 0.0));
      float densityY = sandDensity(warpedP + vec2(0.0, epsilon));
      vec3 normal = normalize(vec3((density - densityX) * 2.8, (density - densityY) * 2.8, 0.055));
      vec2 gradient = normalize(vec2(density - densityX, density - densityY) + vec2(0.00001));
      vec2 tangent = vec2(-gradient.y, gradient.x);

      float migration = 0.08 + uRelativeLevel * 1.8 + uLevelFast * 0.72
        + uFlux * 1.2 + uModeInstability * 0.4 + uSectionNovelty * 0.36;
      float grainTravel = uTime * migration * mix(0.18, 1.0, uEnergy);
      vec2 grainGrid = floor(vUv * vec2(1900.0, 1080.0) + warpedP * 19.0 + tangent * grainTravel);
      float grainRandom = hash21(grainGrid);
      float grainThreshold = 0.8 - density * (0.48 + uRelativeLevel * 0.16);
      float individualGrains = smoothstep(grainThreshold, grainThreshold + 0.08, grainRandom);
      float fineDust = hash21(grainGrid * 0.53 + 71.7) * density;
      float sand = density * (0.2 + individualGrains * 0.92 + fineDust * 0.25);

      vec3 lightDirection = normalize(vec3(-0.55, 0.65, 0.95));
      vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float specular = pow(max(dot(normal, halfVector), 0.0), 70.0);
      float edgeGlint = pow(1.0 - max(normal.z, 0.0), 2.4);

      vec3 voidColor = vec3(0.0015, 0.002, 0.006);
      vec3 darkMetal = vec3(0.055, 0.07, 0.085);
      vec3 silver = vec3(0.68, 0.76, 0.78);
      vec3 alienCyan = vec3(0.16, 0.92, 0.82);
      vec3 ultraviolet = vec3(0.34, 0.08, 0.7);
      vec3 color = voidColor;
      color += darkMetal * density * (0.5 + diffuse * 0.8);
      color += silver * sand * (0.2 + diffuse * 0.72);
      color += alienCyan * specular * (0.28 + uSpectralHigh * 0.9);
      color += ultraviolet * edgeGlint * density * (0.12 + uSpectralMid * 0.4);
      color += alienCyan * individualGrains * uSpectralHigh * 0.3;
      color += silver * fineDust * (1.0 - uTonality) * 0.16;
      float dormantGlow = 0.08 + uPresence * 0.12 + uLevelSlow * 0.18;
      color += mix(silver, alienCyan, uBlueprintPhase) * density * dormantGlow;
      color = hueShift(color, uHue + uJourney * 0.08);

      float vignette = smoothstep(1.25, 0.32, length(plateUv));
      float outerGlow = exp(-abs(length(plateUv) - 0.83) * 12.0) * 0.04;
      color *= 0.64 + vignette * 0.48;
      color += alienCyan * outerGlow * (0.18 + uPresence * 0.3 + uRelativeLevel * 0.35);
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
    blending: THREE.NormalBlending,
  });

  return { material, uniforms, geometry: new THREE.PlaneGeometry(1, 1) };
}
