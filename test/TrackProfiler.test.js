import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintAudioBuffer, profileAudioBuffer } from '../src/audio/TrackProfiler.js';
import { createVisualBlueprint } from '../src/audio/VisualBlueprint.js';

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
  assert.ok(profile.loudness.loudDb > profile.loudness.quietDb);
  assert.ok(profile.timeline.length >= 48);
  assert.ok(profile.persistentPeaks.length > 0);
});

test('generates a repeatable content fingerprint and visual blueprint', () => {
  const buffer = createSineBuffer(330);
  const profileA = profileAudioBuffer(buffer);
  const profileB = profileAudioBuffer(buffer);
  const blueprintA = createVisualBlueprint(profileA, 'chladni');
  const blueprintB = createVisualBlueprint(profileB, 'chladni');

  assert.equal(fingerprintAudioBuffer(buffer), profileA.fingerprint);
  assert.equal(profileA.fingerprint, profileB.fingerprint);
  assert.deepEqual(blueprintA, blueprintB);
});
