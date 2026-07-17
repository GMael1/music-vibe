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
    uFamilyC: { value: 0 },
    uFamilyD: { value: 0 },
    uModeCX: { value: 3 },
    uModeCY: { value: 5 },
    uModeDX: { value: 3 },
    uModeDY: { value: 5 },
    uRotationA: { value: 0 },
    uRotationB: { value: 0 },
    uSeedA: { value: 0 },
    uSeedB: { value: 0 },
    uRotationC: { value: 0 },
    uRotationD: { value: 0 },
    uSeedC: { value: 0 },
    uSeedD: { value: 0 },
    uFamilyMix: { value: 0 },
    uModeWeights: { value: new THREE.Vector4(1, 0, 0, 0) },
    uModeInstability: { value: 0 },
    uSandTexture: { value: null },
    uSandReady: { value: 0 },
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
    uniform float uFamilyC;
    uniform float uFamilyD;
    uniform float uModeCX;
    uniform float uModeCY;
    uniform float uModeDX;
    uniform float uModeDY;
    uniform float uRotationA;
    uniform float uRotationB;
    uniform float uSeedA;
    uniform float uSeedB;
    uniform float uRotationC;
    uniform float uRotationD;
    uniform float uSeedC;
    uniform float uSeedD;
    uniform float uFamilyMix;
    uniform vec4 uModeWeights;
    uniform float uModeInstability;
    uniform sampler2D uSandTexture;
    uniform float uSandReady;
    uniform float uPixelRatio;
    uniform float uBlueprintPhase;
    uniform float uDefinitionBias;
    uniform float uDynamicGain;
    uniform float uLight;
    uniform float uCosmic;
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
      float flow = 0.0015 + uModeInstability * (0.003 + acousticMotion * 0.004)
        + uFlux * 0.0025 * mix(0.2, 1.0, uEnergy);
      vec2 curl = vec2(
        noise(p * (2.0 + uSpectralMid * 0.35) + vec2(uTime * 0.09, 1.7)),
        noise(p * (2.35 + uSpectralHigh * 0.4) - vec2(3.1, uTime * 0.075))
      ) - 0.5;
      return p + curl * flow;
    }

    float sandDensity(vec2 warpedP) {
      float fieldA = resonanceField(warpedP, uFamilyA, uModeAX, uModeAY, uRotationA, uSeedA);
      float fieldB = resonanceField(warpedP, uFamilyB, uModeBX, uModeBY, uRotationB, uSeedB);
      float fieldC = resonanceField(warpedP, uFamilyC, uModeCX, uModeCY, uRotationC, uSeedC);
      float fieldD = resonanceField(warpedP, uFamilyD, uModeDX, uModeDY, uRotationD, uSeedD);
      float definition = mix(4.2, 12.5, clamp(
        uDefinitionBias * 0.38 + uRelativeLevel * 0.42 + uTonality * 0.16
          + uSectionIntensity * 0.12,
        0.0,
        1.0
      ));
      float densityA = exp(-abs(fieldA) * definition);
      float densityB = exp(-abs(fieldB) * definition);
      float densityC = exp(-abs(fieldC) * definition);
      float densityD = exp(-abs(fieldD) * definition);
      return clamp(dot(vec4(densityA, densityB, densityC, densityD), uModeWeights), 0.0, 1.0);
    }

    void main() {
      vec2 plateUv = vUv * 2.0 - 1.0;
      vec2 p = plateUv;
      p.x *= uAspect;
      p *= 0.77;
      p = rotate2d((uBlueprintPhase - 0.5) * 0.18) * p;

      vec2 warpedP = fluidWarp(p);
      float proceduralDensity = sandDensity(warpedP);
      vec4 persistentState = texture2D(uSandTexture, vUv);
      float persistentDensity = persistentState.r;
      float density = mix(proceduralDensity, persistentDensity, uSandReady);
      density = pow(clamp(density, 0.0, 1.0), mix(0.72, 0.5, uLight));
      vec2 sandVelocity = (persistentState.gb - 0.5) * 2.0;
      float grainMotion = clamp(length(sandVelocity) * 24.0, 0.0, 1.0) * uSandReady;
      vec2 textureStep = vec2(1.0 / 720.0, 1.0 / 420.0);
      float densityX = mix(
        sandDensity(warpedP + vec2(0.0035, 0.0)),
        texture2D(uSandTexture, vUv + vec2(textureStep.x, 0.0)).r,
        uSandReady
      );
      float densityY = mix(
        sandDensity(warpedP + vec2(0.0, 0.0035)),
        texture2D(uSandTexture, vUv + vec2(0.0, textureStep.y)).r,
        uSandReady
      );
      vec3 normal = normalize(vec3((density - densityX) * 3.4, (density - densityY) * 3.4, 0.075));
      vec2 gradient = normalize(vec2(density - densityX, density - densityY) + vec2(0.00001));
      vec2 tangent = vec2(-gradient.y, gradient.x);
      float body = smoothstep(0.008, 0.42, density);
      float ridge = smoothstep(0.075, 0.58, density);
      float liquidTexture = noise(
        gl_FragCoord.xy / max(8.0, uPixelRatio * 13.0)
          + tangent * 2.4 + sandVelocity * 28.0 + uTime * 0.025
      );
      float surface = body * (0.975 + liquidTexture * 0.025);

      vec3 lightDirection = normalize(vec3(-0.55, 0.65, 0.95));
      vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float specular = pow(max(dot(normal, halfVector), 0.0), mix(42.0, 92.0, uLight));
      float edgeGlint = pow(1.0 - max(normal.z, 0.0), 2.2);

      vec3 bronze = mix(vec3(0.085, 0.018, 0.004), vec3(1.35, 0.48, 0.075), diffuse);
      vec3 mineral = mix(vec3(0.045, 0.07, 0.075), vec3(0.78, 1.08, 1.0), diffuse);
      vec3 cosmic = 0.48 + 0.52 * cos(6.2831853 * (
        density * 0.72 + liquidTexture * 0.018 + uJourney * 0.025
          + vec3(0.02, 0.35, 0.68)
      ));
      float earthToMineral = smoothstep(0.22, 0.72, uCosmic);
      float mineralToCosmic = smoothstep(0.52, 0.96, uCosmic);
      vec3 sandColor = mix(bronze, mineral, earthToMineral);
      sandColor = mix(sandColor, cosmic, mineralToCosmic);
      sandColor = hueShift(sandColor, uHue * 0.24);

      float lightGain = mix(0.68, 2.05, uLight);
      vec3 color = mix(vec3(0.001, 0.0015, 0.0025), sandColor * 0.035, body);
      color += sandColor * surface * (0.34 + diffuse * 1.02) * lightGain;
      color += mix(vec3(1.0, 0.7, 0.32), cosmic, mineralToCosmic)
        * specular * ridge * (0.22 + uLight * 0.58);
      color += mix(vec3(0.32, 0.12, 0.02), cosmic, uCosmic)
        * edgeGlint * ridge * (0.035 + uSpectralHigh * 0.09);
      color += mix(vec3(0.92, 0.32, 0.055), cosmic, uCosmic)
        * grainMotion * surface * (0.05 + uRelativeLevel * 0.16);
      float dormantGlow = 0.18 + uLight * 0.28 + uPresence * 0.05 + uLevelSlow * 0.08;
      color += sandColor * body * dormantGlow;

      float vignette = smoothstep(1.25, 0.32, length(plateUv));
      color *= 0.86 + vignette * 0.26;
      float luminance = dot(max(color, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
      float readableAlpha = softLayerMask(vUv) * mix(0.68, 1.0, smoothstep(0.01, 0.22, luminance));
      gl_FragColor = vec4(color, uOpacity * readableAlpha);
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
