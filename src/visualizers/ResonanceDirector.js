const clamp01 = value => Math.max(0, Math.min(1, value));

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

// A compact, ordered atlas of resonant plate modes. Frequency always selects the
// topology; the seed only changes the presentation of equivalent orientations.
export const PLATE_MODE_ATLAS = [
  [78, 0, 2, 3], [112, 1, 2, 4], [148, 0, 3, 4], [184, 2, 2, 5],
  [224, 0, 3, 5], [270, 3, 4, 5], [322, 1, 3, 6], [382, 0, 4, 6],
  [450, 2, 5, 6], [528, 0, 4, 7], [616, 4, 5, 7], [716, 1, 6, 7],
  [830, 0, 5, 8], [958, 2, 6, 8], [1102, 0, 7, 8], [1264, 3, 6, 9],
  [1446, 1, 7, 9], [1650, 0, 8, 9], [1878, 4, 7, 10], [2134, 2, 8, 10],
  [2422, 0, 9, 10], [2746, 3, 8, 11], [3110, 1, 9, 11], [3520, 0, 10, 11],
  [3980, 4, 9, 12], [4496, 2, 10, 12], [5080, 0, 11, 12], [5740, 3, 10, 13],
].map(([frequency, family, modeX, modeY], index) => ({
  frequency,
  family,
  modeX,
  modeY,
  index,
}));

function bracketFrequency(frequency) {
  const safeFrequency = Math.max(PLATE_MODE_ATLAS[0].frequency, frequency || PLATE_MODE_ATLAS[0].frequency);
  const last = PLATE_MODE_ATLAS.length - 1;
  if (safeFrequency >= PLATE_MODE_ATLAS[last].frequency) {
    return { a: PLATE_MODE_ATLAS[last - 1], b: PLATE_MODE_ATLAS[last], mix: 1 };
  }
  for (let index = 0; index < last; index += 1) {
    const a = PLATE_MODE_ATLAS[index];
    const b = PLATE_MODE_ATLAS[index + 1];
    if (safeFrequency <= b.frequency) {
      const mix = (
        Math.log(safeFrequency) - Math.log(a.frequency)
      ) / Math.max(1e-6, Math.log(b.frequency) - Math.log(a.frequency));
      return { a, b, mix: clamp01(mix) };
    }
  }
  return { a: PLATE_MODE_ATLAS[last - 1], b: PLATE_MODE_ATLAS[last], mix: 1 };
}

export class ResonanceDirector {
  constructor(seed = 'resonance') {
    this.seed = hashString(seed);
    this.smoothedHz = 0;
    this.smoothedSecondaryHz = 0;
    this.smoothedSecondaryWeight = 0;
  }

  update(features, delta = 1 / 60) {
    const dt = Math.max(1 / 240, Math.min(delta, 0.1));
    const primaryHz = features.peakHz1 || features.dominantHz || 110;
    const secondaryHz = features.peakHz2 || primaryHz;
    const smoothing = 1 - Math.exp(-dt * 7);
    if (!this.smoothedHz) this.smoothedHz = primaryHz;
    else this.smoothedHz += (primaryHz - this.smoothedHz) * smoothing;
    if (!this.smoothedSecondaryHz) this.smoothedSecondaryHz = secondaryHz;
    else this.smoothedSecondaryHz += (secondaryHz - this.smoothedSecondaryHz) * smoothing;

    const frequencyRatio = Math.max(this.smoothedHz, this.smoothedSecondaryHz)
      / Math.max(1, Math.min(this.smoothedHz, this.smoothedSecondaryHz));
    const separation = clamp01(Math.log2(Math.max(1, frequencyRatio)) / 1.35);
    const secondaryTarget = (features.peakStrength2 ?? 0) * separation;
    this.smoothedSecondaryWeight += (secondaryTarget - this.smoothedSecondaryWeight)
      * (1 - Math.exp(-dt * 3.2));
    const primaryBracket = bracketFrequency(this.smoothedHz);
    const secondaryBracket = bracketFrequency(this.smoothedSecondaryHz);
    const modeA = primaryBracket.a;
    const modeB = primaryBracket.b;
    const modeC = secondaryBracket.a;
    const modeD = secondaryBracket.b;
    const secondaryWeight = clamp01(this.smoothedSecondaryWeight * (0.72 + (features.spread ?? 0) * 0.28));
    const primaryWeight = 1 - secondaryWeight;
    const weights = [
      primaryWeight * (1 - primaryBracket.mix),
      primaryWeight * primaryBracket.mix,
      secondaryWeight * (1 - secondaryBracket.mix),
      secondaryWeight * secondaryBracket.mix,
    ];
    const weightTotal = Math.max(1e-6, weights.reduce((total, weight) => total + weight, 0));
    const [weightA, weightB, weightC, weightD] = weights.map(weight => weight / weightTotal);
    const orientation = (this.seed - 0.5) * 0.28;

    const describeMode = mode => ({
      family: mode.family,
      modeX: mode.modeX,
      modeY: mode.modeY,
      rotation: orientation + (mode.index % 3 - 1) * 0.035,
      seed: (this.seed + mode.index * 0.173) % 1,
      frequency: mode.frequency,
    });
    const a = describeMode(modeA);
    const b = describeMode(modeB);
    const c = describeMode(modeC);
    const d = describeMode(modeD);

    return {
      familyA: a.family,
      familyB: b.family,
      familyC: c.family,
      familyD: d.family,
      modeAX: a.modeX,
      modeAY: a.modeY,
      modeBX: b.modeX,
      modeBY: b.modeY,
      modeCX: c.modeX,
      modeCY: c.modeY,
      modeDX: d.modeX,
      modeDY: d.modeY,
      rotationA: a.rotation,
      rotationB: b.rotation,
      rotationC: c.rotation,
      rotationD: d.rotation,
      seedA: a.seed,
      seedB: b.seed,
      seedC: c.seed,
      seedD: d.seed,
      weightA,
      weightB,
      weightC,
      weightD,
      mix: primaryBracket.mix,
      modeFrequencyA: a.frequency,
      modeFrequencyB: b.frequency,
      modeFrequencyC: c.frequency,
      modeFrequencyD: d.frequency,
      instability: clamp01(1 - Math.max(weightA, weightB, weightC, weightD)),
    };
  }
}
