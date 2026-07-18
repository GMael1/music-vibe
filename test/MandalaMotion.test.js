import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMandalaMotionState,
  updateMandalaMotion,
} from '../src/visualizers/MandalaMotion.js';

const blueprint = { symmetryBias: 0.63 };
const dynamics = { energy: 0.55 };
const tempo = { speed: 1, pulse: 0 };

function features(overrides = {}) {
  return {
    peakHz1: 220,
    spectralMid: 0.45,
    spectralHigh: 0.24,
    spread: 0.32,
    tonality: 0.72,
    level: 0.4,
    levelSlow: 0.38,
    relativeLevel: 0.5,
    flux: 0.08,
    onset: 0,
    ...overrides,
  };
}

test('keeps one symmetry identity while vocal harmonics change', () => {
  let state = createMandalaMotionState(blueprint, 220);
  const symmetry = state.symmetry;
  for (const peakHz1 of [220, 440, 880, 330, 1320, 247]) {
    state = updateMandalaMotion(
      state,
      features({ peakHz1 }),
      tempo,
      dynamics,
      0.5,
      1 / 60,
      blueprint,
      220,
    );
    assert.equal(state.symmetry, symmetry);
  }
});

test('turns a sudden harmonic jump into a slow continuous deformation', () => {
  let state = createMandalaMotionState(blueprint, 220);
  for (let frame = 0; frame < 120; frame += 1) {
    state = updateMandalaMotion(state, features(), tempo, dynamics, 0.5, 1 / 60, blueprint, 220);
  }
  const before = state.frequencyShape;
  state = updateMandalaMotion(
    state,
    features({ peakHz1: 1760 }),
    tempo,
    dynamics,
    0.5,
    1 / 60,
    blueprint,
    220,
  );

  assert.ok(state.frequencyShape > before);
  assert.ok(state.frequencyShape - before < 0.025);
});

test('maintains continuous motion through stable sustained audio', () => {
  let state = createMandalaMotionState(blueprint, 330);
  let previousPhase = state.phase;
  let largestVelocityStep = 0;
  for (let frame = 0; frame < 360; frame += 1) {
    const previousVelocity = state.velocity;
    state = updateMandalaMotion(
      state,
      features({ peakHz1: 330, flux: 0 }),
      tempo,
      dynamics,
      0.45,
      1 / 60,
      blueprint,
      330,
    );
    assert.ok(state.phase > previousPhase);
    largestVelocityStep = Math.max(largestVelocityStep, Math.abs(state.velocity - previousVelocity));
    previousPhase = state.phase;
  }

  assert.ok(state.phase > 0.8);
  assert.ok(largestVelocityStep < 0.012);
});

test('makes a sustained frequency change visibly reshape the kaleidoscope', () => {
  let state = createMandalaMotionState(blueprint, 220);
  for (let frame = 0; frame < 60; frame += 1) {
    state = updateMandalaMotion(state, features(), tempo, dynamics, 0.5, 1 / 60, blueprint, 220);
  }
  const before = state.frequencyShape;
  for (let frame = 0; frame < 60; frame += 1) {
    state = updateMandalaMotion(
      state,
      features({ peakHz1: 1760 }),
      tempo,
      dynamics,
      0.5,
      1 / 60,
      blueprint,
      220,
    );
  }

  assert.ok(state.frequencyShape - before > 0.15);
});

test('separates sound-driven shape deformation from rotation speed', () => {
  let state = createMandalaMotionState(blueprint, 220);
  for (let frame = 0; frame < 120; frame += 1) {
    state = updateMandalaMotion(
      state,
      features({
        relativeLevel: 0.04,
        spectralMid: 0.08,
        spectralHigh: 0.03,
        spread: 0.05,
        flux: 0,
      }),
      tempo,
      dynamics,
      0.15,
      1 / 60,
      blueprint,
      220,
    );
  }
  const quietShift = state.shapeShift;
  const phaseBefore = state.phase;
  for (let frame = 0; frame < 90; frame += 1) {
    state = updateMandalaMotion(
      state,
      features({
        relativeLevel: 1,
        spectralMid: 0.85,
        spectralHigh: 0.9,
        spread: 0.8,
        flux: 0.9,
        onset: 1,
      }),
      tempo,
      dynamics,
      0.9,
      1 / 60,
      blueprint,
      220,
    );
  }

  assert.ok(state.shapeShift - quietShift > 0.45);
  assert.ok(state.phase > phaseBefore);
});

test('makes Flow a strong shape-reactivity control', () => {
  const loudFeatures = features({
    relativeLevel: 0.78,
    spectralMid: 0.74,
    spectralHigh: 0.82,
    spread: 0.76,
    flux: 0.7,
    onset: 0.6,
  });
  let still = createMandalaMotionState(blueprint, 220);
  let intense = createMandalaMotionState(blueprint, 220);

  for (let frame = 0; frame < 90; frame += 1) {
    still = updateMandalaMotion(
      still, loudFeatures, tempo, dynamics, 0, 1 / 60, blueprint, 220,
    );
    intense = updateMandalaMotion(
      intense, loudFeatures, tempo, dynamics, 1, 1 / 60, blueprint, 220,
    );
  }

  assert.ok(intense.shapeShift - still.shapeShift > 0.45);
});

test('turns a musical phrase into fast internal morphing without a topology jump', () => {
  let state = createMandalaMotionState(blueprint, 220);
  for (let frame = 0; frame < 90; frame += 1) {
    state = updateMandalaMotion(
      state,
      features({
        peakHz1: 960,
        relativeLevel: 0.86,
        levelFast: 0.94,
        levelSlow: 0.52,
        spectralLow: 0.2,
        spectralMid: 0.78,
        spectralHigh: 0.9,
        flux: 0.7,
        onset: frame % 30 === 0 ? 1 : 0,
        sectionNovelty: 0.72,
      }),
      { speed: 1.08, pulse: frame % 30 < 4 ? 0.9 : 0.05 },
      dynamics,
      0.75,
      1 / 60,
      blueprint,
      220,
    );
  }

  assert.ok(state.musicDrive > 0.65);
  assert.ok(state.frequencyMotion > 0.45);
  assert.ok(state.shapePhase > state.phase * 1.4);
  assert.equal(state.symmetry, createMandalaMotionState(blueprint, 220).symmetry);
});
