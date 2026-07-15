import assert from 'node:assert/strict';
import test from 'node:test';
import { getRecorderMimeTypes, VideoExporter } from '../src/audio/Exporter.js';

test('declares both video and audio codecs for WebM streams with audio', () => {
  const mimeTypes = getRecorderMimeTypes(true);

  assert.ok(mimeTypes.includes('video/webm;codecs=vp9,opus'));
  assert.ok(mimeTypes.includes('video/webm;codecs=vp8,opus'));
  assert.ok(!mimeTypes.includes('video/webm;codecs=vp8'));
});

test('retries recorder startup when an advertised codec fails at start', () => {
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaStream = globalThis.MediaStream;
  const videoTrack = { stop() {} };
  const attemptedMimeTypes = [];

  class MockMediaStream {
    constructor(tracks) {
      this.tracks = tracks;
    }

    getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
    getTracks() { return this.tracks; }
  }

  class MockMediaRecorder {
    static isTypeSupported() { return true; }

    constructor(stream, options) {
      this.stream = stream;
      this.mimeType = options.mimeType ?? 'video/webm';
      attemptedMimeTypes.push(this.mimeType);
    }

    start() {
      if (this.mimeType.includes('vp9')) throw new Error('codec rejected at start');
    }
  }

  globalThis.MediaStream = MockMediaStream;
  globalThis.MediaRecorder = MockMediaRecorder;

  try {
    const exporter = new VideoExporter();
    const canvas = {
      captureStream(frameRate) {
        assert.equal(frameRate, 30);
        return new MockMediaStream([{ ...videoTrack, kind: 'video' }]);
      },
    };

    assert.equal(exporter.startRecording(canvas), true);
    assert.deepEqual(attemptedMimeTypes.slice(0, 2), [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
    ]);
    assert.equal(exporter.recordedMimeType, 'video/webm;codecs=vp8');
    exporter.cleanupRecordingResources();
  } finally {
    globalThis.MediaRecorder = originalMediaRecorder;
    globalThis.MediaStream = originalMediaStream;
  }
});

test('reports an error instead of success when recording produces no data', () => {
  const exporter = new VideoExporter();
  const recorder = { mimeType: 'video/webm' };
  let completed = false;
  let receivedError;
  exporter.onComplete = () => { completed = true; };
  exporter.onError = error => { receivedError = error; };

  exporter.attachRecorder(recorder, 'video/webm');
  recorder.onstop();

  assert.equal(completed, false);
  assert.match(receivedError.message, /before any video data/);
});
