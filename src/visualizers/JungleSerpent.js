import * as THREE from 'three';

function createSerpentGeometry() {
  const lengthSegments = 256;
  const radialSegments = 20;
  const vertexCount = (lengthSegments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const along = new Float32Array(vertexCount);
  const angle = new Float32Array(vertexCount);
  const indices = [];

  let vertex = 0;
  for (let segment = 0; segment <= lengthSegments; segment += 1) {
    const t = segment / lengthSegments;
    for (let ring = 0; ring <= radialSegments; ring += 1) {
      along[vertex] = t;
      angle[vertex] = (ring / radialSegments) * Math.PI * 2;
      vertex += 1;
    }
  }

  for (let segment = 0; segment < lengthSegments; segment += 1) {
    for (let ring = 0; ring < radialSegments; ring += 1) {
      const row = radialSegments + 1;
      const a = segment * row + ring;
      const b = (segment + 1) * row + ring;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
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
      uniform float uTime;
      uniform float uAspect;
      uniform float uLevel;
      uniform float uBass;
      uniform float uMid;
      uniform float uFlux;
      uniform sampler2D uInfluenceMap;
      varying float vAlong;
      varying float vAngle;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;

      const float TAU = 6.28318530718;

      vec4 influenceAt(float t) {
        return texture2D(uInfluenceMap, vec2(fract(t), 0.5));
      }

      vec3 centerline(float t) {
        float phase = t * TAU;
        vec4 influence = influenceAt(t);
        float drift = uTime * (0.018 + uLevel * 0.24 + uFlux * 0.08);
        float x = sin(phase * 2.0 + sin(phase * 5.0 + drift) * 0.42 + drift * 0.48) * 0.69;
        x += sin(phase * 7.0 - drift * 0.72) * 0.1;
        float y = sin(phase * 3.0 + 0.72 + cos(phase * 4.0 - drift) * 0.24) * 0.59;
        y += cos(phase * 8.0 + drift * 0.63) * 0.07;
        float localMotion = influence.r * (0.035 + uBass * 0.08);
        x += sin(phase * 11.0 - uTime * (0.38 + uBass * 0.72)) * localMotion;
        y += cos(phase * 9.0 + uTime * (0.31 + uMid * 0.58)) * localMotion;
        float z = sin(phase * 5.0 + 0.7) * 0.16 + cos(phase * 2.0) * 0.07;
        z += influence.r * sin(phase * 6.0 - uTime * 0.5) * 0.035;
        return vec3(x * uAspect * 1.08, y, z);
      }

      void main() {
        float tangentStep = 1.0 / 512.0;
        vec3 center = centerline(aAlong);
        vec3 tangent = normalize(centerline(aAlong + tangentStep) - centerline(aAlong - tangentStep));
        vec3 side = normalize(cross(vec3(0.0, 0.0, 1.0), tangent));
        vec3 binormal = normalize(cross(tangent, side));
        vec4 influence = influenceAt(aAlong);
        float radius = 0.15 + influence.r * 0.068
          + sin(aAlong * TAU * 6.0 + uTime * 0.2) * (0.006 + uBass * 0.006);
        vec3 tubeNormal = normalize(cos(aAngle) * side + sin(aAngle) * binormal);
        vec3 transformed = center + tubeNormal * radius;
        vAlong = aAlong;
        vAngle = aAngle;
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
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec4 vInfluence;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      vec3 hueShift(vec3 color, float hue) {
        const vec3 axis = vec3(0.57735);
        return color * cos(hue) + cross(axis, color) * sin(hue)
          + axis * dot(axis, color) * (1.0 - cos(hue));
      }

      void main() {
        float soundGate = smoothstep(0.012, 0.2, uLevel);
        vec3 normal = normalize(vNormal);
        vec3 lightDirection = normalize(vec3(-0.52, 0.68, 0.82));
        vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float specular = pow(max(dot(normal, halfVector), 0.0), 82.0);
        float rim = pow(1.0 - max(normal.z, 0.0), 2.6);

        float theta = vAngle / TAU;
        float scaleRows = vAlong * (46.0 + vInfluence.g * 34.0);
        float stagger = mod(floor(scaleRows), 2.0) * 0.5;
        vec2 scaleCell = abs(fract(vec2(scaleRows, theta * 9.0 + stagger)) - 0.5);
        float scaleDiamond = scaleCell.x + scaleCell.y;
        float scaleEdge = smoothstep(0.38, 0.49, scaleDiamond);
        float scaleCore = 1.0 - smoothstep(0.08, 0.43, length(scaleCell));
        float microGrain = hash21(floor(vec2(scaleRows, theta * 45.0)) + vAlong * 19.0);

        float patternPhase = vAlong * TAU * (10.0 + vInfluence.g * 7.0)
          + theta * TAU * (2.0 + uMid * 3.0)
          - uTime * (0.55 + uHigh * 1.7);
        float movingVein = pow(0.5 + 0.5 * sin(patternPhase), 11.0);
        float secondaryVein = pow(0.5 + 0.5 * sin(patternPhase * 0.47 + theta * 19.0), 16.0);
        float pulsePosition = abs(fract(vAlong - uTime * (0.08 + uFlux * 0.2)) - 0.5);
        float travellingPulse = exp(-pulsePosition * 30.0) * uOnset;
        float emission = vInfluence.b * (movingVein * 0.76 + secondaryVein * 0.4)
          + travellingPulse;

        vec3 obsidian = vec3(0.0015, 0.004, 0.003);
        vec3 jungleGreen = vec3(0.025, 0.42, 0.14);
        vec3 venomCyan = vec3(0.04, 1.8, 0.76);
        vec3 ancientAmber = vec3(1.5, 0.48, 0.06);
        vec3 color = obsidian;
        color += jungleGreen * soundGate * (0.045 + uLevel * 0.2);
        color += jungleGreen * diffuse * (0.11 + vInfluence.g * 0.8) * soundGate;
        color += jungleGreen * scaleCore * vInfluence.g * 0.32 * soundGate;
        color -= jungleGreen * scaleEdge * 0.15;
        color += venomCyan * emission * scaleCore * (0.34 + uHigh) * soundGate;
        color += ancientAmber * travellingPulse * 0.7 * soundGate;
        color += venomCyan * rim * vInfluence.b * 0.13 * soundGate;
        color += vec3(0.65, 0.82, 0.69) * specular
          * (0.035 + vInfluence.a * 1.45) * soundGate;
        color += vec3(0.08, 0.14, 0.1) * microGrain * 0.014 * soundGate;
        color *= 0.72 + vPosition.z * 0.7;
        color = hueShift(color, uHue * TAU * 0.32);
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
