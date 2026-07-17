import { FFT_SIZE, fftMagnitudes } from './TrackProfiler.js';

const MIN_DECIBELS = -100;
const MAX_DECIBELS = -30;
const HANN_COHERENT_GAIN = 0.5;

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export class OfflineAnalyser {
  constructor(audioBuffer) {
    this.audioBuffer = audioBuffer;
    this.fftSize = FFT_SIZE;
    this.frequencyBinCount = FFT_SIZE / 2;
    this.context = { sampleRate: audioBuffer.sampleRate };
    this.minDecibels = MIN_DECIBELS;
    this.maxDecibels = MAX_DECIBELS;
    this.channels = Array.from(
      { length: Math.max(1, audioBuffer.numberOfChannels ?? 1) },
      (_, index) => audioBuffer.getChannelData(index),
    );
    this.window = new Float64Array(FFT_SIZE);
    this.spectrum = new Uint8Array(this.frequencyBinCount);
    this.spectrumDb = new Float32Array(this.frequencyBinCount);
    this.endSample = 0;
    this.spectrumDirty = true;
  }

  setTime(time) {
    const nextEndSample = Math.max(0, Math.round(time * this.audioBuffer.sampleRate));
    if (nextEndSample === this.endSample) return;
    this.endSample = nextEndSample;
    this.spectrumDirty = true;
  }

  sampleAt(index) {
    if (index < 0 || index >= this.audioBuffer.length) return 0;
    let sample = 0;
    for (const channel of this.channels) sample += channel[index] ?? 0;
    return sample / this.channels.length;
  }

  fillWindow() {
    const start = this.endSample - FFT_SIZE;
    for (let index = 0; index < FFT_SIZE; index += 1) {
      this.window[index] = this.sampleAt(start + index);
    }
  }

  updateSpectrum() {
    if (!this.spectrumDirty) return;
    this.fillWindow();
    const magnitudes = fftMagnitudes(this.window);
    const referenceMagnitude = FFT_SIZE * HANN_COHERENT_GAIN * 0.5;
    const decibelRange = MAX_DECIBELS - MIN_DECIBELS;

    for (let index = 0; index < this.spectrum.length; index += 1) {
      const normalized = Math.max(1e-10, magnitudes[index] / referenceMagnitude);
      const decibels = 20 * Math.log10(normalized);
      this.spectrumDb[index] = Math.max(MIN_DECIBELS, Math.min(MAX_DECIBELS, decibels));
      this.spectrum[index] = clampByte(((decibels - MIN_DECIBELS) / decibelRange) * 255);
    }
    this.spectrumDirty = false;
  }

  getByteFrequencyData(array) {
    this.updateSpectrum();
    array.set(this.spectrum.subarray(0, array.length));
    if (array.length > this.spectrum.length) array.fill(0, this.spectrum.length);
  }

  getFloatFrequencyData(array) {
    this.updateSpectrum();
    array.set(this.spectrumDb.subarray(0, array.length));
    if (array.length > this.spectrumDb.length) array.fill(MIN_DECIBELS, this.spectrumDb.length);
  }

  getByteTimeDomainData(array) {
    const start = this.endSample - array.length;
    for (let index = 0; index < array.length; index += 1) {
      array[index] = clampByte(128 + this.sampleAt(start + index) * 128);
    }
  }

  getFloatTimeDomainData(array) {
    const start = this.endSample - array.length;
    for (let index = 0; index < array.length; index += 1) array[index] = this.sampleAt(start + index);
  }
}
