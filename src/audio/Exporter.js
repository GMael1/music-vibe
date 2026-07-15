import { globalMixer } from './Mixer.js';

export const DEFAULT_EXPORT_PROFILE = Object.freeze({
  frameRate: 30,
  videoBitsPerSecond: 24_000_000,
  audioBitsPerSecond: 192_000,
});

export function getRecorderMimeTypes(hasAudio) {
  if (hasAudio) {
    return [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm',
    ];
  }

  return [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm',
  ];
}

function getSupportedMimeTypes(MediaRecorderClass, hasAudio) {
  const candidates = getRecorderMimeTypes(hasAudio);
  if (typeof MediaRecorderClass.isTypeSupported !== 'function') return candidates;
  return candidates.filter(mimeType => MediaRecorderClass.isTypeSupported(mimeType));
}

export class VideoExporter {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedMimeType = '';
    this.isRecording = false;
    this.audioDestination = null;
    this.combinedStream = null;
    this.onComplete = null;
    this.onError = null;
  }

  startRecording(canvas, options = {}) {
    if (this.isRecording) return false;
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') {
      throw new Error('Video recording is not supported by this browser.');
    }

    this.recordedChunks = [];
    this.onComplete = options.onComplete ?? null;
    this.onError = options.onError ?? null;

    try {
      const frameRate = options.frameRate ?? DEFAULT_EXPORT_PROFILE.frameRate;
      const canvasStream = canvas.captureStream(frameRate);

      // Route the mixed output into the recording without changing speaker output.
      let audioStream;
      if (globalMixer.context) {
        if (this.audioDestination) this.disconnectAudioDestination();

        this.audioDestination = globalMixer.context.createMediaStreamDestination();
        globalMixer.masterGain.connect(this.audioDestination);

        // Live input intentionally bypasses masterGain to avoid speaker feedback.
        const liveTrack = globalMixer.tracks.get('live');
        if (liveTrack?.source) liveTrack.source.connect(this.audioDestination);

        audioStream = this.audioDestination.stream;
      }

      const tracks = [...canvasStream.getVideoTracks()];
      if (audioStream) tracks.push(...audioStream.getAudioTracks());

      this.combinedStream = new MediaStream(tracks);
      const hasAudio = this.combinedStream.getAudioTracks().length > 0;
      const supportedMimeTypes = getSupportedMimeTypes(MediaRecorder, hasAudio);

      // isTypeSupported() is only advisory: Firefox and Safari versions can still
      // reject a valid-looking audio/video combination when start() is called.
      // Try every advertised combination, then let the browser choose as a fallback.
      const attempts = [...supportedMimeTypes, ''];
      let lastError;

      for (const mimeType of attempts) {
        const recorderOptions = {
          videoBitsPerSecond: options.videoBitsPerSecond
            ?? DEFAULT_EXPORT_PROFILE.videoBitsPerSecond,
        };
        if (hasAudio) {
          recorderOptions.audioBitsPerSecond = options.audioBitsPerSecond
            ?? DEFAULT_EXPORT_PROFILE.audioBitsPerSecond;
        }
        if (mimeType) recorderOptions.mimeType = mimeType;

        try {
          const recorder = new MediaRecorder(this.combinedStream, recorderOptions);
          this.attachRecorder(recorder, mimeType);
          recorder.start(options.timeslice ?? 1000);
          this.mediaRecorder = recorder;
          this.recordedMimeType = recorder.mimeType || mimeType || 'video/webm';
          this.isRecording = true;
          return true;
        } catch (error) {
          lastError = error;
          this.mediaRecorder = null;
        }
      }

      throw lastError ?? new Error('No supported video recording format was found.');
    } catch (error) {
      this.cleanupRecordingResources();
      throw error;
    }
  }

  attachRecorder(recorder, requestedMimeType) {
    let failed = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordedChunks.push(event.data);
    };

    recorder.onstop = () => {
      if (failed) return;
      if (this.recordedChunks.length === 0) {
        this.isRecording = false;
        this.cleanupRecordingResources();
        this.onError?.(new Error('Recording stopped before any video data was produced.'));
        return;
      }

      this.downloadVideo();
      this.isRecording = false;
      this.cleanupRecordingResources();
      this.onComplete?.({ mimeType: recorder.mimeType || requestedMimeType });
    };

    recorder.onerror = (event) => {
      failed = true;
      this.isRecording = false;
      this.recordedChunks = [];
      this.cleanupRecordingResources();
      this.onError?.(event.error ?? new Error('Recording failed.'));
    };
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  disconnectAudioDestination() {
    if (!this.audioDestination) return;
    try { globalMixer.masterGain?.disconnect(this.audioDestination); } catch {}
    const liveTrack = globalMixer.tracks.get('live');
    if (liveTrack?.source) {
      try { liveTrack.source.disconnect(this.audioDestination); } catch {}
    }
    this.audioDestination = null;
  }

  cleanupRecordingResources() {
    this.disconnectAudioDestination();
    this.combinedStream?.getTracks().forEach(track => track.stop());
    this.combinedStream = null;
    this.mediaRecorder = null;
  }

  downloadVideo() {
    const mimeType = this.recordedMimeType || 'video/webm';
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = `AudioViz_Export_${Date.now()}.${extension}`;
    a.click();
    a.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    this.recordedChunks = [];
  }
}

export const globalExporter = new VideoExporter();
