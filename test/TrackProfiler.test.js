import assert from 'node:assert/strict';
import test from 'node:test';
import { profileAudioBuffer } from '../src/audio/TrackProfiler.js';

function createSineBuffer(frequency, duration = 2, sampleRate = 48000) {
  const channel = new Float32Array(duration * sampleRate);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.sin((Math.PI * 2 * frequency * i) / sampleRate) * 0.5;
  }
  return {
    duration,
    length: channel.length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData() {
      return channel;
    },
  };
}

test('profiles the stable pitch range of an uploaded track', () => {
  const profile = profileAudioBuffer(createSineBuffer(440));

  assert.ok(profile.frameCount >= 20);
  assert.ok(profile.pitchLowHz > 400 && profile.pitchLowHz < 480);
  assert.ok(profile.pitchHighHz > 400 && profile.pitchHighHz < 480);
  assert.ok(profile.highHz > profile.lowHz);
});
