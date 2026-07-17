import assert from 'node:assert/strict';
import test from 'node:test';
import { ResonanceDirector } from '../src/visualizers/ResonanceDirector.js';

function tone(frequency, overrides = {}) {
  return {
    dominantHz: frequency,
    peakHz1: frequency,
    peakHz2: frequency,
    peakStrength1: 1,
    peakStrength2: 0,
    spread: 0.1,
    ...overrides,
  };
}

test('holds a resonance mode while the frequency remains stable', () => {
  const director = new ResonanceDirector('stable');
  const first = director.update(tone(440), 1 / 60);
  let latest = first;
  for (let i = 0; i < 150; i += 1) latest = director.update(tone(440), 1 / 60);

  assert.equal(latest.familyA, first.familyA);
  assert.equal(latest.modeAX, first.modeAX);
  assert.equal(latest.modeAY, first.modeAY);
});

test('maps separated frequencies to clearly different plate topologies', () => {
  const lowDirector = new ResonanceDirector('same-plate');
  const highDirector = new ResonanceDirector('same-plate');
  const low = lowDirector.update(tone(220), 1 / 60);
  const high = highDirector.update(tone(1760), 1 / 60);

  assert.notDeepEqual([low.familyA, low.modeAX, low.modeAY], [high.familyA, high.modeAX, high.modeAY]);
});

test('blends neighboring modes continuously while hovering between resonances', () => {
  const director = new ResonanceDirector('sweep');
  const transition = director.update(tone(420), 1 / 60);

  assert.ok(transition.mix > 0 && transition.mix < 1);
  assert.ok(transition.instability > 0);
});

test('allows two strong separated peaks to coexist', () => {
  const director = new ResonanceDirector('two-tone');
  const result = director.update(tone(220, {
    peakHz2: 880,
    peakStrength1: 0.58,
    peakStrength2: 0.42,
    spread: 0.7,
  }), 1 / 60);

  assert.notDeepEqual([result.familyA, result.modeAX, result.modeAY], [result.familyC, result.modeCX, result.modeCY]);
  assert.ok(result.weightC + result.weightD > 0);
  assert.ok(Math.abs(result.weightA + result.weightB + result.weightC + result.weightD - 1) < 1e-6);
});

test('keeps topology independent from dB intensity', () => {
  const quietDirector = new ResonanceDirector('level-independent');
  const loudDirector = new ResonanceDirector('level-independent');
  const quiet = quietDirector.update(tone(440, { level: 0.08, relativeLevel: 0.05 }), 1 / 60);
  const loud = loudDirector.update(tone(440, { level: 1, relativeLevel: 1 }), 1 / 60);

  assert.deepEqual(
    [quiet.familyA, quiet.modeAX, quiet.modeAY, quiet.familyB, quiet.modeBX, quiet.modeBY,
      quiet.weightA, quiet.weightB, quiet.weightC, quiet.weightD],
    [loud.familyA, loud.modeAX, loud.modeAY, loud.familyB, loud.modeBX, loud.modeBY,
      loud.weightA, loud.weightB, loud.weightC, loud.weightD],
  );
});

test('keeps modal energy continuous across resonance atlas boundaries', () => {
  const below = new ResonanceDirector('continuous-boundary').update(tone(449.9), 1 / 60);
  const above = new ResonanceDirector('continuous-boundary').update(tone(450.1), 1 / 60);
  const toWeightMap = result => [
    [result.modeFrequencyA, result.weightA],
    [result.modeFrequencyB, result.weightB],
    [result.modeFrequencyC, result.weightC],
    [result.modeFrequencyD, result.weightD],
  ].reduce((weights, [frequency, weight]) => {
    weights.set(frequency, (weights.get(frequency) ?? 0) + weight);
    return weights;
  }, new Map());
  const belowWeights = toWeightMap(below);
  const aboveWeights = toWeightMap(above);
  const frequencies = new Set([...belowWeights.keys(), ...aboveWeights.keys()]);
  const difference = [...frequencies].reduce((total, frequency) => (
    total + Math.abs((belowWeights.get(frequency) ?? 0) - (aboveWeights.get(frequency) ?? 0))
  ), 0);

  assert.ok(difference < 0.02);
});
