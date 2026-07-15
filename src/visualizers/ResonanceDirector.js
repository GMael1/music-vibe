const clamp01 = value => Math.max(0, Math.min(1, value));
const fract = value => value - Math.floor(value);

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function snapshot(features) {
  return {
    pitch: features.pitch ?? 0.5,
    absolutePitch: features.absolutePitch ?? features.pitch ?? 0.5,
    centroid: features.centroid ?? 0.5,
    spread: features.spread ?? 0.5,
    tonality: features.tonality ?? 0.5,
  };
}

export class ResonanceDirector {
  constructor(seed = 'resonance') {
    this.seed = hashString(seed);
    this.sequence = 0;
    this.current = null;
    this.target = null;
    this.anchor = null;
    this.chapterAge = 0;
    this.transitionTime = 0;
    this.transitionDuration = 1;
  }

  makeChapter(features, forceNewFamily = false) {
    const relativePitch = features.pitch ?? 0.5;
    const absolutePitch = features.absolutePitch ?? relativePitch;
    const centroid = features.centroid ?? 0.5;
    const spread = features.spread ?? 0.5;
    const tonality = features.tonality ?? 0.5;
    const signature = absolutePitch * 2.71
      + relativePitch * 1.83
      + centroid * 1.37
      + spread * 1.11
      + (1 - tonality) * 1.59
      + this.seed * 2.13
      + this.sequence * 0.6180339;
    let family = Math.floor(fract(signature) * 5);
    if (forceNewFamily && this.current && family === this.current.family) {
      family = (family + 1 + Math.floor(spread * 3)) % 5;
    }

    const modeX = 2 + Math.floor(clamp01(absolutePitch * 0.58 + relativePitch * 0.42) * 8);
    let modeY = 2 + Math.floor(clamp01(centroid * 0.58 + spread * 0.42) * 9);
    if (modeY === modeX) modeY = Math.min(12, modeY + 1 + (family % 2));

    return {
      family,
      modeX,
      modeY,
      rotation: (fract(signature * 1.73 + tonality) - 0.5) * 1.15,
      seed: fract(signature * 4.19 + this.sequence * 0.37),
    };
  }

  changeScore(features) {
    if (!this.anchor) return 1;
    return Math.abs((features.pitch ?? 0.5) - this.anchor.pitch) * 1.4
      + Math.abs((features.absolutePitch ?? 0.5) - this.anchor.absolutePitch) * 1.8
      + Math.abs((features.centroid ?? 0.5) - this.anchor.centroid) * 0.8
      + Math.abs((features.spread ?? 0.5) - this.anchor.spread) * 0.65
      + Math.abs((features.tonality ?? 0.5) - this.anchor.tonality) * 0.55;
  }

  startTransition(features, energy = 1) {
    this.sequence += 1;
    this.target = this.makeChapter(features, true);
    this.transitionTime = 0;
    const calm = 1 - clamp01(energy);
    this.transitionDuration = 0.72 + calm * 3.8
      + (1 - (features.flux ?? 0)) * (0.4 + calm * 0.7);
  }

  update(features, delta = 1 / 60, energy = 1) {
    const dt = Math.max(0, Math.min(delta, 0.1));
    const journeyEnergy = clamp01(energy);
    if (!this.current) {
      this.current = this.makeChapter(features);
      this.anchor = snapshot(features);
    }

    if (this.target) {
      this.transitionTime += dt;
      const mix = clamp01(this.transitionTime / this.transitionDuration);
      const output = this.output(mix);
      if (mix >= 1) {
        this.current = this.target;
        this.target = null;
        this.anchor = snapshot(features);
        this.chapterAge = 0;
        this.transitionTime = 0;
      }
      return output;
    }

    this.chapterAge += dt;
    const changeScore = this.changeScore(features);
    const strongOnset = (features.onset ?? 0) > 0.72;
    const hasSignal = (features.level ?? 0) > 0.035;
    const musicalHold = 2.8 - journeyEnergy * 1.75;
    const phraseHold = 7.2 - journeyEnergy * 3.8;
    const maximumHoldTime = 13 - journeyEnergy * 7.8;
    const musicalChange = this.chapterAge > musicalHold && strongOnset
      && changeScore > 0.2 + (1 - journeyEnergy) * 0.08;
    const phraseChange = this.chapterAge > phraseHold && hasSignal
      && changeScore > 0.16 + (1 - journeyEnergy) * 0.06;
    const maximumHold = this.chapterAge > maximumHoldTime && hasSignal;
    if (musicalChange || phraseChange || maximumHold) {
      this.startTransition(features, journeyEnergy);
    }

    return this.output(0);
  }

  output(mix) {
    const target = this.target ?? this.current;
    return {
      familyA: this.current.family,
      familyB: target.family,
      modeAX: this.current.modeX,
      modeAY: this.current.modeY,
      modeBX: target.modeX,
      modeBY: target.modeY,
      rotationA: this.current.rotation,
      rotationB: target.rotation,
      seedA: this.current.seed,
      seedB: target.seed,
      mix,
    };
  }
}
