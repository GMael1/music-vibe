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
      uniform float uShapeShift;
      uniform float uShapePhase;
      uniform float uMusicDrive;
      uniform float uFrequencyMotion;
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

      float crystalDistance(vec2 p, float size, float points, float depth, float phase) {
        float angle = atan(p.y, p.x);
        float crystalRadius = size * (1.0 + depth * cos(angle * points + phase));
        return abs(length(p) - crystalRadius);
      }

      float rosetteDistance(vec2 p, float size, float petals, float curl, float phase) {
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float rosetteRadius = size * (
          0.76 + 0.24 * cos(angle * petals + phase + radius * curl)
        );
        return abs(radius - rosetteRadius);
      }

      vec3 spectralPalette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67) + uJourney * 0.03));
      }

      void main() {
        vec2 screen = vUv * 2.0 - 1.0;
        vec2 p = screen;
        p.x *= uAspect;
        p *= 0.82;
        p = rotate2d(uJourney * 0.055 + uMorphPhase * 0.12) * p;
        float radius = length(p);

        float frequencyShape = clamp(uFrequencyShape, 0.0, 1.0);
        float formBlend = clamp(uFormBlend, 0.0, 1.0);
        float shapeShift = clamp(uShapeShift, 0.0, 1.0);
        float musicDrive = clamp(uMusicDrive, 0.0, 1.0);
        float frequencyMotion = clamp(uFrequencyMotion, 0.0, 1.0);
        float flowResponse = smoothstep(0.0, 1.0, clamp(uTrance, 0.0, 1.0));
        float reactiveDrive = musicDrive * (0.12 + flowResponse * 0.88);
        float reactiveFrequencyMotion = frequencyMotion * (0.15 + flowResponse * 0.85);
        float shapeClock = uShapePhase;
        float reactivity = clamp(
          0.16 + shapeShift * 0.62 + reactiveDrive * 0.72
            + reactiveFrequencyMotion * 0.42,
          0.0,
          1.35
        );
        float segments = max(4.0, floor(uSymmetryBase + 0.5));
        vec2 q = kaleidoscopeFold(
          p,
          segments,
          uMorphPhase * 0.18 + shapeClock * 0.16 + uJourney * 0.08
        );

        vec2 organic = vec2(
          fbm(q * (2.1 + frequencyShape * 0.55) + vec2(shapeClock * 0.23, 3.4)),
          fbm(rotate2d(0.91) * q * 2.3 - vec2(5.2, shapeClock * 0.19))
        ) - 0.5;
        q += organic * (
          0.018 + uMotionEnergy * 0.024 + uFlux * 0.032
            + shapeShift * 0.034 + reactiveDrive * 0.07
            + reactiveFrequencyMotion * 0.055
        );

        float levelContrast = max(0.0, uLevelFast - uLevelSlow);
        float breath = 1.0 + sin(TAU * uBeatPhase) * uPulseEnvelope * 0.035
          + levelContrast * 0.045 + uLevelSlow * 0.018;
        q *= breath;
        float drift = shapeClock * (
          0.48 + uMotionEnergy * 0.24 + reactiveDrive * 0.42
        );
        float tunnelPeriod = 1.78 - frequencyShape * 0.16 - shapeShift * 0.07;
        float tunnelHalf = tunnelPeriod * 0.5;
        float tunnelTravel = drift * (
          0.01 + flowResponse * 0.035 + uSpectralMid * 0.012
            + reactiveDrive * 0.02
        );
        float tunnelCoordinate = max(0.0, q.x + tunnelTravel);
        float tunnelPhase = tunnelCoordinate / tunnelPeriod;
        float tunnelRadius = abs(
          mod(tunnelCoordinate + tunnelHalf, tunnelPeriod) - tunnelHalf
        );
        vec2 tunnelQ = vec2(
          tunnelRadius,
          q.y / (1.0 + tunnelCoordinate * 0.34)
        );
        tunnelQ.y += sin(tunnelCoordinate * 2.17 + drift * 0.72)
          * (0.014 + reactiveDrive * 0.022);
        float shapeMix = smoothstep(0.18, 0.82, formBlend);
        float petalMix = smoothstep(0.38, 0.92, uSpectralHigh * 0.68 + uSpread * 0.32);
        float reactiveTravel = 0.74 + reactivity * 1.92;

        vec2 anchorInner = vec2(
          0.22 + frequencyShape * 0.078 + sin(drift * 0.71) * 0.027 * reactiveTravel,
          0.018 + sin(drift * 0.83 + 1.2) * 0.022 * reactiveTravel
        );
        vec2 anchorMiddle = vec2(
          0.49 + frequencyShape * 0.17 + sin(drift * 0.47 + 2.1) * 0.047 * reactiveTravel,
          0.055 + uSpectralMid * 0.11 + cos(drift * 0.64) * 0.034 * reactiveTravel
        );
        vec2 anchorOuter = vec2(
          0.81 + frequencyShape * 0.24 + cos(drift * 0.39 + 0.7) * 0.066 * reactiveTravel,
          0.1 + uSpectralHigh * 0.14 + sin(drift * 0.58 + 2.8) * 0.048 * reactiveTravel
        );

        float innerSize = 0.064 + uSpectralLow * 0.06 + uLevelSlow * 0.022;
        float middleSize = 0.084 - frequencyShape * 0.014 + uSpectralMid * 0.056;
        float outerSize = 0.094 - frequencyShape * 0.02 + uSpectralHigh * 0.064;
        float dInnerBase = motifDistance(
          tunnelQ - anchorInner,
          innerSize,
          shapeMix,
          petalMix * 0.35
        );
        float dInnerRosette = rosetteDistance(
          tunnelQ - anchorInner,
          innerSize * (0.94 + shapeShift * 0.12),
          4.0 + frequencyShape * 4.0,
          7.0 + uSpectralLow * 5.0,
          shapeClock * (0.62 + reactiveDrive * 0.62)
        );
        float dInner = mix(dInnerBase, dInnerRosette, clamp(
          shapeShift * 0.74 + uSpectralLow * 0.22,
          0.0,
          0.92
        ));
        vec2 middlePoint = rotate2d(0.28 + formBlend * 0.34)
          * (tunnelQ - anchorMiddle);
        float dMiddleBase = motifDistance(
          middlePoint,
          middleSize,
          1.0 - shapeMix,
          petalMix
        );
        float dMiddleCrystal = crystalDistance(
          middlePoint,
          middleSize,
          4.0 + frequencyShape * 5.0,
          0.18 + shapeShift * 0.2,
          -shapeClock * (0.5 + reactiveDrive * 0.48)
        );
        float dMiddle = mix(dMiddleBase, dMiddleCrystal, clamp(
          shapeShift * 0.68 + uSpectralMid * 0.3,
          0.0,
          0.94
        ));
        vec2 outerPoint = rotate2d(-0.22 + frequencyShape * 0.3)
          * (tunnelQ - anchorOuter);
        float dOuterLens = lensDistance(
          outerPoint,
          outerSize,
          0.035 + uSpectralHigh * 0.025
        );
        float dOuterRosette = rosetteDistance(
          outerPoint,
          outerSize,
          5.0 + frequencyShape * 4.0,
          11.0 + shapeShift * 8.0,
          shapeClock * (0.68 + reactiveDrive * 0.7)
        );
        float dOuter = mix(dOuterLens, dOuterRosette, clamp(
          shapeShift * 0.62 + uSpectralHigh * 0.35,
          0.0,
          0.9
        ));
        float ringA = abs(tunnelRadius - (
          0.36 + frequencyShape * 0.08
            + sin(drift * 0.52) * (0.018 + reactiveDrive * 0.025)
        ));
        float ringB = abs(tunnelRadius - (
          0.7 + frequencyShape * 0.12
            + cos(drift * 0.39) * (0.025 + reactiveFrequencyMotion * 0.04)
        ));
        float spoke = abs(tunnelQ.y - (0.017 + uSpectralMid * 0.018) * sin(
          tunnelQ.x * (9.0 + frequencyShape * 5.0)
            - drift * (0.78 + reactiveDrive * 0.62)
        ));
        float motifDistanceField = min(min(dInner, dMiddle), dOuter);
        float latticeDistance = min(min(ringA, ringB), spoke);
        float lineWidth = 0.0075 + uLevelSlow * 0.006 + uLight * 0.0025
          + shapeShift * 0.0018 + reactiveDrive * 0.0024;
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
        float tunnelDepth = 0.78 + 0.22 * cos(tunnelPhase * TAU - drift * 0.36);

        vec3 earthBase = vec3(0.002, 0.003, 0.002);
        vec3 earthGlow = mix(
          vec3(0.54, 0.065, 0.012),
          vec3(1.18, 0.42, 0.045),
          clamp(q.x * 0.82 + uSpectralMid * 0.28, 0.0, 1.0)
        );
        earthGlow = mix(earthGlow, vec3(0.035, 0.62, 0.17), uSpectralHigh * 0.46);
        float motifAngle = atan(tunnelQ.y, tunnelQ.x) / TAU;
        float spectralHue = uSpectralMid * 0.14 + uSpectralHigh * 0.31
          - uSpectralLow * 0.08;
        float psychedelicPhase = tunnelPhase * 0.42 + tunnelQ.y * 0.34
          + motifAngle * (0.28 + shapeShift * 0.3)
          + organic.x * 0.28 + drift * (0.045 + reactiveDrive * 0.045)
          + shapeShift * 0.16 + spectralHue;
        vec3 cosmic = spectralPalette(psychedelicPhase + formBlend * 0.18);
        vec3 fringe = spectralPalette(
          psychedelicPhase + 0.17 + motifDistanceField * 1.8
        );
        float cosmicAmount = clamp(0.22 + uCosmic * 0.96 + shapeShift * 0.22, 0.0, 1.0);
        vec3 glow = mix(earthGlow, cosmic, cosmicAmount);
        vec3 motifGlow = mix(glow, fringe, 0.42 + cosmicAmount * 0.28);
        float gate = mix(0.3, 0.78, uLight) + uPresence * 0.08 + uLevelSlow * 0.28
          + uSectionIntensity * 0.06 + uBeatPulse * 0.025;
        vec3 color = earthBase;
        color += motifGlow * motifLine * gate
          * (1.25 + uRelativeLevel * 0.62) * tunnelDepth;
        color += mix(glow, fringe, 0.48 + shapeShift * 0.22)
          * motifAura * gate * (0.28 + uLevelFast * 0.2) * tunnelDepth;
        color += mix(vec3(0.18, 0.48, 0.1), cosmic, uCosmic)
          * latticeLine * gate * (0.22 + uTonality * 0.2);
        color += mix(vec3(0.5, 0.12, 0.015), cosmic, uCosmic)
          * latticeAura * gate * (0.065 + uSpectralMid * 0.08);
        color += mix(vec3(0.7, 0.19, 0.025), cosmic, uCosmic)
          * centerGem * (0.12 + uLevelSlow * 0.32 + uPulseEnvelope * 0.18);
        color += glow * pow(motifAura, 0.32) * (0.035 + uLight * 0.045);
        float prismaticVeil = exp(-motifDistanceField * (8.5 + shapeShift * 2.5));
        float prismaticFill = 0.5 + 0.5 * cos(
          motifDistanceField * (19.0 + frequencyShape * 9.0)
            - tunnelPhase * TAU + drift * (0.26 + reactiveDrive * 0.22)
        );
        color += mix(glow, fringe, 0.64) * prismaticVeil * prismaticFill
          * (0.018 + cosmicAmount * 0.038 + shapeShift * 0.04);
        float cellA = fbm(
          tunnelQ * (3.1 + frequencyShape * 1.7)
            + organic * (1.1 + shapeShift * 0.7)
            + vec2(drift * (0.12 + reactiveDrive * 0.2), 2.8)
        );
        float cellB = fbm(
          rotate2d(1.19) * tunnelQ * (3.55 + formBlend * 1.45)
            - organic * (0.9 + shapeShift * 0.8)
            - vec2(4.1, drift * (0.1 + reactiveDrive * 0.17))
        );
        float reactionCell = abs(cellA - cellB);
        float kaleidoscopeMembrane = pow(1.0 - abs(sin(
          (reactionCell + motifDistanceField * 0.3 + tunnelPhase * 0.08)
            * (10.0 + uSpectralMid * 7.0 + shapeShift * 5.0
              + reactiveFrequencyMotion * 6.0)
        )), 4.0);
        vec3 membraneColor = spectralPalette(
          psychedelicPhase + cellA * 0.32 - cellB * 0.19 + shapeShift * 0.12
        );
        color += mix(glow, membraneColor, 0.78) * kaleidoscopeMembrane
          * (0.28 + prismaticVeil * 0.72)
          * (0.15 + cosmicAmount * 0.16 + shapeShift * 0.16
            + musicDrive * 0.18);
        float psychedelicContour = 0.5 + 0.5 * cos(
          motifDistanceField * (48.0 + shapeShift * 28.0)
            - tunnelPhase * TAU * 1.7 + organic.y * 3.2
            - drift * (0.42 + reactiveDrive * 0.3)
        );
        color += fringe * psychedelicContour * motifAura
          * (0.025 + shapeShift * 0.085 + uFlux * 0.04 + musicDrive * 0.075);
        color *= mix(0.82, 1.62, uLight) + uRelativeLevel * 0.22;
        float edgeImmersion = 0.7 + 0.3 * smoothstep(1.48, 0.18, length(screen));
        color *= edgeImmersion;
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
