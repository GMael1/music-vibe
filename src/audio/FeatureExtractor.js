const BAND_RANGES = {
  sub: [20, 60],
  bass: [60, 180],
  lowMid: [180, 500],
  mid: [500, 2000],
  highMid: [2000, 6000],
  treble: [6000, 16000],
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function smooth(current, target, delta, attack, release) {
  const speed = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

export class FeatureExtractor {
  constructor(profile = null) {
    this.profile = profile;
    this.frequencyData = null;
    this.frequencyDb = null;
    this.timeData = null;
    this.timeFloat = null;
    this.previousSpectrum = null;
    this.bandPeaks = Object.fromEntries(Object.keys(BAND_RANGES).map((key) => [key, 0.12]));
    this.activeLowHz = profile?.lowHz ?? null;
    this.activeHighHz = profile?.highHz ?? null;
    this.values = {
      sub: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
      spectralLow: 0,
      spectralMid: 0,
      spectralHigh: 0,
      level: 0,
      levelDb: -120,
      relativeLevel: 0,
      levelFast: 0,
      levelSlow: 0,
      presence: 0,
      centroid: 0.5,
      pitch: 0.5,
      absolutePitch: 0.3,
      dominantHz: 0,
      peakHz1: 0,
      peakHz2: 0,
      peakStrength1: 0,
      peakStrength2: 0,
      spread: 0,
      tonality: 0.5,
      flux: 0,
      beat: 0,
      onset: 0,
    };
    this.fluxAverage = 0.015;
    this.onsetCooldown = 0;
  }

  ensureBuffers(analyser) {
    const size = analyser.frequencyBinCount;
    if (!this.frequencyData || this.frequencyData.length !== size) {
      this.frequencyData = new Float32Array(size);
      this.frequencyDb = new Float32Array(size);
      this.timeData = new Uint8Array(size);
      this.timeFloat = new Float32Array(size);
      this.previousSpectrum = new Float32Array(size);
    }
  }

  readAnalyser(analyser) {
    if (typeof analyser.getFloatFrequencyData === 'function') {
      analyser.getFloatFrequencyData(this.frequencyDb);
      for (let i = 0; i < this.frequencyData.length; i += 1) {
        const db = Number.isFinite(this.frequencyDb[i]) ? this.frequencyDb[i] : -120;
        this.frequencyData[i] = clamp01((db + 100) / 80);
      }
    } else {
      const bytes = new Uint8Array(this.frequencyData.length);
      analyser.getByteFrequencyData(bytes);
      const minimum = analyser.minDecibels ?? -100;
      const maximum = analyser.maxDecibels ?? -30;
      for (let i = 0; i < bytes.length; i += 1) {
        const db = minimum + (bytes[i] / 255) * (maximum - minimum);
        this.frequencyDb[i] = db;
        this.frequencyData[i] = bytes[i] / 255;
      }
    }

    if (typeof analyser.getFloatTimeDomainData === 'function') {
      analyser.getFloatTimeDomainData(this.timeFloat);
    } else {
      analyser.getByteTimeDomainData(this.timeData);
      for (let i = 0; i < this.timeData.length; i += 1) {
        this.timeFloat[i] = (this.timeData[i] - 128) / 128;
      }
    }
  }

  getBandEnergy(analyser, minHz, maxHz) {
    const binWidth = analyser.context.sampleRate / analyser.fftSize;
    const start = Math.max(1, Math.floor(minHz / binWidth));
    const end = Math.min(this.frequencyData.length - 1, Math.ceil(maxHz / binWidth));
    let total = 0;

    for (let i = start; i <= end; i += 1) total += this.frequencyData[i];
    return total / Math.max(1, end - start + 1);
  }

  updateAdaptiveRange(frameLowHz, frameHighHz, delta) {
    if (this.profile) return;
    if (this.activeLowHz === null || this.activeHighHz === null) {
      this.activeLowHz = frameLowHz;
      this.activeHighHz = Math.max(frameLowHz + 120, frameHighHz);
      return;
    }

    const lowSpeed = frameLowHz < this.activeLowHz ? 5 : 0.28;
    const highSpeed = frameHighHz > this.activeHighHz ? 5 : 0.28;
    this.activeLowHz = smooth(this.activeLowHz, frameLowHz, delta, lowSpeed, lowSpeed);
    this.activeHighHz = smooth(this.activeHighHz, frameHighHz, delta, highSpeed, highSpeed);
    this.activeHighHz = Math.max(this.activeLowHz + 120, this.activeHighHz);
  }

  update(analyser, delta = 1 / 60, sensitivity = 1) {
    this.ensureBuffers(analyser);
    this.readAnalyser(analyser);

    const dt = Math.max(1 / 240, Math.min(delta, 0.1));
    const next = {};

    for (const [name, [minHz, maxHz]] of Object.entries(BAND_RANGES)) {
      const raw = this.getBandEnergy(analyser, minHz, maxHz);
      this.bandPeaks[name] = Math.max(raw, this.bandPeaks[name] * Math.exp(-0.45 * dt), 0.08);
      const normalized = clamp01((raw / this.bandPeaks[name]) * sensitivity);
      next[name] = smooth(this.values[name], normalized, dt, 14, 4.5);
    }

    let rmsTotal = 0;
    for (let i = 0; i < this.timeFloat.length; i += 1) {
      const sample = this.timeFloat[i];
      rmsTotal += sample * sample;
    }
    const rms = Math.sqrt(rmsTotal / this.timeFloat.length);
    const levelDb = rms > 1e-6 ? Math.max(-120, 20 * Math.log10(rms)) : -120;
    const quietDb = this.profile?.loudness?.quietDb ?? -60;
    const loudDb = Math.max(quietDb + 8, this.profile?.loudness?.loudDb ?? -12);
    const relativeLevel = clamp01((levelDb - quietDb) / (loudDb - quietDb));
    const absoluteLevel = clamp01((levelDb + 72) / 60);
    const calibratedLevel = this.profile ? relativeLevel : absoluteLevel;
    next.levelDb = levelDb;
    next.relativeLevel = smooth(this.values.relativeLevel, relativeLevel, dt, 16, 3.2);
    next.levelFast = smooth(this.values.levelFast, calibratedLevel, dt, 22, 7);
    next.levelSlow = smooth(this.values.levelSlow, calibratedLevel, dt, 2.2, 0.75);
    next.level = smooth(this.values.level, clamp01(calibratedLevel * sensitivity), dt, 12, 3.5);
    next.presence = smooth(
      this.values.presence,
      clamp01((levelDb - (this.profile?.loudness?.noiseFloorDb ?? -82) + 3) / 15),
      dt,
      9,
      1.4,
    );

    const binWidth = analyser.context.sampleRate / analyser.fftSize;
    const maxBin = Math.min(this.frequencyData.length - 1, Math.ceil(16000 / binWidth));
    let magnitudeTotal = 0;
    let weightedFrequency = 0;
    let positiveFlux = 0;
    let dominantBin = 1;

    for (let i = 1; i <= maxBin; i += 1) {
      const magnitude = this.frequencyData[i];
      magnitudeTotal += magnitude;
      weightedFrequency += i * binWidth * magnitude;
      positiveFlux += Math.max(0, magnitude - this.previousSpectrum[i]);
      if (magnitude > this.frequencyData[dominantBin]) dominantBin = i;
      this.previousSpectrum[i] = magnitude;
    }

    if (magnitudeTotal > 0.01) {
      let cumulative = 0;
      let frameLowHz = binWidth;
      let frameHighHz = maxBin * binWidth;
      let foundLow = false;
      for (let i = 1; i <= maxBin; i += 1) {
        cumulative += this.frequencyData[i] / magnitudeTotal;
        if (!foundLow && cumulative >= 0.05) {
          frameLowHz = i * binWidth;
          foundLow = true;
        }
        if (cumulative >= 0.95) {
          frameHighHz = i * binWidth;
          break;
        }
      }

      this.updateAdaptiveRange(frameLowHz, frameHighHz, dt);
      const activeWidth = Math.max(120, this.activeHighHz - this.activeLowHz);
      const centroidHz = weightedFrequency / magnitudeTotal;
      const dominantHz = dominantBin * binWidth;
      const peakCandidates = [];
      for (let i = Math.max(2, Math.floor(35 / binWidth)); i < maxBin - 1; i += 1) {
        const magnitude = this.frequencyData[i];
        if (magnitude >= this.frequencyData[i - 1] && magnitude > this.frequencyData[i + 1]) {
          peakCandidates.push({ bin: i, magnitude });
        }
      }
      peakCandidates.sort((a, b) => b.magnitude - a.magnitude);
      const primaryPeak = peakCandidates[0] ?? { bin: dominantBin, magnitude: this.frequencyData[dominantBin] };
      const secondaryPeak = peakCandidates.find(candidate => (
        Math.abs(candidate.bin - primaryPeak.bin) * binWidth > Math.max(70, primaryPeak.bin * binWidth * 0.16)
      )) ?? primaryPeak;
      const peakTotal = Math.max(1e-10, primaryPeak.magnitude + secondaryPeak.magnitude);
      const relativeCentroid = clamp01((centroidHz - this.activeLowHz) / activeWidth);
      const pitchLowHz = this.profile?.pitchLowHz ?? this.activeLowHz;
      const pitchHighHz = Math.max(pitchLowHz + 80, this.profile?.pitchHighHz ?? this.activeHighHz);
      const relativePitch = clamp01((dominantHz - pitchLowHz) / (pitchHighHz - pitchLowHz));
      const absolutePitch = clamp01(Math.log2(Math.max(55, dominantHz) / 55) / Math.log2(4000 / 55));
      const relativeSpread = clamp01((frameHighHz - frameLowHz) / activeWidth);
      next.centroid = smooth(this.values.centroid, relativeCentroid, dt, 5.5, 4);
      next.pitch = smooth(this.values.pitch, relativePitch, dt, 4.5, 4.5);
      next.absolutePitch = smooth(this.values.absolutePitch, absolutePitch, dt, 5.5, 5.5);
      next.dominantHz = dominantHz;
      next.peakHz1 = smooth(this.values.peakHz1 || primaryPeak.bin * binWidth, primaryPeak.bin * binWidth, dt, 8, 8);
      next.peakHz2 = smooth(this.values.peakHz2 || secondaryPeak.bin * binWidth, secondaryPeak.bin * binWidth, dt, 6, 6);
      next.peakStrength1 = smooth(this.values.peakStrength1, primaryPeak.magnitude / peakTotal, dt, 10, 4);
      next.peakStrength2 = smooth(this.values.peakStrength2, secondaryPeak.magnitude / peakTotal, dt, 10, 4);
      next.spread = smooth(this.values.spread, relativeSpread, dt, 5, 3);

      const tonalityStart = Math.max(1, Math.floor(frameLowHz / binWidth));
      const tonalityEnd = Math.min(maxBin, Math.ceil(frameHighHz / binWidth));
      let logMagnitude = 0;
      let arithmeticMagnitude = 0;
      let tonalityBins = 0;
      for (let i = tonalityStart; i <= tonalityEnd; i += 1) {
        const magnitude = this.frequencyData[i] + 0.000001;
        logMagnitude += Math.log(magnitude);
        arithmeticMagnitude += magnitude;
        tonalityBins += 1;
      }
      const flatness = tonalityBins > 0
        ? Math.exp(logMagnitude / tonalityBins) / (arithmeticMagnitude / tonalityBins)
        : 1;
      next.tonality = smooth(this.values.tonality, 1 - clamp01(flatness), dt, 4, 3);

      const safeLow = Math.max(25, this.activeLowHz);
      const safeHigh = Math.max(safeLow * 1.6, this.activeHighHz);
      const logStep = (Math.log(safeHigh) - Math.log(safeLow)) / 3;
      const lowEnd = Math.exp(Math.log(safeLow) + logStep);
      const midEnd = Math.exp(Math.log(safeLow) + logStep * 2);
      const relativeBands = [
        this.getBandEnergy(analyser, safeLow, lowEnd),
        this.getBandEnergy(analyser, lowEnd, midEnd),
        this.getBandEnergy(analyser, midEnd, safeHigh),
      ];
      const relativePeak = Math.max(0.02, ...relativeBands);
      next.spectralLow = smooth(this.values.spectralLow, clamp01(relativeBands[0] / relativePeak), dt, 10, 4);
      next.spectralMid = smooth(this.values.spectralMid, clamp01(relativeBands[1] / relativePeak), dt, 10, 4);
      next.spectralHigh = smooth(this.values.spectralHigh, clamp01(relativeBands[2] / relativePeak), dt, 10, 4);
    } else {
      next.centroid = this.values.centroid;
      next.pitch = this.values.pitch;
      next.absolutePitch = this.values.absolutePitch;
      next.dominantHz = this.values.dominantHz;
      next.peakHz1 = this.values.peakHz1;
      next.peakHz2 = this.values.peakHz2;
      next.peakStrength1 = smooth(this.values.peakStrength1, 0, dt, 8, 2);
      next.peakStrength2 = smooth(this.values.peakStrength2, 0, dt, 8, 2);
      next.spread = smooth(this.values.spread, 0, dt, 5, 3);
      next.tonality = smooth(this.values.tonality, 0.5, dt, 4, 3);
      next.spectralLow = smooth(this.values.spectralLow, 0, dt, 10, 4);
      next.spectralMid = smooth(this.values.spectralMid, 0, dt, 10, 4);
      next.spectralHigh = smooth(this.values.spectralHigh, 0, dt, 10, 4);
    }

    const flux = positiveFlux / Math.max(1, maxBin);
    this.fluxAverage = smooth(this.fluxAverage, flux, dt, 2.5, 1.2);
    this.onsetCooldown = Math.max(0, this.onsetCooldown - dt);
    const onset = this.onsetCooldown === 0
      && flux > Math.max(0.008, this.fluxAverage * 1.6)
      && next.level > 0.045;

    if (onset) {
      this.onsetCooldown = 0.11;
      next.beat = 1;
      next.onset = 1;
    } else {
      next.beat = Math.max(0, this.values.beat - dt * 3.8);
      next.onset = Math.max(0, this.values.onset - dt * 8);
    }

    next.flux = smooth(this.values.flux, clamp01(flux * 24), dt, 12, 5);
    this.values = next;
    return this.values;
  }
}
