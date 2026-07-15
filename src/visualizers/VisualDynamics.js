const clamp01 = value => Math.max(0, Math.min(1, value));

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(0.00001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function getJourneyDynamics(trance = 0.5) {
  const value = clamp01(trance);
  const energy = smoothstep(0.08, 0.92, value);
  const shapedEnergy = energy * energy * (1.22 - energy * 0.22);
  return {
    value,
    calm: 1 - energy,
    energy,
    motionScale: 0.1 + shapedEnergy * 1.28,
    audioAttack: 0.65 + shapedEnergy * 8.4,
    audioRelease: 0.38 + shapedEnergy * 4.1,
    onsetScale: 0.08 + shapedEnergy * 0.92,
    structureScale: 0.12 + shapedEnergy * 0.88,
    maskFlow: 0.16 + shapedEnergy * 0.84,
  };
}

export function getLayerMaskConfig(position = 'center') {
  const configs = {
    background: { anchor: [0.5, 0.5], radius: 10, feather: 0.2 },
    center: { anchor: [0.5, 0.5], radius: 0.82, feather: 0.42 },
    'top-left': { anchor: [0.13, 0.85], radius: 0.9, feather: 0.5 },
    'top-right': { anchor: [0.87, 0.85], radius: 0.9, feather: 0.5 },
    'bottom-left': { anchor: [0.13, 0.15], radius: 0.9, feather: 0.5 },
    'bottom-right': { anchor: [0.87, 0.15], radius: 0.9, feather: 0.5 },
  };
  return configs[position] ?? configs.center;
}

export function createSerpentFieldConfig(seed = 0x51a7c0de, laneCount = 6) {
  const random = createSeededRandom(seed);
  const angle = (random() < 0.5 ? -1 : 1) * (0.12 + random() * 0.24);
  const laneSpacing = 0.45;
  const center = (laneCount - 1) * 0.5;
  const lanes = Array.from({ length: laneCount }, (_, index) => ({
    offset: (index - center) * laneSpacing,
    speed: 0.72 + random() * 0.58,
    direction: random() < 0.5 ? -1 : 1,
    phase: random() * 11,
    radius: 0.195 + random() * 0.008,
    depth: -1.5 + index * 0.28 + random() * 0.06,
  }));

  return {
    angle,
    waveAmplitude: 0.006,
    maxDynamicDisplacement: 0.0065,
    laneSpacing,
    lanes,
  };
}

export function serpentLanesHaveClearance(field) {
  const lanes = [...field.lanes].sort((a, b) => a.offset - b.offset);
  for (let index = 1; index < lanes.length; index += 1) {
    const previous = lanes[index - 1];
    const current = lanes[index];
    const required = previous.radius + current.radius
      + (field.waveAmplitude + field.maxDynamicDisplacement) * 2;
    if (current.offset - previous.offset <= required) return false;
  }
  return true;
}
