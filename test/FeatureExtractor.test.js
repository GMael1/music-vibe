import assert from 'node:assert/strict';
import test from 'node:test';
import { FeatureExtractor } from '../src/audio/FeatureExtractor.js';

function createAnalyser({ bass = 0, treble = 0, amplitude = 0 }) {
  return {
    frequencyBinCount: 1024,
    fftSize: 2048,
    context: { sampleRate: 48000 },
    getByteFrequencyData(array) {
      array.fill(0);
      array.fill(Math.round(bass * 255), 3, 9);
      array.fill(Math.round(treble * 255), 256, 680);
    },
    getByteTimeDomainData(array) {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = 128 + Math.round(Math.sin(i * 0.15) * amplitude * 120);
      }
    },
  };
}

function createAdaptiveAnalyser() {
  const state = { dominantBin: 24 };
  return {
    state,
    frequencyBinCount: 1024,
    fftSize: 2048,
    context: { sampleRate: 48000 },
    getByteFrequencyData(array) {
      array.fill(0);
      array[10] = 100;
      array[24] = state.dominantBin === 24 ? 255 : 110;
      array[42] = state.dominantBin === 42 ? 255 : 110;
      array[56] = 100;
    },
    getByteTimeDomainData(array) {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = 128 + Math.round(Math.sin(i * 0.15) * 48);
      }
    },
  };
}

test('extracts smoothed musical bands and loudness', () => {
  const extractor = new FeatureExtractor();
  const analyser = createAnalyser({ bass: 0.8, treble: 0.08, amplitude: 0.45 });
  let features;

  for (let i = 0; i < 30; i += 1) {
    features = extractor.update(analyser, 1 / 60, 1);
  }

  assert.ok(features.bass > 0.65);
  assert.ok(features.bass > features.treble);
  assert.ok(features.level > 0.4);
  assert.ok(features.centroid >= 0 && features.centroid <= 1);
});

test('releases smoothly instead of snapping to silence', () => {
  const extractor = new FeatureExtractor();
  const loud = createAnalyser({ bass: 0.9, amplitude: 0.5 });
  const silent = createAnalyser({});

  for (let i = 0; i < 20; i += 1) extractor.update(loud, 1 / 60, 1);
  const beforeRelease = extractor.values.bass;
  const afterRelease = extractor.update(silent, 1 / 60, 1).bass;

  assert.ok(afterRelease > 0);
  assert.ok(afterRelease < beforeRelease);
});

test('maps dominant frequencies across each track active range', () => {
  const extractor = new FeatureExtractor();
  const analyser = createAdaptiveAnalyser();

  for (let i = 0; i < 50; i += 1) extractor.update(analyser, 1 / 60, 1);
  const lowerPitch = extractor.values.pitch;
  const lowerAbsolutePitch = extractor.values.absolutePitch;
  analyser.state.dominantBin = 42;
  for (let i = 0; i < 28; i += 1) extractor.update(analyser, 1 / 60, 1);
  const higherPitch = extractor.values.pitch;
  const higherAbsolutePitch = extractor.values.absolutePitch;

  assert.ok(lowerPitch < 0.45);
  assert.ok(higherPitch > 0.58);
  assert.ok(higherPitch - lowerPitch > 0.25);
  assert.ok(higherAbsolutePitch > lowerAbsolutePitch);
  assert.ok(extractor.values.tonality > 0.4);
});

test('normalizes dB against an uploaded track quiet and loud range', () => {
  const profile = {
    lowHz: 80,
    highHz: 4000,
    pitchLowHz: 100,
    pitchHighHz: 1200,
    loudness: { noiseFloorDb: -80, quietDb: -48, loudDb: -12 },
  };
  const extractor = new FeatureExtractor(profile);
  const analyser = createAnalyser({ bass: 0.8, amplitude: 0.12 });
  let features;
  for (let i = 0; i < 30; i += 1) features = extractor.update(analyser, 1 / 60, 1);

  assert.ok(features.levelDb < -12 && features.levelDb > -48);
  assert.ok(features.relativeLevel > 0 && features.relativeLevel < 1);
  assert.ok(features.presence > 0.5);
});
