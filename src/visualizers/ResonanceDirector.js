const clamp01 = value => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

function positiveFrequency(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

// One fixed virtual square plate. For an isotropic thin square plate, modal
// frequency ordering follows m² + n². The 18 Hz factor calibrates the virtual
// plate's size/material while keeping the ordering physically consistent.
// Degenerate m/n swaps are represented by the antisymmetric field in the shader.
function createSquarePlateAtlas() {
  const byFrequency = new Map();
  for (let modeX = 1; modeX <= 17; modeX += 1) {
    for (let modeY = modeX + 1; modeY <= 18; modeY += 1) {
      const frequency = 18 * (modeX * modeX + modeY * modeY);
      if (frequency < 70 || frequency > 6000 || byFrequency.has(frequency)) continue;
      byFrequency.set(frequency, { frequency, family: 0, modeX, modeY });
    }
  }
  return [...byFrequency.values()]
    .sort((a, b) => a.frequency - b.frequency)
    .map((mode, index) => ({ ...mode, index }));
}

export const PLATE_MODE_ATLAS = createSquarePlateAtlas();

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

  update(features, delta = 1 / 60, flow = 0.5) {
    const dt = Math.max(1 / 240, Math.min(delta, 0.1));
    const primaryHz = positiveFrequency(
      features.peakHz1,
      positiveFrequency(features.dominantHz, 110),
    );
    const secondaryHz = positiveFrequency(features.peakHz2, primaryHz);
    const structuralSpeed = 0.38 + clamp01(flow) * 0.82;
    const smoothing = 1 - Math.exp(-dt * structuralSpeed);
    if (!this.smoothedHz) this.smoothedHz = primaryHz;
    else this.smoothedHz += (primaryHz - this.smoothedHz) * smoothing;
    if (!this.smoothedSecondaryHz) this.smoothedSecondaryHz = secondaryHz;
    else this.smoothedSecondaryHz += (secondaryHz - this.smoothedSecondaryHz) * smoothing;

    const frequencyRatio = Math.max(this.smoothedHz, this.smoothedSecondaryHz)
      / Math.max(1, Math.min(this.smoothedHz, this.smoothedSecondaryHz));
    const separation = clamp01(Math.log2(Math.max(1, frequencyRatio)) / 1.35);
    const secondaryTarget = clamp01(features.peakStrength2) * separation;
    this.smoothedSecondaryWeight += (secondaryTarget - this.smoothedSecondaryWeight)
      * (1 - Math.exp(-dt * (0.42 + clamp01(flow) * 0.58)));
    const primaryBracket = bracketFrequency(this.smoothedHz);
    const secondaryBracket = bracketFrequency(this.smoothedSecondaryHz);
    const modeA = primaryBracket.a;
    const modeB = primaryBracket.b;
    const modeC = secondaryBracket.a;
    const modeD = secondaryBracket.b;
    const secondaryWeight = clamp01(
      this.smoothedSecondaryWeight * (0.72 + clamp01(features.spread) * 0.28),
    );
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
      instability: clamp01((1 - Math.max(weightA, weightB, weightC, weightD)) * 0.72),
    };
  }
}
