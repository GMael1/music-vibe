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
  assert.ok(state.frequencyShape - before < 0.01);
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
  assert.ok(largestVelocityStep < 0.01);
});
