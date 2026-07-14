import * as THREE from 'three';

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
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
    uInfluenceMap: { value: influenceTexture },
    uLevel: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uFlux: { value: 0 },
    uOnset: { value: 0 },
    uHue: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aAlong;
      attribute float aAngle;
      attribute float aCoil;
      uniform float uTime;
      uniform float uAspect;
      uniform float uLevel;
      uniform float uBass;
      uniform float uMid;
      uniform sampler2D uInfluenceMap;
      varying float vAlong;
      varying float vAngle;
      varying float vCoil;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

      vec4 influenceAt(float t, float coilIndex) {
        return texture2D(uInfluenceMap, vec2(fract(t * 0.72 + coilIndex * 0.173), 0.5));
      }

      float coilRadius(float coilIndex) {
        if (coilIndex < 0.5) return 0.27;
        if (coilIndex < 1.5) return 0.24;
        if (coilIndex < 2.5) return 0.31;
        if (coilIndex < 3.5) return 0.255;
        if (coilIndex < 4.5) return 0.285;
        return 0.225;
      }

      vec3 baseCenterline(float t, float coilIndex) {
        float s = t * 2.0 - 1.0;
        vec3 center;

        // Each body occupies its own broad path and depth lane. The open ends
        // continue beyond the viewport, making the frame feel like a close-up.
        if (coilIndex < 0.5) {
          center = vec3(s * 1.48, 0.73 + sin((t + 0.08) * PI) * 0.16, -1.72);
        } else if (coilIndex < 1.5) {
          center = vec3(s * 1.48, 0.12 + sin(t * TAU - 0.85) * 0.21, -0.92);
        } else if (coilIndex < 2.5) {
          center = vec3(s * 1.5, -0.78 + sin((t - 0.12) * PI) * 0.17, -0.22);
        } else if (coilIndex < 3.5) {
          center = vec3(-0.82 + sin(t * PI * 1.25 + 0.4) * 0.17, s * 1.42, 0.36);
        } else if (coilIndex < 4.5) {
          center = vec3(0.79 + sin(t * PI * 1.35 - 0.65) * 0.19, s * 1.43, 0.08);
        } else {
          center = vec3(-1.18 + t * 2.35 + sin(t * PI) * 0.14,
            -1.32 + t * 2.65 + sin(t * TAU + 0.4) * 0.1, -1.35);
        }

        center.x *= uAspect;
        return center;
      }

      vec3 centerline(float t, float coilIndex) {
        vec3 center = baseCenterline(t, coilIndex);
        vec4 influence = influenceAt(t, coilIndex);
        vec3 before = baseCenterline(t - 0.004, coilIndex);
        vec3 after = baseCenterline(t + 0.004, coilIndex);
        vec2 tangent = normalize(after.xy - before.xy);
        vec2 broadNormal = vec2(-tangent.y, tangent.x);
        float bodyWave = sin(t * PI * (1.35 + mod(coilIndex, 3.0) * 0.22)
          + uTime * 0.42 + coilIndex * 1.73);
        float displacement = bodyWave * (0.008 + uBass * 0.016 + influence.r * 0.028);
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
        float radius = coilRadius(aCoil) * breath + slowRipple * uBass;
        vec3 tubeNormal = normalize(cos(aAngle) * side + sin(aAngle) * binormal);
        vec3 transformed = center + tubeNormal * radius;
        vAlong = aAlong;
        vAngle = aAngle;
        vCoil = aCoil;
        vNormal = normalize(normalMatrix * tubeNormal);
        vPosition = transformed;
        vInfluence = influence;
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
      varying float vAlong;
      varying float vAngle;
      varying float vCoil;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;

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
        vec3 oldGold = vec3(1.65, 0.64, 0.1);
        vec3 coldSilver = vec3(0.48, 1.12, 1.0);
        float family = mod(coilIndex, 3.0);
        if (family < 0.5) return oldGold;
        if (family < 1.5) return mineralGreen;
        return coldSilver;
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
        float patternDrift = uTime * (0.11 + uFlux * 0.08) + vCoil * 0.71;
        vec2 mazeUvA = vec2(vAlong * (18.0 + mod(vCoil, 3.0) * 2.0) - patternDrift,
          theta * (7.0 + mod(vCoil + 1.0, 3.0)));
        vec2 mazeUvB = vec2(vAlong * (25.0 + mod(vCoil + 2.0, 3.0) * 2.0) + patternDrift * 0.62,
          theta * (10.0 + mod(vCoil, 2.0)) + vAlong * 1.5);
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

        float localPosition = fract(vAlong + vCoil * 0.137);
        float pulseCenter = fract(uTime * 0.045 + vCoil * 0.19);
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
  };
}
