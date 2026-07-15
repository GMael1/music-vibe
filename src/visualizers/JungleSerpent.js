import * as THREE from 'three';
import { createSerpentFieldConfig } from './VisualDynamics.js';

const COIL_COUNT = 6;

function createSerpentGeometry() {
  const lengthSegments = 112;
  const radialSegments = 24;
  const verticesPerCoil = (lengthSegments + 1) * (radialSegments + 1);
  const vertexCount = verticesPerCoil * COIL_COUNT;
  const positions = new Float32Array(vertexCount * 3);
  const along = new Float32Array(vertexCount);
  const angle = new Float32Array(vertexCount);
  const coil = new Float32Array(vertexCount);
  const indices = [];

  let vertex = 0;
  for (let coilIndex = 0; coilIndex < COIL_COUNT; coilIndex += 1) {
    const vertexOffset = coilIndex * verticesPerCoil;
    for (let segment = 0; segment <= lengthSegments; segment += 1) {
      const t = segment / lengthSegments;
      for (let ring = 0; ring <= radialSegments; ring += 1) {
        along[vertex] = t;
        angle[vertex] = (ring / radialSegments) * Math.PI * 2;
        coil[vertex] = coilIndex;
        vertex += 1;
      }
    }

    for (let segment = 0; segment < lengthSegments; segment += 1) {
      for (let ring = 0; ring < radialSegments; ring += 1) {
        const row = radialSegments + 1;
        const a = vertexOffset + segment * row + ring;
        const b = vertexOffset + (segment + 1) * row + ring;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aCoil', new THREE.BufferAttribute(coil, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
  return geometry;
}

export function getJungleSerpentMaterial(influenceTexture) {
  const field = createSerpentFieldConfig();
  const uniforms = {
    uTime: { value: 0 },
    uTravelTime: { value: 0 },
    uAspect: { value: 16 / 9 },
    uInfluenceMap: { value: influenceTexture },
    uLevel: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uFlux: { value: 0 },
    uOnset: { value: 0 },
    uHue: { value: 0 },
    uTrance: { value: 0.5 },
    uCalm: { value: 0.5 },
    uEnergy: { value: 0.5 },
    uCosmic: { value: 0.2 },
    uFlowAngle: { value: field.angle },
    uWaveAmplitude: { value: field.waveAmplitude },
    uLaneOffsets: { value: field.lanes.map(lane => lane.offset) },
    uLaneSpeeds: { value: field.lanes.map(lane => lane.speed) },
    uLaneDirections: { value: field.lanes.map(lane => lane.direction) },
    uLanePhases: { value: field.lanes.map(lane => lane.phase) },
    uLaneRadii: { value: field.lanes.map(lane => lane.radius) },
    uLaneDepths: { value: field.lanes.map(lane => lane.depth) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aAlong;
      attribute float aAngle;
      attribute float aCoil;
      uniform float uTime;
      uniform float uTravelTime;
      uniform float uAspect;
      uniform float uLevel;
      uniform float uBass;
      uniform float uMid;
      uniform float uEnergy;
      uniform float uFlowAngle;
      uniform float uWaveAmplitude;
      uniform float uLaneOffsets[6];
      uniform float uLaneSpeeds[6];
      uniform float uLaneDirections[6];
      uniform float uLanePhases[6];
      uniform float uLaneRadii[6];
      uniform float uLaneDepths[6];
      uniform sampler2D uInfluenceMap;
      varying float vAlong;
      varying float vAngle;
      varying float vCoil;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;
      varying float vFlowPosition;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

      vec4 influenceAt(float t, float coilIndex) {
        return texture2D(uInfluenceMap, vec2(fract(t * 0.72 + coilIndex * 0.173), 0.5));
      }

      float laneOffset(float index) {
        if (index < 0.5) return uLaneOffsets[0];
        if (index < 1.5) return uLaneOffsets[1];
        if (index < 2.5) return uLaneOffsets[2];
        if (index < 3.5) return uLaneOffsets[3];
        if (index < 4.5) return uLaneOffsets[4];
        return uLaneOffsets[5];
      }

      float laneSpeed(float index) {
        if (index < 0.5) return uLaneSpeeds[0];
        if (index < 1.5) return uLaneSpeeds[1];
        if (index < 2.5) return uLaneSpeeds[2];
        if (index < 3.5) return uLaneSpeeds[3];
        if (index < 4.5) return uLaneSpeeds[4];
        return uLaneSpeeds[5];
      }

      float laneDirection(float index) {
        if (index < 0.5) return uLaneDirections[0];
        if (index < 1.5) return uLaneDirections[1];
        if (index < 2.5) return uLaneDirections[2];
        if (index < 3.5) return uLaneDirections[3];
        if (index < 4.5) return uLaneDirections[4];
        return uLaneDirections[5];
      }

      float lanePhase(float index) {
        if (index < 0.5) return uLanePhases[0];
        if (index < 1.5) return uLanePhases[1];
        if (index < 2.5) return uLanePhases[2];
        if (index < 3.5) return uLanePhases[3];
        if (index < 4.5) return uLanePhases[4];
        return uLanePhases[5];
      }

      float laneRadius(float index) {
        if (index < 0.5) return uLaneRadii[0];
        if (index < 1.5) return uLaneRadii[1];
        if (index < 2.5) return uLaneRadii[2];
        if (index < 3.5) return uLaneRadii[3];
        if (index < 4.5) return uLaneRadii[4];
        return uLaneRadii[5];
      }

      float laneDepth(float index) {
        if (index < 0.5) return uLaneDepths[0];
        if (index < 1.5) return uLaneDepths[1];
        if (index < 2.5) return uLaneDepths[2];
        if (index < 3.5) return uLaneDepths[3];
        if (index < 4.5) return uLaneDepths[4];
        return uLaneDepths[5];
      }

      vec3 baseCenterline(float t, float coilIndex) {
        vec2 direction = normalize(vec2(cos(uFlowAngle) * uAspect, sin(uFlowAngle)));
        vec2 corridorNormal = vec2(-direction.y, direction.x);
        float period = 4.0;
        float travel = uTravelTime * laneSpeed(coilIndex) * laneDirection(coilIndex)
          + lanePhase(coilIndex);
        float wrappedTravel = mod(travel, period) - period * 0.5;
        float span = 5.4 + uAspect * 2.4;
        float longitudinal = (t * 2.0 - 1.0) * span + wrappedTravel;
        float flowPosition = longitudinal + travel;
        float sharedWave = sin(flowPosition * TAU / period + coilIndex * 0.37)
          * uWaveAmplitude;
        vec2 center = direction * longitudinal
          + corridorNormal * (laneOffset(coilIndex) + sharedWave);
        return vec3(center, laneDepth(coilIndex));
      }

      vec3 centerline(float t, float coilIndex) {
        vec3 center = baseCenterline(t, coilIndex);
        vec4 influence = influenceAt(t, coilIndex);
        vec3 before = baseCenterline(t - 0.004, coilIndex);
        vec3 after = baseCenterline(t + 0.004, coilIndex);
        vec2 tangent = normalize(after.xy - before.xy);
        vec2 broadNormal = vec2(-tangent.y, tangent.x);
        float bodyWave = sin(t * PI * 1.4 + uTime * 0.34 + coilIndex * 1.73);
        float displacement = bodyWave
          * (0.0015 + uBass * 0.002 + influence.r * 0.003)
          * mix(0.28, 1.0, uEnergy);
        center.xy += broadNormal * displacement;
        center.z += sin(t * PI + coilIndex) * influence.r * 0.014;
        return center;
      }

      void main() {
        float tangentStep = 1.0 / 448.0;
        vec3 center = centerline(aAlong, aCoil);
        vec3 tangent = normalize(centerline(aAlong + tangentStep, aCoil)
          - centerline(aAlong - tangentStep, aCoil));
        vec3 referenceAxis = abs(tangent.z) > 0.94
          ? vec3(0.0, 1.0, 0.0)
          : vec3(0.0, 0.0, 1.0);
        vec3 side = normalize(cross(referenceAxis, tangent));
        vec3 binormal = normalize(cross(tangent, side));
        vec4 influence = influenceAt(aAlong, aCoil);
        float breath = 1.0 + uLevel * 0.025 + influence.r * 0.052;
        float slowRipple = sin(aAlong * TAU * 2.0 + uTime * 0.28 + aCoil) * 0.006;
        float radius = laneRadius(aCoil) * breath + slowRipple * uBass;
        vec3 tubeNormal = normalize(cos(aAngle) * side + sin(aAngle) * binormal);
        vec3 transformed = center + tubeNormal * radius;
        vAlong = aAlong;
        vAngle = aAngle;
        vCoil = aCoil;
        vNormal = normalize(normalMatrix * tubeNormal);
        vPosition = transformed;
        vInfluence = influence;
        vFlowPosition = (aAlong * 2.0 - 1.0) * (5.4 + uAspect * 2.4)
          + uTravelTime * laneSpeed(aCoil) * laneDirection(aCoil) + lanePhase(aCoil);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLevel;
      uniform float uBass;
      uniform float uMid;
      uniform float uHigh;
      uniform float uFlux;
      uniform float uOnset;
      uniform float uHue;
      uniform float uCalm;
      uniform float uEnergy;
      uniform float uCosmic;
      varying float vAlong;
      varying float vAngle;
      varying float vCoil;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;
      varying float vFlowPosition;

      const float TAU = 6.28318530718;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float angularMaze(vec2 uv, float width) {
        vec2 tile = floor(uv);
        vec2 cell = fract(uv) - 0.5;
        float turn = step(0.5, hash21(tile));
        float diagonal = abs(cell.x + mix(cell.y, -cell.y, turn));
        return 1.0 - smoothstep(width, width + 0.04, diagonal);
      }

      float curvedMaze(vec2 uv, float width) {
        vec2 tile = floor(uv);
        vec2 cell = fract(uv) - 0.5;
        cell.x = mix(cell.x, -cell.x, step(0.5, hash21(tile)));
        float arcA = abs(length(cell - vec2(0.5)) - 0.5);
        float arcB = abs(length(cell + vec2(0.5)) - 0.5);
        return 1.0 - smoothstep(width, width + 0.04, min(arcA, arcB));
      }

      vec3 hueShift(vec3 color, float hue) {
        const vec3 axis = vec3(0.57735);
        return color * cos(hue) + cross(axis, color) * sin(hue)
          + axis * dot(axis, color) * (1.0 - cos(hue));
      }

      vec3 coilColor(float coilIndex) {
        vec3 mineralGreen = vec3(0.08, 1.25, 0.42);
        vec3 oldGold = vec3(1.38, 0.58, 0.12);
        vec3 cosmic = vec3(0.36, 0.92, 1.18);
        float warmth = 0.3 + sin(coilIndex * 1.7) * 0.08;
        return mix(mix(mineralGreen, oldGold, warmth), cosmic, uCosmic * 0.62);
      }

      void main() {
        float soundGate = smoothstep(0.008, 0.16, uLevel);
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = vec3(0.0, 0.0, 1.0);
        vec3 lightDirection = normalize(vec3(-0.58, 0.72, 0.82));
        vec3 halfVector = normalize(lightDirection + viewDirection);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float specular = pow(max(dot(normal, halfVector), 0.0), 94.0);
        float broadSpecular = pow(max(dot(normal, halfVector), 0.0), 18.0);
        float rim = pow(1.0 - max(normal.z, 0.0), 3.0);

        float theta = vAngle / TAU;
        float patternDrift = uTime * (0.035 + uEnergy * 0.075 + uFlux * 0.08 * uEnergy)
          + vFlowPosition * 0.08;
        vec2 mazeUvA = vec2(vFlowPosition * (2.2 + mod(vCoil, 3.0) * 0.2) - patternDrift,
          theta * (7.0 + mod(vCoil + 1.0, 3.0)));
        vec2 mazeUvB = vec2(vFlowPosition * (3.0 + mod(vCoil + 2.0, 3.0) * 0.2)
          + patternDrift * 0.62,
          theta * (10.0 + mod(vCoil, 2.0)) + vFlowPosition * 0.18);
        float angularA = angularMaze(mazeUvA, 0.052);
        float angularB = angularMaze(mazeUvB, 0.044);
        float curvedA = curvedMaze(mazeUvA, 0.042);
        float curvedB = curvedMaze(mazeUvB, 0.036);
        float patternFamily = mod(vCoil, 3.0);
        float mazeA = patternFamily < 0.5 ? curvedA
          : (patternFamily < 1.5 ? mix(curvedA, angularA, 0.42) : angularA);
        float mazeB = patternFamily < 0.5 ? curvedB
          : (patternFamily < 1.5 ? mix(curvedB, angularB, 0.42) : angularB);
        float topologyMix = smoothstep(0.16, 0.72, vInfluence.g + uMid * 0.24);
        float maze = mix(mazeA, mazeB, topologyMix);

        float localPosition = fract(vFlowPosition * 0.08);
        float pulseCenter = fract(uTime * mix(0.018, 0.06, uEnergy));
        float pulseDistance = abs(localPosition - pulseCenter);
        pulseDistance = min(pulseDistance, 1.0 - pulseDistance);
        float travellingGlow = exp(-pulseDistance * pulseDistance * 58.0)
          * (0.18 + uOnset * 0.82);
        float fineCurrent = pow(0.5 + 0.5 * sin(
          vAlong * TAU * 21.0 + theta * TAU * 3.0 - uTime * 0.3), 12.0);

        vec3 accent = coilColor(vCoil);
        float lightEnergy = vInfluence.a * 0.5 + vInfluence.b * 0.32 + uHigh * 0.18;
        float mazeEmission = maze * lightEnergy * (0.32 + uMid * 0.68);
        mazeEmission += maze * fineCurrent * uHigh * 0.32;
        mazeEmission += maze * travellingGlow * (0.13 + uBass * 0.34 + uOnset * 0.22);

        vec3 color = vec3(0.00045, 0.0007, 0.00065);
        color += vec3(0.006, 0.01, 0.009) * diffuse * soundGate;
        color += accent * mazeEmission * soundGate;
        color += accent * diffuse * vInfluence.g * 0.038 * soundGate;
        color += vec3(0.34, 0.42, 0.38) * broadSpecular
          * (0.012 + lightEnergy * 0.05) * soundGate;
        color += vec3(0.9, 1.0, 0.94) * specular
          * (0.018 + vInfluence.a * 0.3) * soundGate;
        color += accent * rim * lightEnergy * 0.026 * soundGate;
        color += accent * (vInfluence.g * 0.035 + vInfluence.a * 0.028)
          * uCalm * soundGate;
        color = hueShift(color, uHue * TAU * 0.24);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  return {
    material,
    uniforms,
    geometry: createSerpentGeometry(),
    field,
  };
}
