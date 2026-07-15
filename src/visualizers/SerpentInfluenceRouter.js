import * as THREE from 'three';
import { globalMixer } from '../audio/Mixer.js';
import { FeatureExtractor } from '../audio/FeatureExtractor.js';

export const SERPENT_ROLES = ['motion', 'skin', 'energy', 'light', 'atmosphere', 'accent'];
const MAP_SIZE = 64;
const SILENCE = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  spectralLow: 0,
  spectralMid: 0,
  spectralHigh: 0,
  level: 0,
  flux: 0,
  onset: 0,
  centroid: 0.5,
};

const clamp01 = value => Math.max(0, Math.min(1, value));

function smoothChannel(currentByte, target, dt) {
  const current = currentByte / 255;
  const speed = target > current ? 3.1 : 1.25;
  return Math.round((current + (target - current) * (1 - Math.exp(-speed * dt))) * 255);
}

function circularDistance(a, b) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 1 - distance);
}

function roleWeights(role) {
  const weights = { motion: 0.16, skin: 0.16, energy: 0.16, light: 0.14 };
  if (role === 'balanced') return { motion: 0.72, skin: 0.72, energy: 0.72, light: 0.72 };
  if (role === 'motion') weights.motion = 1;
  if (role === 'skin') weights.skin = 1;
  if (role === 'energy') weights.energy = 1;
  if (role === 'light') weights.light = 1;
  if (role === 'atmosphere') {
    weights.skin = 0.44;
    weights.light = 0.78;
  }
  if (role === 'accent') {
    weights.energy = 0.82;
    weights.light = 0.62;
  }
  return weights;
}

export function chooseSerpentZone(existingZones) {
  if (!existingZones.length) return 0.5;
  const candidates = Array.from({ length: 24 }, (_, index) => (index + 0.5) / 24);
  return candidates.reduce((best, candidate) => {
    const clearance = Math.min(...existingZones.map(zone => circularDistance(candidate, zone)));
    return clearance > best.clearance ? { zone: candidate, clearance } : best;
  }, { zone: 0.5, clearance: -1 }).zone;
}

export class SerpentInfluenceRouter {
  constructor() {
    this.states = new Map();
    this.data = new Uint8Array(MAP_SIZE * 4);
    this.texture = new THREE.DataTexture(this.data, MAP_SIZE, 1, THREE.RGBAFormat);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.needsUpdate = true;
  }

  setTracks(tracks) {
    const activeIds = new Set(tracks.map(track => track.id));
    for (const state of this.states.values()) state.target = activeIds.has(state.config.id) ? 1 : 0;

    tracks.forEach((track, index) => {
      let state = this.states.get(track.id);
      if (!state) {
        state = {
          config: track,
          extractor: new FeatureExtractor(globalMixer.getTrackProfile(track.id)),
          features: SILENCE,
          fade: 0,
          volume: 0,
          target: 1,
          zone: chooseSerpentZone([...this.states.values()].map(item => item.zone)),
          autoRole: SERPENT_ROLES[index % SERPENT_ROLES.length],
        };
        this.states.set(track.id, state);
      }
      state.config = track;
      state.target = 1;
    });
  }

  update(delta, fallbackFeatures = null, getAnalyser = id => globalMixer.getTrackAnalyser(id)) {
    const dt = Math.max(1 / 240, Math.min(delta, 0.1));
    const activeStates = [];
    let globalLevel = 0;
    let globalBass = 0;
    let globalMid = 0;
    let globalHigh = 0;
    let globalFlux = 0;
    let globalOnset = 0;
    let hueTotal = 0;
    let hueWeight = 0;
    let journeyTotal = 0;
    let cosmicTotal = 0;

    for (const [id, state] of this.states.entries()) {
      const fadeSpeed = state.target > state.fade ? 4.5 : 2.2;
      state.fade += (state.target - state.fade) * (1 - Math.exp(-fadeSpeed * dt));
      const targetVolume = state.target > 0 ? (state.config.volume ?? 1) : 0;
      state.volume += (targetVolume - state.volume) * (1 - Math.exp(-3.4 * dt));
      const analyser = getAnalyser(id);
      const artReactivity = 0.72 + (state.config.trance ?? 0.5) * 1.38;
      state.features = analyser
        ? state.extractor.update(analyser, dt, artReactivity)
        : (id === '__ambient' && fallbackFeatures ? fallbackFeatures : SILENCE);
      if (state.target === 0 && state.fade < 0.004) {
        this.states.delete(id);
        continue;
      }

      const gain = state.fade * state.volume;
      activeStates.push({ ...state, gain });
      globalLevel += state.features.level * gain;
      globalBass += (state.features.bass * 0.55 + state.features.spectralLow * 0.45) * gain;
      globalMid += (state.features.mid * 0.45 + state.features.spectralMid * 0.55) * gain;
      globalHigh += (state.features.treble * 0.4 + state.features.spectralHigh * 0.6) * gain;
      globalFlux += state.features.flux * gain;
      globalOnset = Math.max(globalOnset, state.features.onset * gain);
      const weight = Math.max(0.01, state.features.level) * gain;
      hueTotal += (state.config.cosmic ?? 0.2) * 0.13 * weight;
      journeyTotal += (state.config.trance ?? 0.5) * weight;
      cosmicTotal += (state.config.cosmic ?? 0.2) * weight;
      hueWeight += weight;
    }

    const visibleTracks = Math.max(1, activeStates.filter(state => state.target > 0).length);
    const width = visibleTracks === 1 ? 0.62 : visibleTracks === 2 ? 0.35 : 0.24;
    for (let index = 0; index < MAP_SIZE; index += 1) {
      const bodyPosition = (index + 0.5) / MAP_SIZE;
      let motion = 0;
      let skin = 0;
      let energy = 0;
      let light = 0;

      for (const state of activeStates) {
        const distance = circularDistance(bodyPosition, state.zone);
        const mask = Math.exp(-(distance * distance) / (2 * width * width)) * state.gain;
        const features = state.features;
        const role = state.config.sceneRole === 'auto' || !state.config.sceneRole
          ? (visibleTracks === 1 ? 'balanced' : state.autoRole)
          : state.config.sceneRole;
        const weights = roleWeights(role);
        const motionInput = features.bass * 0.42 + features.spectralLow * 0.38 + features.lowMid * 0.2;
        const skinInput = features.mid * 0.3 + features.spectralMid * 0.48 + features.centroid * 0.22;
        const energyInput = features.highMid * 0.24 + features.spectralHigh * 0.4
          + features.flux * 0.22 + features.onset * 0.14;
        const lightInput = features.level * 0.58 + features.treble * 0.22 + features.onset * 0.2;
        motion += motionInput * weights.motion * mask;
        skin += skinInput * weights.skin * mask;
        energy += energyInput * weights.energy * mask;
        light += lightInput * weights.light * mask;
      }

      const offset = index * 4;
      this.data[offset] = smoothChannel(this.data[offset], clamp01(motion), dt);
      this.data[offset + 1] = smoothChannel(this.data[offset + 1], clamp01(skin), dt);
      this.data[offset + 2] = smoothChannel(this.data[offset + 2], clamp01(energy), dt);
      this.data[offset + 3] = smoothChannel(this.data[offset + 3], clamp01(light), dt);
    }
    this.texture.needsUpdate = true;

    return {
      level: clamp01(globalLevel),
      bass: clamp01(globalBass),
      mid: clamp01(globalMid),
      high: clamp01(globalHigh),
      flux: clamp01(globalFlux),
      onset: clamp01(globalOnset),
      hue: hueWeight > 0 ? hueTotal / hueWeight : 0,
      trance: hueWeight > 0 ? journeyTotal / hueWeight : 0.5,
      cosmic: hueWeight > 0 ? cosmicTotal / hueWeight : 0.2,
      trackCount: visibleTracks,
    };
  }

  dispose() {
    this.texture.dispose();
  }
}
