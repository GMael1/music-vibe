import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineAnalyser } from '../src/audio/OfflineAnalyser.js';

function createAudioBuffer({ frequency = 440, duration = 1, sampleRate = 48000 }) {
  const samples = new Float32Array(Math.round(duration * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * frequency * Math.PI * 2) * 0.7;
  }
  return {
    duration,
    sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    getChannelData() { return samples; },
  };
}

test('produces deterministic FFT data at an explicit audio timestamp', () => {
  const analyser = new OfflineAnalyser(createAudioBuffer({ frequency: 440 }));
  const spectrum = new Uint8Array(analyser.frequencyBinCount);

  analyser.setTime(0.5);
  analyser.getByteFrequencyData(spectrum);
  const dominantBin = spectrum.reduce(
    (best, value, index) => value > spectrum[best] ? index : best,
    1,
  );
  const dominantHz = dominantBin * analyser.context.sampleRate / analyser.fftSize;

  // Matches AnalyserNode's default -30 dB ceiling, which can saturate adjacent FFT bins.
  assert.ok(Math.abs(dominantHz - 440) < 50, `expected approximately 440 Hz, received ${dominantHz}`);
  assert.ok(spectrum[dominantBin] > 220);
});

test('returns silence before the start and after the end of a track', () => {
  const analyser = new OfflineAnalyser(createAudioBuffer({ duration: 0.1 }));
  const timeData = new Uint8Array(analyser.frequencyBinCount);

  analyser.setTime(1);
  analyser.getByteTimeDomainData(timeData);

  assert.ok(timeData.every(value => value === 128));
});
