import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseOfflineExportFormat,
  getOfflineExportDuration,
} from '../src/audio/OfflineExporter.js';

test('uses the longest synchronized track as the offline export duration', () => {
  assert.equal(getOfflineExportDuration([
    { buffer: { duration: 3.25 } },
    { buffer: { duration: 8.5 } },
    { buffer: { duration: 4 } },
  ]), 8.5);
});

test('falls back from MP4 to VP9 and Opus WebM when AVC is unavailable', async () => {
  const format = await chooseOfflineExportFormat({
    width: 1920,
    height: 1080,
    sampleRate: 48000,
    channelCount: 2,
    supportsVideo: async codec => codec === 'vp9',
    supportsAudio: async codec => codec === 'opus',
  });

  assert.deepEqual(format, {
    extension: 'webm',
    videoCodec: 'vp9',
    audioCodec: 'opus',
  });
});

test('reports no format when the browser has no compatible audio/video pair', async () => {
  const format = await chooseOfflineExportFormat({
    width: 1080,
    height: 1920,
    sampleRate: 48000,
    channelCount: 2,
    supportsVideo: async () => false,
    supportsAudio: async () => false,
  });

  assert.equal(format, null);
});
