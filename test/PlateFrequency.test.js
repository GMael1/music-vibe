import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPlateCalibrationScale,
  getPlateFrequencyFeatures,
} from '../src/visualizers/PlateFrequency.js';

test('uses the uploaded track timeline to make plate frequency deterministic', () => {
  const features = {
    dominantHz: 220,
    peakHz1: 220,
    peakHz2: 660,
    peakStrength2: 0.4,
  };
  const result = getPlateFrequencyFeatures(features, { dominantHz: 440 });

  assert.ok(result.peakHz1 > 220 && result.peakHz1 < 440);
  assert.equal(result.peakHz2, 660);
  assert.equal(result.peakStrength2, 0.4);
});

test('does not invent a second mode when both peaks describe the same tone', () => {
  const result = getPlateFrequencyFeatures({
    dominantHz: 220,
    peakHz1: 220,
    peakHz2: 232,
    peakStrength2: 0.5,
  });

  assert.equal(result.peakHz2, result.peakHz1);
  assert.equal(result.peakStrength2, 0);
});

test('uses analyzed frequency directly when the live analyser is silent', () => {
  const result = getPlateFrequencyFeatures({ peakHz1: 0, dominantHz: 0 }, { dominantHz: 784 });
  assert.equal(result.peakHz1, 784);
});

test('calibrates one virtual plate to the uploaded track without changing frequency ratios', () => {
  const profile = { pitchLowHz: 60, pitchHighHz: 1200 };
  const scale = getPlateCalibrationScale(profile);
  const low = getPlateFrequencyFeatures({ peakHz1: 60 }, {}, profile);
  const high = getPlateFrequencyFeatures({ peakHz1: 1200 }, {}, profile);

  assert.ok(scale > 1);
  assert.equal(low.plateCalibration, high.plateCalibration);
  assert.ok(Math.abs(high.peakHz1 / low.peakHz1 - 20) < 1e-9);
  assert.ok(low.peakHz1 >= 90);
});
