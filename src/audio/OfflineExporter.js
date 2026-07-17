import {
  AudioBufferSource as EncodedAudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { OfflineAnalyser } from './OfflineAnalyser.js';
import { VisualizerEngine } from '../visualizers/Engine.js';

export const OFFLINE_EXPORT_PROFILE = Object.freeze({
  frameRate: 30,
  videoBitsPerSecond: 32_000_000,
  audioBitsPerSecond: 256_000,
  keyFrameInterval: 2,
});

const EXPORT_CANDIDATES = [
  { extension: 'mp4', videoCodec: 'avc', audioCodec: 'aac' },
  { extension: 'webm', videoCodec: 'vp9', audioCodec: 'opus' },
  { extension: 'webm', videoCodec: 'vp8', audioCodec: 'opus' },
];

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
}

export function getOfflineExportDuration(tracks) {
  return tracks.reduce((duration, track) => Math.max(duration, track.buffer?.duration ?? 0), 0);
}

export async function chooseOfflineExportFormat({
  width,
  height,
  sampleRate,
  channelCount,
  supportsVideo = canEncodeVideo,
  supportsAudio = canEncodeAudio,
}) {
  for (const candidate of EXPORT_CANDIDATES) {
    try {
      const [videoSupported, audioSupported] = await Promise.all([
        supportsVideo(candidate.videoCodec, {
          width,
          height,
          bitrate: OFFLINE_EXPORT_PROFILE.videoBitsPerSecond,
          latencyMode: 'quality',
        }),
        supportsAudio(candidate.audioCodec, {
          sampleRate,
          numberOfChannels: channelCount,
          bitrate: OFFLINE_EXPORT_PROFILE.audioBitsPerSecond,
        }),
      ]);
      if (videoSupported && audioSupported) return candidate;
    } catch {
      // Continue to the next container/codec pair.
    }
  }
  return null;
}

export async function renderMixedAudio(tracks, duration, signal) {
  throwIfAborted(signal);
  const OfflineAudioContextClass = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
  if (!OfflineAudioContextClass) throw new Error('Offline audio rendering is not supported by this browser.');

  const sampleRate = 48_000;
  const channelCount = Math.min(2, Math.max(
    1,
    ...tracks.map(track => track.buffer?.numberOfChannels ?? 1),
  ));
  const context = new OfflineAudioContextClass(
    channelCount,
    Math.max(1, Math.ceil(duration * sampleRate)),
    sampleRate,
  );

  for (const track of tracks) {
    if (!track.buffer) continue;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = track.buffer;
    gain.gain.value = track.volume ?? 1;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(0);
  }

  const mixedBuffer = await context.startRendering();
  throwIfAborted(signal);
  return mixedBuffer;
}

function createOutputFormat(extension) {
  return extension === 'mp4'
    ? new Mp4OutputFormat({ fastStart: false })
    : new WebMOutputFormat();
}

function downloadBuffer(buffer, mimeType, extension) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = `AudioViz_HighQuality_${Date.now()}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class OfflineVideoExporter {
  constructor() {
    this.isExporting = false;
    this.output = null;
  }

  async export({ tracks, width, height, signal, onProgress = () => {} }) {
    if (this.isExporting) throw new Error('A high-quality export is already running.');
    const duration = getOfflineExportDuration(tracks);
    if (!duration) throw new Error('Add an audio track before exporting.');

    this.isExporting = true;
    let engine;
    try {
      onProgress(0.01, 'mixing');
      const mixedAudio = await renderMixedAudio(tracks, duration, signal);
      const format = await chooseOfflineExportFormat({
        width,
        height,
        sampleRate: mixedAudio.sampleRate,
        channelCount: mixedAudio.numberOfChannels,
      });
      throwIfAborted(signal);
      if (!format) {
        throw new Error('This browser cannot encode a compatible high-quality video and audio format.');
      }

      const canvas = document.createElement('canvas');
      engine = new VisualizerEngine(canvas, { preserveDrawingBuffer: true });
      engine.setExportResolution(width, height, OFFLINE_EXPORT_PROFILE.frameRate);
      engine.updateTracks(tracks, 'multi', 'livingMandala');

      const analysers = new Map(
        tracks
          .filter(track => track.buffer)
          .map(track => [track.id, new OfflineAnalyser(track.buffer)]),
      );
      const target = new BufferTarget();
      this.output = new Output({
        format: createOutputFormat(format.extension),
        target,
      });
      const videoSource = new CanvasSource(canvas, {
        codec: format.videoCodec,
        bitrate: OFFLINE_EXPORT_PROFILE.videoBitsPerSecond,
        bitrateMode: 'variable',
        latencyMode: 'quality',
        hardwareAcceleration: 'no-preference',
        keyFrameInterval: OFFLINE_EXPORT_PROFILE.keyFrameInterval,
        alpha: 'discard',
      });
      const audioSource = new EncodedAudioBufferSource({
        codec: format.audioCodec,
        bitrate: OFFLINE_EXPORT_PROFILE.audioBitsPerSecond,
        bitrateMode: 'variable',
      });
      const frameRate = OFFLINE_EXPORT_PROFILE.frameRate;
      const frameCount = Math.ceil(duration * frameRate);
      this.output.addVideoTrack(videoSource, {
        frameRate,
        maximumPacketCount: frameCount,
      });
      this.output.addAudioTrack(audioSource);
      await this.output.start();

      onProgress(0.04, 'rendering');
      const encodeFrames = async () => {
        for (let frame = 0; frame < frameCount; frame += 1) {
          throwIfAborted(signal);
          const timestamp = frame / frameRate;
          const frameDuration = Math.min(1 / frameRate, duration - timestamp);
          for (const analyser of analysers.values()) analyser.setTime(timestamp);
          engine.renderOfflineFrame(timestamp, 1 / frameRate, id => analysers.get(id) ?? null);
          await videoSource.add(timestamp, frameDuration, {
            keyFrame: frame % (frameRate * OFFLINE_EXPORT_PROFILE.keyFrameInterval) === 0,
          });
          onProgress(0.04 + ((frame + 1) / frameCount) * 0.92, 'rendering');
        }
      };

      await Promise.all([
        audioSource.add(mixedAudio),
        encodeFrames(),
      ]);
      throwIfAborted(signal);
      onProgress(0.97, 'finalizing');
      await this.output.finalize();

      const buffer = target.buffer;
      if (!buffer?.byteLength) throw new Error('The encoder produced an empty video file.');
      const mimeType = await this.output.getMimeType();
      downloadBuffer(buffer, mimeType, format.extension);
      onProgress(1, 'complete');
      return {
        byteLength: buffer.byteLength,
        extension: format.extension,
        mimeType,
        videoCodec: format.videoCodec,
        audioCodec: format.audioCodec,
      };
    } catch (error) {
      if (this.output && !['canceled', 'finalized'].includes(this.output.state)) {
        try { await this.output.cancel(); } catch {}
      }
      throw error;
    } finally {
      engine?.dispose();
      this.output = null;
      this.isExporting = false;
    }
  }
}

export const globalOfflineExporter = new OfflineVideoExporter();
