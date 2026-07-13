import * as THREE from 'three';

const NUM_PARTICLES = 900;

function random(data) {
  data.seed = (data.seed * 1664525 + 1013904223) >>> 0;
  return data.seed / 4294967296;
}

function spawnParticle(geometry, features, burst = false) {
  const data = geometry.userData;
  const index = data.nextIndex;
  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;
  const lifetimes = geometry.attributes.lifetime.array;
  const shapeTypes = geometry.attributes.shapeType.array;
  const baseSizes = geometry.attributes.baseSize.array;
  const angle = random(data) * Math.PI * 2;
  const radius = burst ? random(data) * 0.035 : 0.14 + random(data) * 0.34;
  const speed = burst ? 0.24 + random(data) * 0.58 : 0.035 + random(data) * 0.09;

  positions[index * 3] = Math.cos(angle) * radius;
  positions[index * 3 + 1] = Math.sin(angle) * radius;
  positions[index * 3 + 2] = (random(data) - 0.5) * 0.04;
  data.velocities[index * 2] = Math.cos(angle) * speed;
  data.velocities[index * 2 + 1] = Math.sin(angle) * speed;
  data.durations[index] = burst ? 0.8 + random(data) * 0.9 : 0.45 + random(data) * 0.65;

  const hue = (0.52 + features.centroid * 0.2 + random(data) * 0.16) % 1;
  const color = new THREE.Color().setHSL(hue, 0.86, burst ? 0.62 : 0.72);
  colors[index * 3] = color.r;
  colors[index * 3 + 1] = color.g;
  colors[index * 3 + 2] = color.b;
  lifetimes[index] = 1;
  shapeTypes[index] = burst && random(data) > 0.55 ? 1 : 0;
  baseSizes[index] = burst ? 9 + random(data) * 17 : 3 + random(data) * 7;
  data.nextIndex = (index + 1) % NUM_PARTICLES;
}

export function getFireworksMaterial() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(NUM_PARTICLES * 3);
  const colors = new Float32Array(NUM_PARTICLES * 3);
  const lifetimes = new Float32Array(NUM_PARTICLES);
  const shapeTypes = new Float32Array(NUM_PARTICLES);
  const baseSizes = new Float32Array(NUM_PARTICLES);

  positions.fill(9999);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  geometry.setAttribute('shapeType', new THREE.BufferAttribute(shapeTypes, 1));
  geometry.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1));
  geometry.userData = {
    nextIndex: 0,
    seed: 0x6d2b79f5,
    velocities: new Float32Array(NUM_PARTICLES * 2),
    durations: new Float32Array(NUM_PARTICLES),
    lastBeat: 0,
    spawnAccumulator: 0,
  };

  const uniforms = {
    uHue: { value: 0 },
    uOpacity: { value: 0.95 },
    uPixelRatio: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute vec3 color;
      attribute float lifetime;
      attribute float shapeType;
      attribute float baseSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vLifetime;
      varying float vShapeType;
      void main() {
        vColor = color;
        vLifetime = lifetime;
        vShapeType = shapeType;
        float envelope = sin(clamp(lifetime, 0.0, 1.0) * 3.14159);
        gl_PointSize = max(1.0, baseSize * (0.3 + envelope) * uPixelRatio);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uHue;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vLifetime;
      varying float vShapeType;

      vec3 hueShift(vec3 color, float hue) {
        const vec3 axis = vec3(0.57735);
        return color * cos(hue) + cross(axis, color) * sin(hue)
          + axis * dot(axis, color) * (1.0 - cos(hue));
      }

      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float distanceFromCenter = length(p);
        float alpha;
        if (vShapeType < 0.5) {
          alpha = smoothstep(0.5, 0.06, distanceFromCenter);
        } else {
          float ring = abs(distanceFromCenter - 0.32);
          alpha = smoothstep(0.13, 0.015, ring);
        }
        alpha *= smoothstep(0.0, 0.16, vLifetime) * uOpacity;
        vec3 color = hueShift(vColor, uHue);
        color *= 1.0 + alpha * 0.7;
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { material, uniforms, geometry, isPoints: true };
}

export function updateFireworksGeometry(geometry, features, delta) {
  const data = geometry.userData;
  const positions = geometry.attributes.position.array;
  const lifetimes = geometry.attributes.lifetime.array;
  const dt = Math.max(1 / 240, Math.min(delta, 0.06));
  const beatStarted = features.beat > 0.78 && data.lastBeat <= 0.78;
  data.lastBeat = features.beat;

  if (beatStarted) {
    const burstCount = Math.round(26 + features.bass * 44);
    for (let i = 0; i < burstCount; i += 1) spawnParticle(geometry, features, true);
  }

  data.spawnAccumulator += dt * (features.treble * 24 + features.flux * 16);
  while (data.spawnAccumulator >= 1) {
    spawnParticle(geometry, features, false);
    data.spawnAccumulator -= 1;
  }

  const drag = Math.pow(0.975, dt * 60);
  for (let i = 0; i < NUM_PARTICLES; i += 1) {
    if (lifetimes[i] <= 0) continue;
    const xIndex = i * 3;
    const velocityIndex = i * 2;
    const x = positions[xIndex];
    const y = positions[xIndex + 1];
    const swirl = 0.12 + features.mid * 0.14;
    data.velocities[velocityIndex] += -y * swirl * dt;
    data.velocities[velocityIndex + 1] += x * swirl * dt;
    data.velocities[velocityIndex] *= drag;
    data.velocities[velocityIndex + 1] *= drag;
    positions[xIndex] += data.velocities[velocityIndex] * dt;
    positions[xIndex + 1] += data.velocities[velocityIndex + 1] * dt;
    lifetimes[i] -= dt / Math.max(0.1, data.durations[i]);
    if (lifetimes[i] <= 0) positions[xIndex] = 9999;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.attributes.lifetime.needsUpdate = true;
  geometry.attributes.shapeType.needsUpdate = true;
  geometry.attributes.baseSize.needsUpdate = true;
}
