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
    shapePhase: 0,
    musicDrive: 0.18,
    frequencyMotion: 0,
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
  const frequencyDistance = Math.abs(frequencyTarget - state.frequencyShape);
  const relativeLevel = clamp01(features?.relativeLevel ?? features?.level ?? 0);
  const levelFast = clamp01(features?.levelFast ?? relativeLevel);
  const levelSlow = clamp01(features?.levelSlow ?? relativeLevel);
  const levelContrast = Math.max(0, levelFast - levelSlow);
  const spectralLow = clamp01(features?.spectralLow ?? 0);
  const spectralMid = clamp01(features?.spectralMid ?? 0);
  const spectralHigh = clamp01(features?.spectralHigh ?? 0);
  const spectralContrast = Math.abs(spectralLow - spectralMid) * 0.55
    + Math.abs(spectralMid - spectralHigh) * 0.45;
  const frequencyMotionTarget = clamp01(
    frequencyDistance * 2.4
      + (features?.flux ?? 0) * 1.15
      + (features?.sectionNovelty ?? 0) * 0.7,
  );
  const musicDriveTarget = clamp01(
    0.08
      + relativeLevel * 0.2
      + levelContrast * 1.45
      + (features?.flux ?? 0) * 0.9
      + (features?.onset ?? 0) * 0.72
      + (tempo?.pulse ?? 0) * 0.34
      + frequencyMotionTarget * 0.36
      + spectralContrast * 0.18,
  );
  const formTarget = clamp01(
    (features?.spectralMid ?? 0) * 0.38
      + (features?.spectralHigh ?? 0) * 0.26
      + (features?.spread ?? 0) * 0.2
      + (features?.tonality ?? 0.5) * 0.16,
  );
  const tempoSpeed = Number.isFinite(tempo?.speed) ? tempo.speed : 1;
  const velocityTarget = Math.max(0.075, tempoSpeed * (
    0.24
      + levelSlow * 0.14
      + relativeLevel * 0.1
      + spectralMid * 0.07
      + spectralHigh * 0.06
      + musicDriveTarget * 0.36
  ) * (0.28 + journeyFlow * 1.32));
  const pulseTarget = clamp01(
    (features?.onset ?? 0) * 0.62
      + (tempo?.pulse ?? 0) * 0.34
      + levelContrast * 0.82,
  );
  const shapeShiftTarget = clamp01((
    relativeLevel * 0.22
      + spectralMid * 0.13
      + spectralHigh * 0.14
      + (features?.spread ?? 0) * 0.12
      + musicDriveTarget * 0.31
      + frequencyMotionTarget * 0.2
  ) * (0.34 + journeyFlow * 1.66));

  const frequencyShape = damp(
    state.frequencyShape,
    frequencyTarget,
    dt,
    1.2 + journeyFlow * 2.3,
  );
  const formBlend = damp(state.formBlend, formTarget, dt, 1.25 + energy * 1.8);
  const frequencyMotion = damp(
    state.frequencyMotion,
    frequencyMotionTarget,
    dt,
    frequencyMotionTarget > state.frequencyMotion ? 7.5 : 1.8,
  );
  const musicDrive = damp(
    state.musicDrive,
    musicDriveTarget,
    dt,
    musicDriveTarget > state.musicDrive
      ? 6.5 + journeyFlow * 5.5
      : 1.15 + journeyFlow * 2.1,
  );
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
    shapePhase: state.shapePhase + tempoSpeed * dt * (
      0.08
        + musicDrive * (0.14 + journeyFlow * 2.3)
        + frequencyMotion * (0.08 + journeyFlow * 0.8)
    ),
    velocity,
    frequencyShape,
    formBlend,
    shapeShift,
    musicDrive,
    frequencyMotion,
    pulseEnvelope,
    symmetry: state.symmetry,
  };
}
