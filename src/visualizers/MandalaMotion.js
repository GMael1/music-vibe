const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function damp(current, target, delta, speed) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = Number.isFinite(target) ? target : safeCurrent;
  return safeCurrent + (safeTarget - safeCurrent) * (1 - Math.exp(-speed * delta));
}

export function normalizeMandalaFrequency(frequency) {
  const safeFrequency = Math.max(55, Number.isFinite(frequency) ? frequency : 220);
  return clamp01(Math.log(safeFrequency / 55) / Math.log(5000 / 55));
}

export function createMandalaMotionState(blueprint, profileFrequency = 220) {
  const symmetryBias = clamp01(blueprint?.symmetryBias ?? 0.5);
  return {
    phase: 0,
    velocity: 0.16,
    frequencyShape: normalizeMandalaFrequency(profileFrequency),
    formBlend: 0.42,
    shapeShift: 0.25,
    pulseEnvelope: 0,
    symmetry: 5 + Math.round(symmetryBias * 3),
  };
}

export function updateMandalaMotion(
  previous,
  features,
  tempo,
  dynamics,
  flow,
  delta,
  blueprint,
  profileFrequency = 220,
) {
  const dt = Math.max(1 / 240, Math.min(Number.isFinite(delta) ? delta : 1 / 60, 0.1));
  const state = previous ?? createMandalaMotionState(blueprint, profileFrequency);
  const energy = clamp01(dynamics?.energy ?? 0.5);
  const journeyFlow = clamp01(flow ?? 0.5);
  const liveFrequency = Number.isFinite(features?.peakHz1) && features.peakHz1 >= 40
    ? features.peakHz1
    : profileFrequency;
  const frequencyTarget = normalizeMandalaFrequency(liveFrequency);
  const formTarget = clamp01(
    (features?.spectralMid ?? 0) * 0.38
      + (features?.spectralHigh ?? 0) * 0.26
      + (features?.spread ?? 0) * 0.2
      + (features?.tonality ?? 0.5) * 0.16,
  );
  const tempoSpeed = Number.isFinite(tempo?.speed) ? tempo.speed : 1;
  const velocityTarget = Math.max(0.075, tempoSpeed * (
    0.105
      + (features?.levelSlow ?? features?.level ?? 0) * 0.16
      + (features?.relativeLevel ?? features?.level ?? 0) * 0.09
      + (features?.spectralMid ?? 0) * 0.055
      + (features?.spectralHigh ?? 0) * 0.045
      + (features?.flux ?? 0) * 0.025
  ) * (0.72 + journeyFlow * 0.72));
  const pulseTarget = clamp01((features?.onset ?? 0) * 0.38 + (tempo?.pulse ?? 0) * 0.16);
  const shapeShiftTarget = clamp01((
    (features?.relativeLevel ?? features?.level ?? 0) * 0.28
      + (features?.spectralMid ?? 0) * 0.16
      + (features?.spectralHigh ?? 0) * 0.18
      + (features?.spread ?? 0) * 0.12
      + (features?.flux ?? 0) * 0.18
      + (features?.onset ?? 0) * 0.08
  ) * (0.34 + journeyFlow * 1.66));

  const frequencyShape = damp(
    state.frequencyShape,
    frequencyTarget,
    dt,
    0.72 + journeyFlow * 0.86,
  );
  const formBlend = damp(state.formBlend, formTarget, dt, 0.68 + energy * 0.9);
  const velocity = damp(
    state.velocity,
    velocityTarget,
    dt,
    velocityTarget > state.velocity ? 1.35 : 0.58,
  );
  const pulseEnvelope = damp(
    state.pulseEnvelope,
    pulseTarget,
    dt,
    pulseTarget > state.pulseEnvelope ? 3.4 : 1.05,
  );
  const shapeShift = damp(
    state.shapeShift,
    shapeShiftTarget,
    dt,
    shapeShiftTarget > state.shapeShift
      ? 0.8 + journeyFlow * 3.2
      : 0.3 + journeyFlow * 1.1,
  );

  return {
    phase: state.phase + velocity * dt,
    velocity,
    frequencyShape,
    formBlend,
    shapeShift,
    pulseEnvelope,
    symmetry: state.symmetry,
  };
}
