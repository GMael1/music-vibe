import assert from 'node:assert/strict';
import test from 'node:test';
import { ResonanceDirector } from '../src/visualizers/ResonanceDirector.js';

const calm = {
  pitch: 0.2,
  absolutePitch: 0.24,
  centroid: 0.3,
  spread: 0.35,
  tonality: 0.82,
  flux: 0.05,
  onset: 0,
  level: 0.5,
};

test('holds a resonance chapter while the sound remains stable', () => {
  const director = new ResonanceDirector('stable');
  const first = director.update(calm, 1 / 60);
  let latest = first;
  for (let i = 0; i < 150; i += 1) latest = director.update(calm, 1 / 60);

  assert.equal(latest.familyA, first.familyA);
  assert.equal(latest.modeAX, first.modeAX);
  assert.equal(latest.mix, 0);
});

test('crossfades to a different family after a meaningful onset', () => {
  const director = new ResonanceDirector('changing');
  for (let i = 0; i < 80; i += 1) director.update(calm, 1 / 60);
  const changing = { ...calm, pitch: 0.86, absolutePitch: 0.79, centroid: 0.74, onset: 1, flux: 0.8 };
  director.update(changing, 1 / 60);
  const transition = director.update({ ...changing, onset: 0 }, 0.2);

  assert.notEqual(transition.familyA, transition.familyB);
  assert.ok(transition.mix > 0 && transition.mix < 1);
});
