import * as THREE from 'three';

const SIMULATION_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SIMULATION_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uPreviousState;
  uniform vec2 uResolution;
  uniform float uDelta;
  uniform float uReset;
  uniform float uAspect;
  uniform float uRelativeLevel;
  uniform float uLevelFast;
  uniform float uFlow;
  uniform float uInstability;
  uniform float uDefinition;
  uniform float uBlueprintPhase;
  uniform vec4 uFamilies;
  uniform vec4 uModesX;
  uniform vec4 uModesY;
  uniform vec4 uRotations;
  uniform vec4 uSeeds;
  uniform vec4 uModeWeights;
  varying vec2 vUv;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
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
    float breathingEdge = superRadius * (1.0 + sin(angle * max(2.0, floor(m * 0.55))
      + seed * 6.2831853) * 0.16);
    float radial = sin(breathingEdge * 3.14159265 * (n * 0.65 + 1.8));
    float lobes = cos(angle * max(2.0, floor(m * 0.48)) + sin(superRadius * 5.0 + seed * 4.0));
    return radial + lobes * 0.52;
  }

  float resonanceField(vec2 p, float family, float n, float m, float rotation, float seed) {
    vec2 q = rotate2d(rotation) * p;
    if (family < 0.5) return rectangularField(q, n, m);
    if (family < 1.5) return radialField(q, n, m, seed);
    if (family < 2.5) return diagonalField(q, n, m, seed);
    if (family < 3.5) return coupledField(q, n, m, seed);
    return membraneField(q, n, m, seed);
  }

  vec2 platePoint(vec2 uv) {
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uAspect;
    p *= 0.77;
    return rotate2d((uBlueprintPhase - 0.5) * 0.18) * p;
  }

  float targetDensity(vec2 uv) {
    vec2 p = platePoint(uv);
    float fieldA = resonanceField(p, uFamilies.x, uModesX.x, uModesY.x, uRotations.x, uSeeds.x);
    float fieldB = resonanceField(p, uFamilies.y, uModesX.y, uModesY.y, uRotations.y, uSeeds.y);
    float fieldC = resonanceField(p, uFamilies.z, uModesX.z, uModesY.z, uRotations.z, uSeeds.z);
    float fieldD = resonanceField(p, uFamilies.w, uModesX.w, uModesY.w, uRotations.w, uSeeds.w);
    float density = exp(-abs(fieldA) * uDefinition) * uModeWeights.x
      + exp(-abs(fieldB) * uDefinition) * uModeWeights.y
      + exp(-abs(fieldC) * uDefinition) * uModeWeights.z
      + exp(-abs(fieldD) * uDefinition) * uModeWeights.w;
    return clamp(density, 0.0, 1.0);
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    if (uReset > 0.5) {
      float initialDensity = targetDensity(vUv) * 0.72 + 0.012;
      gl_FragColor = vec4(initialDensity, 0.5, 0.5, 1.0);
      return;
    }

    vec4 previous = texture2D(uPreviousState, vUv);
    vec2 velocity = (previous.gb - 0.5) * 2.0;
    float densityLeft = targetDensity(vUv - vec2(texel.x, 0.0));
    float densityRight = targetDensity(vUv + vec2(texel.x, 0.0));
    float densityDown = targetDensity(vUv - vec2(0.0, texel.y));
    float densityUp = targetDensity(vUv + vec2(0.0, texel.y));
    vec2 targetGradient = vec2(densityRight - densityLeft, densityUp - densityDown);
    float gradientStrength = min(1.0, length(targetGradient) * 5.0);
    vec2 attraction = targetGradient / max(length(targetGradient), 0.0001);

    float activity = 0.08 + uRelativeLevel * 0.34 + uLevelFast * 0.12;
    float liquidFlow = mix(0.45, 1.35, uFlow);
    float damping = exp(-uDelta * mix(3.8, 2.15, activity) / liquidFlow);
    velocity = velocity * damping
      + attraction * gradientStrength * uDelta * (0.025 + activity * 0.075) * liquidFlow;
    float velocityLimit = (0.012 + activity * 0.028) * liquidFlow;
    velocity = clamp(velocity, vec2(-velocityLimit), vec2(velocityLimit));

    vec2 sourceUv = clamp(vUv - velocity * uDelta, texel, 1.0 - texel);
    float advected = texture2D(uPreviousState, sourceUv).r;
    float neighborDensity = (
      texture2D(uPreviousState, vUv + vec2(texel.x, 0.0)).r
      + texture2D(uPreviousState, vUv - vec2(texel.x, 0.0)).r
      + texture2D(uPreviousState, vUv + vec2(0.0, texel.y)).r
      + texture2D(uPreviousState, vUv - vec2(0.0, texel.y)).r
    ) * 0.25;
    float target = targetDensity(vUv);
    float settleRate = 1.0 - exp(-uDelta * (0.14 + activity * 0.28) * liquidFlow);
    float density = mix(advected, target, settleRate);
    float surfaceTension = 1.0 - exp(-uDelta * (0.55 + uInstability * 0.4));
    density = mix(density, neighborDensity, surfaceTension);
    gl_FragColor = vec4(clamp(density, 0.0, 1.0), velocity * 0.5 + 0.5, 1.0);
  }
`;

function createTarget(width, height) {
  return new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

export class SandSimulation {
  constructor(width = 640, height = 360) {
    this.width = 0;
    this.height = 0;
    this.readTarget = null;
    this.writeTarget = null;
    this.needsReset = true;
    this.accumulatedDelta = 0;
    this.uniforms = {
      uPreviousState: { value: null },
      uResolution: { value: new THREE.Vector2(width, height) },
      uDelta: { value: 1 / 60 },
      uReset: { value: 1 },
      uAspect: { value: width / height },
      uRelativeLevel: { value: 0 },
      uLevelFast: { value: 0 },
      uFlow: { value: 0.5 },
      uInstability: { value: 0 },
      uDefinition: { value: 7 },
      uBlueprintPhase: { value: 0 },
      uFamilies: { value: new THREE.Vector4() },
      uModesX: { value: new THREE.Vector4(2, 3, 2, 3) },
      uModesY: { value: new THREE.Vector4(3, 4, 3, 4) },
      uRotations: { value: new THREE.Vector4() },
      uSeeds: { value: new THREE.Vector4() },
      uModeWeights: { value: new THREE.Vector4(1, 0, 0, 0) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SIMULATION_VERTEX_SHADER,
      fragmentShader: SIMULATION_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.resize(width, height);
  }

  resize(displayWidth, displayHeight) {
    const maxWidth = displayWidth < 700 ? 320 : 560;
    const width = Math.max(192, Math.min(maxWidth, Math.round(displayWidth * 0.72)));
    const height = Math.max(128, Math.round(width / Math.max(0.65, displayWidth / Math.max(1, displayHeight))));
    if (width === this.width && height === this.height) return;
    this.readTarget?.dispose();
    this.writeTarget?.dispose();
    this.width = width;
    this.height = height;
    this.readTarget = createTarget(width, height);
    this.writeTarget = createTarget(width, height);
    this.uniforms.uResolution.value.set(width, height);
    this.needsReset = true;
  }

  update(renderer, resonance, features, delta, aspect, blueprintPhase = 0, flow = 0.5) {
    this.accumulatedDelta += Math.max(0, delta);
    if (!this.needsReset && this.accumulatedDelta < 1 / 30) return this.readTarget.texture;
    const uniforms = this.uniforms;
    uniforms.uPreviousState.value = this.readTarget.texture;
    uniforms.uDelta.value = Math.max(1 / 240, Math.min(this.accumulatedDelta, 0.05));
    uniforms.uReset.value = this.needsReset ? 1 : 0;
    uniforms.uAspect.value = aspect;
    uniforms.uRelativeLevel.value = features.relativeLevel ?? features.level ?? 0;
    uniforms.uLevelFast.value = features.levelFast ?? features.level ?? 0;
    uniforms.uFlow.value = flow;
    uniforms.uInstability.value = resonance.instability ?? 0;
    uniforms.uDefinition.value = 5.2 + (features.levelSlow ?? features.level ?? 0) * 2.2
      + (features.tonality ?? 0.5) * 1.2;
    uniforms.uBlueprintPhase.value = blueprintPhase;
    uniforms.uFamilies.value.set(resonance.familyA, resonance.familyB, resonance.familyC, resonance.familyD);
    uniforms.uModesX.value.set(resonance.modeAX, resonance.modeBX, resonance.modeCX, resonance.modeDX);
    uniforms.uModesY.value.set(resonance.modeAY, resonance.modeBY, resonance.modeCY, resonance.modeDY);
    uniforms.uRotations.value.set(resonance.rotationA, resonance.rotationB, resonance.rotationC, resonance.rotationD);
    uniforms.uSeeds.value.set(resonance.seedA, resonance.seedB, resonance.seedC, resonance.seedD);
    uniforms.uModeWeights.value.set(resonance.weightA, resonance.weightB, resonance.weightC, resonance.weightD);

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.writeTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
    [this.readTarget, this.writeTarget] = [this.writeTarget, this.readTarget];
    this.needsReset = false;
    this.accumulatedDelta = 0;
    return this.readTarget.texture;
  }

  reset() {
    this.needsReset = true;
    this.accumulatedDelta = 0;
  }

  dispose() {
    this.readTarget?.dispose();
    this.writeTarget?.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
