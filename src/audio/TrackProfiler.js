export const FFT_SIZE = 2048;
export const ANALYSIS_VERSION = 2;

const MIN_FRAMES = 48;
const MAX_FRAMES = 240;
const LOG_BAND_COUNT = 32;
const MIN_FREQUENCY = 30;
const MAX_FREQUENCY = 16000;
const SILENCE_DB = -120;

const clamp01 = value => Math.max(0, Math.min(1, value));

export function percentile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * amount));
  const lower = Math.floor(position);
  const blend = position - lower;
  return sorted[lower] + ((sorted[Math.min(sorted.length - 1, lower + 1)] - sorted[lower]) * blend);
}

function amplitudeToDb(value) {
  return value > 1e-6 ? Math.max(SILENCE_DB, 20 * Math.log10(value)) : SILENCE_DB;
}

function fnv1a(hash, value) {
  hash ^= value;
  return Math.imul(hash, 16777619) >>> 0;
}

export function fingerprintAudioBuffer(audioBuffer) {
  if (!audioBuffer?.length || !audioBuffer?.sampleRate) return 'audio-v2-empty';
  let hashA = 2166136261;
  let hashB = 2246822519;
  const channelCount = Math.max(1, audioBuffer.numberOfChannels ?? 1);
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  const sampleCount = Math.min(16384, audioBuffer.length);
  const stride = Math.max(1, Math.floor(audioBuffer.length / sampleCount));

  for (let index = 0; index < audioBuffer.length; index += stride) {
    let sample = 0;
    for (const channel of channels) sample += channel[index] ?? 0;
    const quantized = Math.round(Math.max(-1, Math.min(1, sample / channelCount)) * 32767);
    hashA = fnv1a(hashA, quantized & 0xff);
    hashA = fnv1a(hashA, (quantized >>> 8) & 0xff);
    hashB = fnv1a(hashB, (quantized ^ index) & 0xff);
  }
  for (const value of [audioBuffer.length, audioBuffer.sampleRate, channelCount, ANALYSIS_VERSION]) {
    hashA = fnv1a(hashA, value & 0xff);
    hashB = fnv1a(hashB, value >>> 8);
  }
  return `audio-v${ANALYSIS_VERSION}-${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
}

export function fftMagnitudes(samples) {
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);

  for (let i = 0; i < FFT_SIZE; i += 1) {
    const window = 0.5 - 0.5 * Math.cos((Math.PI * 2 * i) / (FFT_SIZE - 1));
    real[i] = (samples[i] ?? 0) * window;
  }

  for (let i = 1, j = 0; i < FFT_SIZE; i += 1) {
    let bit = FFT_SIZE >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }

  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const phaseReal = Math.cos(angle);
    const phaseImaginary = Math.sin(angle);
    for (let start = 0; start < FFT_SIZE; start += length) {
      let rotationReal = 1;
      let rotationImaginary = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const even = start + offset;
        const odd = even + length / 2;
        const oddReal = real[odd] * rotationReal - imaginary[odd] * rotationImaginary;
        const oddImaginary = real[odd] * rotationImaginary + imaginary[odd] * rotationReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = rotationReal * phaseReal - rotationImaginary * phaseImaginary;
        rotationImaginary = rotationReal * phaseImaginary + rotationImaginary * phaseReal;
        rotationReal = nextReal;
      }
    }
  }

  const magnitudes = new Float64Array(FFT_SIZE / 2);
  for (let i = 0; i < magnitudes.length; i += 1) magnitudes[i] = Math.hypot(real[i], imaginary[i]);
  return magnitudes;
}

function createLogSpectrum(magnitudes, sampleRate) {
  const spectrum = new Float32Array(LOG_BAND_COUNT);
  const binWidth = sampleRate / FFT_SIZE;
  for (let band = 0; band < LOG_BAND_COUNT; band += 1) {
    const low = MIN_FREQUENCY * Math.pow(MAX_FREQUENCY / MIN_FREQUENCY, band / LOG_BAND_COUNT);
    const high = MIN_FREQUENCY * Math.pow(MAX_FREQUENCY / MIN_FREQUENCY, (band + 1) / LOG_BAND_COUNT);
    const start = Math.max(1, Math.floor(low / binWidth));
    const end = Math.min(magnitudes.length - 1, Math.ceil(high / binWidth));
    let power = 0;
    for (let index = start; index <= end; index += 1) power += magnitudes[index] * magnitudes[index];
    spectrum[band] = Math.sqrt(power / Math.max(1, end - start + 1));
  }
  return spectrum;
}

function analyzeFrame(samples, sampleRate, time) {
  let squareTotal = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    squareTotal += samples[i] * samples[i];
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const rms = Math.sqrt(squareTotal / Math.max(1, samples.length));
  const rmsDb = amplitudeToDb(rms);
  const peakDb = amplitudeToDb(peak);
  const magnitudes = fftMagnitudes(samples);
  const binWidth = sampleRate / FFT_SIZE;
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(MAX_FREQUENCY / binWidth));
  const minBin = Math.max(1, Math.floor(MIN_FREQUENCY / binWidth));
  let total = 0;
  let centroidTotal = 0;
  let dominantBin = minBin;
  let logMagnitude = 0;
  let arithmeticMagnitude = 0;

  for (let i = minBin; i <= maxBin; i += 1) {
    const magnitude = magnitudes[i];
    total += magnitude;
    centroidTotal += magnitude * i * binWidth;
    if (magnitude > magnitudes[dominantBin]) dominantBin = i;
    const safeMagnitude = magnitude + 1e-10;
    logMagnitude += Math.log(safeMagnitude);
    arithmeticMagnitude += safeMagnitude;
  }

  const binCount = Math.max(1, maxBin - minBin + 1);
  const flatness = Math.exp(logMagnitude / binCount) / Math.max(1e-10, arithmeticMagnitude / binCount);
  let lowHz = minBin * binWidth;
  let highHz = maxBin * binWidth;
  if (total > 1e-8) {
    let cumulative = 0;
    let foundLow = false;
    for (let i = minBin; i <= maxBin; i += 1) {
      cumulative += magnitudes[i] / total;
      if (!foundLow && cumulative >= 0.05) {
        lowHz = i * binWidth;
        foundLow = true;
      }
      if (cumulative >= 0.95) {
        highHz = i * binWidth;
        break;
      }
    }
  }

  return {
    time,
    rms,
    rmsDb,
    peakDb,
    lowHz,
    highHz,
    dominantHz: dominantBin * binWidth,
    centroidHz: total > 1e-8 ? centroidTotal / total : 0,
    flatness: clamp01(flatness),
    spectrum: createLogSpectrum(magnitudes, sampleRate),
  };
}

function findPersistentPeaks(frames) {
  const average = new Float64Array(LOG_BAND_COUNT);
  for (const frame of frames) {
    const frameMax = Math.max(1e-10, ...frame.spectrum);
    for (let index = 0; index < LOG_BAND_COUNT; index += 1) average[index] += frame.spectrum[index] / frameMax;
  }
  const candidates = [];
  const maxValue = Math.max(1e-10, ...average);
  for (let index = 1; index < LOG_BAND_COUNT - 1; index += 1) {
    if (average[index] >= average[index - 1] && average[index] >= average[index + 1]) {
      const frequency = MIN_FREQUENCY * Math.pow(MAX_FREQUENCY / MIN_FREQUENCY, (index + 0.5) / LOG_BAND_COUNT);
      candidates.push({ frequency, strength: average[index] / maxValue });
    }
  }
  return candidates.sort((a, b) => b.strength - a.strength).slice(0, 6);
}

function buildTimeline(frames, quietDb, loudDb) {
  const usefulRange = Math.max(8, loudDb - quietDb);
  let previousSpectrum = null;
  return frames.map(frame => {
    let novelty = 0;
    if (previousSpectrum) {
      for (let index = 0; index < frame.spectrum.length; index += 1) {
        const current = frame.spectrum[index];
        const previous = previousSpectrum[index];
        novelty += Math.max(0, current - previous) / Math.max(1e-8, current + previous);
      }
      novelty /= frame.spectrum.length;
    }
    previousSpectrum = frame.spectrum;
    return {
      time: frame.time,
      intensity: clamp01((frame.rmsDb - quietDb) / usefulRange),
      rmsDb: frame.rmsDb,
      dominantHz: frame.dominantHz,
      centroidHz: frame.centroidHz,
      tonality: 1 - frame.flatness,
      novelty: clamp01(novelty * 4),
    };
  });
}

function buildSections(timeline, duration) {
  if (!timeline.length) return [];
  const sectionCount = Math.max(3, Math.min(10, Math.round(duration / 18)));
  const sections = [];
  for (let section = 0; section < sectionCount; section += 1) {
    const startIndex = Math.floor((section / sectionCount) * timeline.length);
    const endIndex = Math.max(startIndex + 1, Math.floor(((section + 1) / sectionCount) * timeline.length));
    const slice = timeline.slice(startIndex, endIndex);
    const intensity = slice.reduce((sum, frame) => sum + frame.intensity, 0) / slice.length;
    const novelty = slice.reduce((sum, frame) => sum + frame.novelty, 0) / slice.length;
    const tonality = slice.reduce((sum, frame) => sum + frame.tonality, 0) / slice.length;
    const label = intensity < 0.18
      ? 'dormant'
      : intensity > 0.78
        ? 'climax'
        : novelty > 0.48
          ? 'transition'
          : tonality > 0.7
            ? 'formation'
            : 'flow';
    sections.push({
      start: (section / sectionCount) * duration,
      end: ((section + 1) / sectionCount) * duration,
      intensity,
      novelty,
      tonality,
      label,
    });
  }
  return sections;
}

export function profileAudioBuffer(audioBuffer) {
  if (!audioBuffer?.length || !audioBuffer?.sampleRate) return null;
  const channelCount = Math.max(1, audioBuffer.numberOfChannels ?? 1);
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  const duration = audioBuffer.duration ?? (audioBuffer.length / audioBuffer.sampleRate);
  const availableStarts = Math.max(1, audioBuffer.length - FFT_SIZE);
  const frameCount = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(duration * 2)));
  const frames = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const progress = frameCount === 1 ? 0 : frame / (frameCount - 1);
    const start = Math.floor(progress * availableStarts);
    const samples = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i += 1) {
      let sample = 0;
      for (let channel = 0; channel < channelCount; channel += 1) sample += channels[channel][start + i] ?? 0;
      samples[i] = sample / channelCount;
    }
    frames.push(analyzeFrame(samples, audioBuffer.sampleRate, progress * duration));
  }

  const rmsValues = frames.map(frame => frame.rmsDb);
  const peakValues = frames.map(frame => frame.peakDb);
  const noiseFloorDb = percentile(rmsValues, 0.05);
  const quietDb = Math.min(-12, percentile(rmsValues, 0.18));
  const loudDb = Math.max(quietDb + 8, percentile(rmsValues, 0.95));
  const activeFrames = frames.filter(frame => frame.rmsDb > Math.max(noiseFloorDb + 6, -72));
  const musicalFrames = activeFrames.length ? activeFrames : frames;
  const lowHz = Math.max(MIN_FREQUENCY, percentile(musicalFrames.map(frame => frame.lowHz), 0.12));
  const medianCentroidHz = percentile(musicalFrames.map(frame => frame.centroidHz), 0.5);
  const highCandidateHz = percentile(musicalFrames.map(frame => frame.highHz), 0.8);
  const highHz = Math.max(lowHz + 160, Math.min(highCandidateHz, Math.max(600, medianCentroidHz * 3.4), 10000));
  const timeline = buildTimeline(frames, quietDb, loudDb);

  return {
    analysisVersion: ANALYSIS_VERSION,
    fingerprint: fingerprintAudioBuffer(audioBuffer),
    duration,
    sampleRate: audioBuffer.sampleRate,
    lowHz,
    highHz,
    pitchLowHz: percentile(musicalFrames.map(frame => frame.dominantHz), 0.06),
    pitchHighHz: percentile(musicalFrames.map(frame => frame.dominantHz), 0.94),
    medianCentroidHz,
    medianRms: Math.pow(10, percentile(rmsValues, 0.5) / 20),
    loudness: {
      noiseFloorDb,
      quietDb,
      medianDb: percentile(rmsValues, 0.5),
      loudDb,
      peakDb: percentile(peakValues, 0.99),
      dynamicRangeDb: Math.max(0, loudDb - quietDb),
    },
    persistentPeaks: findPersistentPeaks(musicalFrames),
    averageTonality: percentile(musicalFrames.map(frame => 1 - frame.flatness), 0.5),
    timeline,
    sections: buildSections(timeline, duration),
    frameCount: frames.length,
  };
}
