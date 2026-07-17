const clamp01 = value => Math.max(0, Math.min(1, value));

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPOSITIONS = ['centered-altar', 'orbital-drift', 'deep-field', 'mirrored-gate'];
const DORMANT_PATTERNS = ['ember-lines', 'silver-dust', 'subsurface-glow'];

export function createVisualBlueprint(profile, style = 'default') {
  const fingerprint = profile?.fingerprint ?? 'audio-v2-live';
  const numericSeed = hashSeed(`${fingerprint}:${style}:blueprint-v1`);
  const random = createRandom(numericSeed);
  const dynamicRange = profile?.loudness?.dynamicRangeDb ?? 18;
  const tonality = profile?.averageTonality ?? 0.5;
  const peakCount = profile?.persistentPeaks?.length ?? 0;

  return {
    version: 1,
    fingerprint,
    seed: numericSeed,
    composition: COMPOSITIONS[Math.floor(random() * COMPOSITIONS.length)],
    dormantPattern: DORMANT_PATTERNS[Math.floor(random() * DORMANT_PATTERNS.length)],
    symmetryBias: 0.35 + random() * 0.5,
    cameraDrift: 0.035 + random() * 0.055,
    turbulenceBias: 0.75 + random() * 0.35,
    particlePhase: random() * Math.PI * 2,
    palettePhase: random(),
    definitionBias: clamp01(0.42 + tonality * 0.35 + random() * 0.14),
    dynamicGain: clamp01(0.35 + dynamicRange / 36),
    densityBias: clamp01(0.48 + peakCount * 0.045 + random() * 0.12),
    sections: profile?.sections ?? [],
  };
}
