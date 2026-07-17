function validFrequency(value) {
  return Number.isFinite(value) && value >= 40 ? value : 0;
}

function geometricMix(a, b, mix) {
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * mix);
}

export function getPlateCalibrationScale(profile) {
  const lowHz = validFrequency(profile?.pitchLowHz);
  const highHz = validFrequency(profile?.pitchHighHz);
  if (!lowHz || !highHz || highHz <= lowHz) return 1;
  const trackCenter = Math.sqrt(lowHz * highHz);
  const targetPlateCenter = 520;
  return Math.max(0.55, Math.min(6, targetPlateCenter / trackCenter));
}

export function getPlateFrequencyFeatures(features, trackJourney = {}, profile) {
  const detectedLivePrimary = validFrequency(features.peakHz1)
    || validFrequency(features.dominantHz);
  const livePrimary = detectedLivePrimary || 110;
  const analyzedPrimary = validFrequency(trackJourney.dominantHz);
  const sourcePrimaryHz = analyzedPrimary && detectedLivePrimary
    ? geometricMix(analyzedPrimary, livePrimary, 0.42)
    : analyzedPrimary || livePrimary;
  const liveSecondary = validFrequency(features.peakHz2) || livePrimary;
  const frequencyRatio = Math.max(sourcePrimaryHz, liveSecondary)
    / Math.max(1, Math.min(sourcePrimaryHz, liveSecondary));
  const secondaryIsDistinct = frequencyRatio >= 1.16;
  const plateCalibration = getPlateCalibrationScale(profile);

  return {
    ...features,
    peakHz1: sourcePrimaryHz * plateCalibration,
    peakHz2: (secondaryIsDistinct ? liveSecondary : sourcePrimaryHz) * plateCalibration,
    peakStrength2: secondaryIsDistinct ? (features.peakStrength2 ?? 0) : 0,
    plateCalibration,
    sourcePrimaryHz,
  };
}
