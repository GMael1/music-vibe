export const FFT_SIZE = 2048;
const MAX_FRAMES = 120;

function percentile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * amount))];
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
  for (let i = 0; i < magnitudes.length; i += 1) {
    magnitudes[i] = Math.hypot(real[i], imaginary[i]);
  }
  return magnitudes;
}

function analyzeFrame(samples, sampleRate) {
  let rmsTotal = 0;
  for (let i = 0; i < samples.length; i += 1) rmsTotal += samples[i] * samples[i];
  const rms = Math.sqrt(rmsTotal / Math.max(1, samples.length));
  if (rms < 0.0025) return null;

  const magnitudes = fftMagnitudes(samples);
  const binWidth = sampleRate / FFT_SIZE;
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(16000 / binWidth));
  const minBin = Math.max(1, Math.floor(35 / binWidth));
  let total = 0;
  let centroidTotal = 0;
  let dominantBin = minBin;

  for (let i = minBin; i <= maxBin; i += 1) {
    const magnitude = magnitudes[i];
    total += magnitude;
    centroidTotal += magnitude * i * binWidth;
    if (magnitude > magnitudes[dominantBin]) dominantBin = i;
  }
  if (total <= 0) return null;

  let cumulative = 0;
  let lowHz = minBin * binWidth;
  let highHz = maxBin * binWidth;
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

  return {
    rms,
    lowHz,
    highHz,
    dominantHz: dominantBin * binWidth,
    centroidHz: centroidTotal / total,
  };
}

export function profileAudioBuffer(audioBuffer) {
  if (!audioBuffer?.length || !audioBuffer?.sampleRate) return null;
  const channelCount = Math.max(1, audioBuffer.numberOfChannels ?? 1);
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  const availableStarts = Math.max(1, audioBuffer.length - FFT_SIZE);
  const frameCount = Math.min(MAX_FRAMES, Math.max(24, Math.floor((audioBuffer.duration ?? 0) * 1.2)));
  const frames = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = Math.floor((frame / Math.max(1, frameCount - 1)) * availableStarts);
    const samples = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i += 1) {
      let sample = 0;
      for (let channel = 0; channel < channelCount; channel += 1) {
        sample += channels[channel][start + i] ?? 0;
      }
      samples[i] = sample / channelCount;
    }
    const analysis = analyzeFrame(samples, audioBuffer.sampleRate);
    if (analysis) frames.push(analysis);
  }

  if (!frames.length) return null;
  const lowHz = Math.max(25, percentile(frames.map(frame => frame.lowHz), 0.12));
  const medianCentroidHz = percentile(frames.map(frame => frame.centroidHz), 0.5);
  const highCandidateHz = percentile(frames.map(frame => frame.highHz), 0.75);
  const highHz = Math.max(lowHz + 160, Math.min(highCandidateHz, medianCentroidHz * 3.2, 8000));
  return {
    lowHz,
    highHz,
    pitchLowHz: percentile(frames.map(frame => frame.dominantHz), 0.08),
    pitchHighHz: percentile(frames.map(frame => frame.dominantHz), 0.92),
    medianCentroidHz,
    medianRms: percentile(frames.map(frame => frame.rms), 0.5),
    frameCount: frames.length,
  };
}
