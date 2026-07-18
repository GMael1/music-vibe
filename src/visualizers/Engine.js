import * as THREE from 'three';
import { globalMixer } from '../audio/Mixer.js';
import { FeatureExtractor } from '../audio/FeatureExtractor.js';
import { getPsychedelicMaterial } from './Psychedelic.js';
import { getChladniMaterial } from './Chladni.js';
import { ResonanceDirector } from './ResonanceDirector.js';
import { getJungleSerpentMaterial } from './JungleSerpent.js';
import { SerpentInfluenceRouter } from './SerpentInfluenceRouter.js';
import { getRitualCurrentMaterial } from './RitualCurrent.js';
import { getLivingMandalaMaterial } from './LivingMandala.js';
import { getObsidianOrganismMaterial } from './ObsidianOrganism.js';
import { SandSimulation } from './SandSimulation.js';
import { updateMandalaMotion } from './MandalaMotion.js';
import { getPlateFrequencyFeatures } from './PlateFrequency.js';
import {
  getJourneyDynamics,
  getLayerMaskConfig,
} from './VisualDynamics.js';

const IDLE_FEATURES = {
  sub: 0.08,
  bass: 0.08,
  lowMid: 0.06,
  mid: 0.06,
  highMid: 0.04,
  treble: 0.12,
  spectralLow: 0.18,
  spectralMid: 0.12,
  spectralHigh: 0.08,
  level: 0.05,
  centroid: 0.32,
  pitch: 0.24,
  absolutePitch: 0.3,
  spread: 0.34,
  tonality: 0.72,
  flux: 0,
  beat: 0,
  onset: 0,
};

function dampAudioValue(current, target, delta, attack, release) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = Number.isFinite(target) ? target : safeCurrent;
  const speed = safeTarget > safeCurrent ? attack : release;
  return safeCurrent + (safeTarget - safeCurrent) * (1 - Math.exp(-speed * delta));
}

const SMOOTHED_FEATURES = [
  'sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble',
  'spectralLow', 'spectralMid', 'spectralHigh', 'level',
  'relativeLevel', 'levelFast', 'levelSlow', 'presence',
  'centroid', 'pitch', 'absolutePitch', 'spread', 'tonality',
  'peakHz1', 'peakHz2', 'peakStrength1', 'peakStrength2',
  'flux', 'beat', 'onset',
];

function smoothJourneyFeatures(obj, features, delta, dynamics) {
  if (!obj.journeyFeatures) obj.journeyFeatures = { ...features };
  const output = { ...features };
  for (const key of SMOOTHED_FEATURES) {
    if (features[key] === undefined) continue;
    let target = features[key];
    if (key === 'beat' || key === 'onset') target *= dynamics.onsetScale;
    if (key === 'flux') target *= 0.22 + dynamics.energy * 0.78;
    const current = obj.journeyFeatures[key] ?? target;
    output[key] = dampAudioValue(
      current,
      target,
      delta,
      dynamics.audioAttack,
      dynamics.audioRelease,
    );
  }
  obj.journeyFeatures = output;
  return output;
}

function visualSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function sampleTrackJourney(profile, time) {
  const timeline = profile?.timeline;
  if (!timeline?.length) {
    return {
      intensity: 0.35,
      novelty: 0,
      dominantHz: undefined,
      centroidHz: undefined,
      tonality: undefined,
    };
  }
  const duration = Math.max(0.001, profile.duration ?? timeline[timeline.length - 1].time ?? 1);
  const position = Math.max(0, Math.min(timeline.length - 1, (time / duration) * (timeline.length - 1)));
  const lower = Math.floor(position);
  const upper = Math.min(timeline.length - 1, lower + 1);
  const mix = position - lower;
  const interpolate = (key, fallback) => {
    const a = Number.isFinite(timeline[lower][key]) ? timeline[lower][key] : fallback;
    const b = Number.isFinite(timeline[upper][key]) ? timeline[upper][key] : a;
    return a + (b - a) * mix;
  };
  return {
    intensity: interpolate('intensity', 0.35),
    novelty: interpolate('novelty', 0),
    dominantHz: interpolate('dominantHz', 0),
    centroidHz: interpolate('centroidHz', 0),
    tonality: interpolate('tonality', 0.5),
  };
}

function getTempoState(profile, timelineTime, features) {
  const bpm = profile?.tempo?.bpm ?? 0;
  const confidence = Math.max(0, Math.min(1, profile?.tempo?.confidence ?? 0));
  if (!bpm || confidence < 0.12) {
    return {
      bpm: 0,
      confidence: 0,
      phase: 0,
      pulse: features.beat ?? 0,
      speed: 1,
    };
  }
  const period = 60 / bpm;
  const offset = profile?.tempo?.offset ?? 0;
  const cycles = (Math.max(0, timelineTime) - offset) / period;
  const phase = ((cycles % 1) + 1) % 1;
  const tempoPulse = Math.exp(-phase * 7.5);
  return {
    bpm,
    confidence,
    phase,
    pulse: tempoPulse * confidence + (features.beat ?? 0) * (1 - confidence),
    speed: 1 + (Math.max(0.58, Math.min(1.55, bpm / 110)) - 1) * confidence,
  };
}

function getIdleFeatures(time) {
  const pulsePhase = time % 2;
  const pulse = Math.exp(-pulsePhase * 4.8);
  const spectralSweep = Math.sin(time * 0.34) * 0.5 + 0.5;
  const counterSweep = Math.sin(time * 0.21 + 1.7) * 0.5 + 0.5;
  return {
    ...IDLE_FEATURES,
    sub: 0.08 + pulse * 0.24,
    bass: 0.12 + pulse * 0.38,
    lowMid: 0.12 + counterSweep * 0.28,
    mid: 0.1 + spectralSweep * 0.34,
    highMid: 0.08 + spectralSweep * 0.38,
    treble: 0.08 + (1 - spectralSweep) * 0.28,
    spectralLow: 0.18 + pulse * 0.54,
    spectralMid: 0.2 + counterSweep * 0.58,
    spectralHigh: 0.16 + spectralSweep * 0.66,
    level: 0.16 + pulse * 0.22,
    centroid: 0.14 + spectralSweep * 0.62,
    pitch: 0.12 + (Math.sin(time * 0.43 - 0.8) * 0.5 + 0.5) * 0.76,
    absolutePitch: 0.1 + (Math.sin(time * 0.27 + 0.4) * 0.5 + 0.5) * 0.78,
    spread: 0.2 + counterSweep * 0.62,
    tonality: 0.38 + (Math.sin(time * 0.19 + 2.2) * 0.5 + 0.5) * 0.54,
    flux: 0.05 + counterSweep * 0.18,
    beat: pulse,
    onset: pulse > 0.82 ? 1 : 0,
  };
}

export class VisualizerEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    this.renderer.setClearColor(0x02030b, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    this.objects = new Map();
    this.rafId = null;
    this.aspect = 1;
    this.isExporting = false;
    this.exportFrameInterval = 0;
    this.lastRenderTimestamp = null;
    this.lastTime = performance.now() / 1000;
    this.manualTime = this.lastTime;
    this.manualTimelineTime = 0;
    this.serpentDemo = import.meta.env.DEV
      && new URLSearchParams(window.location.search).has('serpentDemo');
    this.unsubscribeMixer = globalMixer.subscribe(event => {
      if (event.type === 'play' && globalMixer.getCurrentTime() < 0.05) this.resetVisualState();
    });
  }

  applySize(width, height, pixelRatio = 1) {
    if (!width || !height) return;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.aspect = width / height;
    this.camera.left = -this.aspect;
    this.camera.right = this.aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    for (const obj of this.objects.values()) {
      if (obj.style === 'serpent') {
        obj.mesh.scale.set(1, 1, 1);
        obj.mesh.position.set(0, 0, 0);
      } else {
        this.setPosition(obj.mesh, obj.position);
        this.configureLayerMask(obj, obj.position);
      }
      if (obj.uniforms.uAspect) obj.uniforms.uAspect.value = this.aspect;
      if (obj.uniforms.uPixelRatio) obj.uniforms.uPixelRatio.value = pixelRatio;
      obj.sand?.resize(width, height);
    }
  }

  resize() {
    if (this.isExporting) return;
    const parent = this.canvas.parentElement;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.applySize(parent.clientWidth, parent.clientHeight, pixelRatio);
  }

  setExportResolution(width, height, frameRate = 30) {
    this.isExporting = true;
    this.exportFrameInterval = 1000 / frameRate;
    this.lastRenderTimestamp = null;
    this.applySize(width, height, 1);
  }

  restorePreviewResolution() {
    this.isExporting = false;
    this.exportFrameInterval = 0;
    this.lastRenderTimestamp = null;
    this.resize();
  }

  updateTracks(tracks, mode, liveStyle, liveDirection = {}) {
    const liveFlow = liveDirection.flow ?? liveDirection.trance ?? 0.5;
    const liveLight = liveDirection.light ?? 0.62;
    const liveColor = liveDirection.color ?? liveDirection.cosmic ?? 0.2;
    const idleTrack = {
      id: '__ambient',
      visualStyle: mode === 'live' ? liveStyle : 'livingMandala',
      position: 'background',
      opacity: 0.7,
      blendMode: 'normal',
      flow: liveFlow,
      light: liveLight,
      color: liveColor,
    };
    const activeTracks = mode === 'live'
      ? (globalMixer.tracks.has('live') ? [{
          id: 'live',
          visualStyle: liveStyle,
          position: 'background',
          opacity: 1,
          blendMode: 'normal',
          flow: liveFlow,
          light: liveLight,
          color: liveColor,
        }] : [idleTrack])
      : (tracks.length > 0 ? tracks : [idleTrack]);

    const serpentTracks = activeTracks.filter(track => track.visualStyle === 'serpent');
    const desiredObjects = new Map();
    if (serpentTracks.length > 0 || this.objects.has('__shared-serpent')) {
      desiredObjects.set('__shared-serpent', { style: 'serpent', tracks: serpentTracks });
    }
    activeTracks
      .filter(track => track.visualStyle !== 'serpent')
      .forEach(track => desiredObjects.set(track.id, { style: track.visualStyle, track }));

    for (const [id, obj] of this.objects.entries()) {
      const desired = desiredObjects.get(id);
      if (!desired || desired.style !== obj.style) {
        this.scene.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        obj.mesh.material.dispose();
        obj.router?.dispose();
        obj.sand?.dispose();
        this.objects.delete(id);
      }
    }

    for (const [id, desired] of desiredObjects.entries()) {
      let obj = this.objects.get(id);
      if (!obj) {
        obj = desired.style === 'serpent'
          ? this.createSerpentVisualizer()
          : this.createVisualizer(desired.style);
        if (desired.track) {
          const profile = globalMixer.getTrackProfile(desired.track.id);
          obj.profile = profile;
          obj.blueprint = globalMixer.getTrackBlueprint(desired.track.id);
          obj.extractor = new FeatureExtractor(profile);
          obj.director = new ResonanceDirector(obj.blueprint?.fingerprint ?? desired.track.name ?? desired.track.id);
        }
        obj.visualTime = 0;
        obj.journey = 0;
        obj.targetTrance = desired.track?.flow ?? desired.track?.trance ?? 0.5;
        obj.trance = obj.targetTrance;
        obj.targetLight = desired.track?.light ?? 0.62;
        obj.light = obj.targetLight;
        obj.targetCosmic = desired.track?.color ?? desired.track?.cosmic ?? 0.2;
        obj.cosmic = obj.targetCosmic;
        obj.blendSeed = visualSeed(id);
        if (obj.blueprint) obj.blendSeed = obj.blueprint.seed / 4294967295;
        if (obj.sand) obj.sand.resize(this.canvas.width, this.canvas.height);
        this.scene.add(obj.mesh);
        this.objects.set(id, obj);
      }

      if (desired.style === 'serpent') {
        obj.tracks = desired.tracks;
        obj.router.setTracks(desired.tracks);
        obj.targetTrance = desired.tracks.length > 0
          ? desired.tracks.reduce((total, track) => total + (track.flow ?? track.trance ?? 0.5), 0)
            / desired.tracks.length
          : liveFlow;
        obj.targetCosmic = desired.tracks.length > 0
          ? desired.tracks.reduce((total, track) => total + (track.color ?? track.cosmic ?? 0.2), 0)
            / desired.tracks.length
          : liveColor;
        obj.targetLight = desired.tracks.length > 0
          ? desired.tracks.reduce((total, track) => total + (track.light ?? 0.62), 0)
            / desired.tracks.length
          : liveLight;
        obj.position = 'background';
        obj.mesh.renderOrder = 0;
        obj.mesh.scale.set(1, 1, 1);
        obj.mesh.position.set(0, 0, 0);
        if (obj.uniforms.uAspect) obj.uniforms.uAspect.value = this.aspect;
        continue;
      }

      const { track } = desired;
      obj.position = 'background';
      obj.targetTrance = track.flow ?? track.trance ?? 0.5;
      obj.targetLight = track.light ?? 0.62;
      obj.targetCosmic = track.color ?? track.cosmic ?? 0.2;
      obj.reactivity = 0.72 + obj.targetTrance * 1.38;
      obj.hue = obj.targetCosmic * 0.13;
      obj.opacity = track.opacity ?? 1;
      obj.mesh.renderOrder = serpentTracks.length > 0 ? 1 : 0;
      obj.mesh.material.blending = obj.style === 'ritualCurrent' || track.blendMode === 'additive'
        ? THREE.AdditiveBlending
        : THREE.NormalBlending;
      obj.mesh.material.needsUpdate = true;
      this.setPosition(obj.mesh, 'background');
      this.configureLayerMask(obj, 'background');
      if (obj.uniforms.uAspect) obj.uniforms.uAspect.value = this.aspect;
      if (obj.uniforms.uBlueprintPhase) obj.uniforms.uBlueprintPhase.value = obj.blueprint?.palettePhase ?? 0;
      if (obj.uniforms.uDefinitionBias) obj.uniforms.uDefinitionBias.value = obj.blueprint?.definitionBias ?? 0.65;
      if (obj.uniforms.uDynamicGain) obj.uniforms.uDynamicGain.value = obj.blueprint?.dynamicGain ?? 0.7;
    }
  }

  setPosition(mesh, position = 'center') {
    void position;
    mesh.scale.set(this.aspect * 2.02, 2.02, 1);
    mesh.position.set(0, 0, 0);
  }

  configureLayerMask(obj, position = 'center') {
    const config = getLayerMaskConfig(position);
    const uniforms = obj.uniforms;
    uniforms.uLayerAnchor?.value.set(config.anchor[0], config.anchor[1]);
    if (uniforms.uLayerRadius) uniforms.uLayerRadius.value = config.radius;
    if (uniforms.uLayerFeather) uniforms.uLayerFeather.value = config.feather;
    if (uniforms.uBlendSeed) uniforms.uBlendSeed.value = obj.blendSeed ?? 0;
  }

  createVisualizer(style) {
    let data;
    if (style === 'ritualCurrent') data = getRitualCurrentMaterial();
    else if (style === 'livingMandala') data = getLivingMandalaMaterial();
    else if (style === 'obsidianOrganism') data = getObsidianOrganismMaterial();
    else if (style === 'chladni') data = getChladniMaterial();
    else data = getPsychedelicMaterial();

    const mesh = data.objectType === 'points'
      ? new THREE.Points(data.geometry, data.material)
      : new THREE.Mesh(data.geometry, data.material);
    return {
      mesh,
      uniforms: data.uniforms,
      style,
      position: 'center',
      sand: style === 'chladni' ? new SandSimulation() : null,
    };
  }

  createSerpentVisualizer() {
    const router = new SerpentInfluenceRouter();
    const data = getJungleSerpentMaterial(router.texture);
    return {
      mesh: new THREE.Mesh(data.geometry, data.material),
      uniforms: data.uniforms,
      field: data.field,
      router,
      style: 'serpent',
      position: 'background',
      tracks: [],
      smoothAudio: {
        level: 0,
        bass: 0,
        mid: 0,
        high: 0,
        flux: 0,
        onset: 0,
        hue: 0,
        trance: 0.5,
        cosmic: 0.2,
      },
      travelTime: 0,
    };
  }

  start() {
    if (this.rafId) return;
    const animate = (timestamp) => {
      this.rafId = requestAnimationFrame(animate);
      if (!this.exportFrameInterval || this.lastRenderTimestamp === null
        || timestamp - this.lastRenderTimestamp + 0.5 >= this.exportFrameInterval) {
        this.render();
        this.lastRenderTimestamp = timestamp;
      }
    };
    this.rafId = requestAnimationFrame(animate);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  dispose() {
    this.stop();
    for (const obj of this.objects.values()) {
      obj.mesh.geometry.dispose();
      obj.mesh.material.dispose();
      obj.router?.dispose();
      obj.sand?.dispose();
    }
    this.objects.clear();
    this.unsubscribeMixer?.();
    this.renderer.dispose();
  }

  resetVisualState() {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.style === 'serpent') continue;
      obj.visualTime = 0;
      obj.journey = 0;
      obj.journeyFeatures = null;
      obj.mandalaMotion = null;
      obj.structurePeakHz1 = 0;
      obj.structurePeakHz2 = 0;
      obj.structurePeakStrength2 = 0;
      obj.extractor = new FeatureExtractor(obj.profile);
      obj.director = new ResonanceDirector(obj.blueprint?.fingerprint ?? id);
      obj.sand?.reset();
    }
  }

  render() {
    const time = performance.now() / 1000;
    const delta = Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;
    this.renderFrame(time, delta, id => globalMixer.getTrackAnalyser(id), globalMixer.getCurrentTime());
  }

  renderOfflineFrame(time, delta, getAnalyser) {
    this.renderFrame(time, delta, getAnalyser, time);
  }

  advanceTime(milliseconds) {
    const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
    for (let index = 0; index < steps; index += 1) {
      this.manualTime += 1 / 60;
      this.manualTimelineTime += 1 / 60;
      this.renderFrame(
        this.manualTime,
        1 / 60,
        id => globalMixer.getTrackAnalyser(id),
        this.manualTimelineTime,
      );
    }
  }

  getDebugState() {
    return {
      coordinateSystem: 'origin=center; +x right; +y up; viewport x is aspect-scaled',
      aspect: this.aspect,
      layers: [...this.objects.entries()].map(([id, obj]) => ({
        id,
        style: obj.style,
        position: obj.position,
        flow: Number((obj.trance ?? obj.smoothAudio?.trance ?? 0.5).toFixed(3)),
        light: Number((obj.light ?? obj.targetLight ?? 0.62).toFixed(3)),
        bpm: obj.profile?.tempo?.bpm ?? undefined,
        visualTime: Number((obj.visualTime ?? 0).toFixed(3)),
        mandalaPhase: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.phase ?? 0).toFixed(3))
          : undefined,
        mandalaFrequencyShape: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.frequencyShape ?? 0).toFixed(3))
          : undefined,
        mandalaShapeShift: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.shapeShift ?? 0).toFixed(3))
          : undefined,
        mandalaMusicDrive: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.musicDrive ?? 0).toFixed(3))
          : undefined,
        mandalaFrequencyMotion: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.frequencyMotion ?? 0).toFixed(3))
          : undefined,
        mandalaShapePhase: obj.style === 'livingMandala'
          ? Number((obj.mandalaMotion?.shapePhase ?? 0).toFixed(3))
          : undefined,
        plateFrequencyHz: obj.style === 'chladni'
          ? Number((obj.resonanceState?.sourceFrequency ?? 0).toFixed(1))
          : undefined,
        plateAudioFrequencyHz: obj.style === 'chladni'
          ? Number((obj.resonanceState?.sourceAudioFrequency ?? 0).toFixed(1))
          : undefined,
        plateCalibration: obj.style === 'chladni'
          ? Number((obj.resonanceState?.plateCalibration ?? 1).toFixed(2))
          : undefined,
        plateFrequencyMotion: obj.style === 'chladni'
          ? Number((obj.resonanceState?.frequencyMotion ?? 0).toFixed(3))
          : undefined,
        plateSecondaryWeight: obj.style === 'chladni'
          ? Number((obj.resonanceState?.secondaryWeight ?? 0).toFixed(3))
          : undefined,
        plateModes: obj.style === 'chladni' && obj.resonanceState
          ? [
            `${obj.resonanceState.modeAX}:${obj.resonanceState.modeAY}`,
            `${obj.resonanceState.modeBX}:${obj.resonanceState.modeBY}`,
            `${obj.resonanceState.modeCX}:${obj.resonanceState.modeCY}`,
            `${obj.resonanceState.modeDX}:${obj.resonanceState.modeDY}`,
          ]
          : undefined,
        serpentTravel: obj.style === 'serpent'
          ? Number((obj.travelTime ?? 0).toFixed(3))
          : undefined,
        serpentDirection: obj.style === 'serpent'
          ? Number((obj.field?.angle ?? 0).toFixed(3))
          : undefined,
      })),
    };
  }

  renderFrame(time, delta, getAnalyser, timelineTime = 0) {

    for (const [id, obj] of this.objects.entries()) {
      if (obj.style === 'serpent') {
        const demoFeatures = this.serpentDemo ? getIdleFeatures(time) : null;
        const summary = obj.router.update(delta, demoFeatures, getAnalyser);
        const smooth = obj.smoothAudio;
        smooth.trance = dampAudioValue(
          smooth.trance,
          summary.trance ?? obj.targetTrance ?? 0.5,
          delta,
          0.9,
          0.9,
        );
        smooth.cosmic = dampAudioValue(
          smooth.cosmic,
          summary.cosmic ?? obj.targetCosmic ?? 0.2,
          delta,
          0.75,
          0.75,
        );
        const dynamics = getJourneyDynamics(smooth.trance);
        smooth.level = dampAudioValue(smooth.level, summary.level, delta, dynamics.audioAttack, dynamics.audioRelease);
        smooth.bass = dampAudioValue(smooth.bass, summary.bass, delta, dynamics.audioAttack, dynamics.audioRelease);
        smooth.mid = dampAudioValue(smooth.mid, summary.mid, delta, dynamics.audioAttack, dynamics.audioRelease);
        smooth.high = dampAudioValue(smooth.high, summary.high, delta, dynamics.audioAttack, dynamics.audioRelease);
        smooth.flux = dampAudioValue(smooth.flux, summary.flux * dynamics.structureScale, delta, dynamics.audioAttack, dynamics.audioRelease);
        smooth.onset = dampAudioValue(smooth.onset, summary.onset * dynamics.onsetScale, delta, dynamics.audioAttack * 1.4, dynamics.audioRelease);
        smooth.hue = dampAudioValue(smooth.hue, summary.hue, delta, 1.2, 1.2);
        obj.visualTime += delta * (0.018 + dynamics.energy * 0.08
          + smooth.level * (0.025 + dynamics.energy * 0.16));
        obj.travelTime += delta * (0.08 + dynamics.energy * 0.42)
          * (0.8 + smooth.bass * 0.22);
        obj.uniforms.uTime.value = obj.visualTime;
        if (obj.uniforms.uTravelTime) obj.uniforms.uTravelTime.value = obj.travelTime;
        obj.uniforms.uLevel.value = smooth.level;
        obj.uniforms.uBass.value = smooth.bass;
        obj.uniforms.uMid.value = smooth.mid;
        obj.uniforms.uHigh.value = smooth.high;
        obj.uniforms.uFlux.value = smooth.flux;
        obj.uniforms.uOnset.value = smooth.onset;
        obj.uniforms.uHue.value = smooth.hue;
        if (obj.uniforms.uTrance) obj.uniforms.uTrance.value = smooth.trance;
        if (obj.uniforms.uCalm) obj.uniforms.uCalm.value = dynamics.calm;
        if (obj.uniforms.uEnergy) obj.uniforms.uEnergy.value = dynamics.energy;
        if (obj.uniforms.uCosmic) obj.uniforms.uCosmic.value = smooth.cosmic;
        continue;
      }

      obj.trance = dampAudioValue(obj.trance, obj.targetTrance, delta, 0.85, 0.85);
      obj.light = dampAudioValue(obj.light, obj.targetLight, delta, 0.8, 0.8);
      obj.cosmic = dampAudioValue(obj.cosmic, obj.targetCosmic, delta, 0.7, 0.7);
      const dynamics = getJourneyDynamics(obj.trance);
      const analyser = getAnalyser(id);
      const rawFeatures = analyser
        ? obj.extractor.update(analyser, delta, 0.55 + dynamics.energy * 1.55)
        : getIdleFeatures(time);
      const features = smoothJourneyFeatures(obj, rawFeatures, delta, dynamics);
      const uniforms = obj.uniforms;
      const trackJourney = sampleTrackJourney(obj.profile, timelineTime);
      const tempo = getTempoState(obj.profile, timelineTime, features);

      const structureSpeed = 0.42 + obj.trance * 0.95;
      const peakHz1 = features.peakHz1 ?? features.dominantHz ?? 110;
      const peakHz2 = features.peakHz2 ?? peakHz1;
      if (!obj.structurePeakHz1) obj.structurePeakHz1 = peakHz1;
      if (!obj.structurePeakHz2) obj.structurePeakHz2 = peakHz2;
      obj.structurePeakHz1 = dampAudioValue(
        obj.structurePeakHz1,
        peakHz1,
        delta,
        structureSpeed,
        structureSpeed,
      );
      obj.structurePeakHz2 = dampAudioValue(
        obj.structurePeakHz2,
        peakHz2,
        delta,
        structureSpeed * 0.8,
        structureSpeed * 0.8,
      );
      obj.structurePeakStrength2 = dampAudioValue(
        obj.structurePeakStrength2,
        features.peakStrength2 ?? 0,
        delta,
        structureSpeed,
        structureSpeed * 0.7,
      );

      if (obj.style === 'livingMandala') {
        const profileFrequency = obj.profile?.persistentPeaks?.[0]?.frequency
          ?? obj.profile?.medianCentroidHz
          ?? 220;
        const analyzedStructureHz = trackJourney.centroidHz > 40
          ? Math.sqrt(Math.max(55, profileFrequency) * trackJourney.centroidHz)
          : obj.structurePeakHz1;
        obj.mandalaMotion = updateMandalaMotion(
          obj.mandalaMotion,
          {
            ...features,
            peakHz1: analyzedStructureHz,
            spectralLow: Math.max(features.spectralLow * 0.78, features.bass * 0.55),
            levelSlow: Math.max(features.levelSlow * 0.72, trackJourney.intensity * 0.56),
            flux: features.flux * 0.58 + trackJourney.novelty * 0.24,
            sectionNovelty: trackJourney.novelty,
            tonality: Number.isFinite(trackJourney.tonality)
              ? features.tonality * 0.58 + trackJourney.tonality * 0.42
              : features.tonality,
          },
          tempo,
          dynamics,
          obj.trance,
          delta,
          obj.blueprint,
          profileFrequency,
        );
        if (uniforms.uMorphPhase) uniforms.uMorphPhase.value = obj.mandalaMotion.phase;
        if (uniforms.uFrequencyShape) {
          uniforms.uFrequencyShape.value = obj.mandalaMotion.frequencyShape;
        }
        if (uniforms.uFormBlend) uniforms.uFormBlend.value = obj.mandalaMotion.formBlend;
        if (uniforms.uMotionEnergy) uniforms.uMotionEnergy.value = obj.mandalaMotion.velocity;
        if (uniforms.uShapeShift) uniforms.uShapeShift.value = obj.mandalaMotion.shapeShift;
        if (uniforms.uShapePhase) uniforms.uShapePhase.value = obj.mandalaMotion.shapePhase;
        if (uniforms.uMusicDrive) uniforms.uMusicDrive.value = obj.mandalaMotion.musicDrive;
        if (uniforms.uFrequencyMotion) {
          uniforms.uFrequencyMotion.value = obj.mandalaMotion.frequencyMotion;
        }
        if (uniforms.uPulseEnvelope) {
          uniforms.uPulseEnvelope.value = obj.mandalaMotion.pulseEnvelope;
        }
        if (uniforms.uSymmetryBase) uniforms.uSymmetryBase.value = obj.mandalaMotion.symmetry;
      }

      const movementEnergy = features.level * 0.35
        + features.spectralLow * 0.2
        + features.spectralMid * 0.28
        + features.spectralHigh * 0.17;
      obj.visualTime += delta * (0.012 + tempo.speed * (
        0.018 + dynamics.energy * 0.105
        + movementEnergy * (0.014 + dynamics.energy * 0.16)
      ));
      obj.journey += delta * ((features.centroid + features.pitch) * 0.5 - 0.28)
        * (0.004 + dynamics.energy * 0.042) * tempo.speed;

      if (uniforms.uTime) uniforms.uTime.value = obj.visualTime;
      if (uniforms.uSub) uniforms.uSub.value = features.sub;
      if (uniforms.uBass) uniforms.uBass.value = features.bass;
      if (uniforms.uLowMid) uniforms.uLowMid.value = features.lowMid;
      if (uniforms.uMid) uniforms.uMid.value = features.mid;
      if (uniforms.uHighMid) uniforms.uHighMid.value = features.highMid;
      if (uniforms.uTreble) uniforms.uTreble.value = features.treble;
      if (uniforms.uSpectralLow) uniforms.uSpectralLow.value = features.spectralLow;
      if (uniforms.uSpectralMid) uniforms.uSpectralMid.value = features.spectralMid;
      if (uniforms.uSpectralHigh) uniforms.uSpectralHigh.value = features.spectralHigh;
      if (uniforms.uLevel) uniforms.uLevel.value = features.level;
      if (uniforms.uRelativeLevel) uniforms.uRelativeLevel.value = features.relativeLevel ?? features.level;
      if (uniforms.uLevelFast) uniforms.uLevelFast.value = features.levelFast ?? features.level;
      if (uniforms.uLevelSlow) uniforms.uLevelSlow.value = features.levelSlow ?? features.level;
      if (uniforms.uPresence) uniforms.uPresence.value = features.presence ?? features.level;
      if (uniforms.uBeat) uniforms.uBeat.value = features.beat;
      if (uniforms.uBeatPhase) uniforms.uBeatPhase.value = tempo.phase;
      if (uniforms.uBeatPulse) uniforms.uBeatPulse.value = tempo.pulse;
      if (uniforms.uTempoBpm) uniforms.uTempoBpm.value = tempo.bpm;
      if (uniforms.uOnset) uniforms.uOnset.value = features.onset;
      if (uniforms.uFlux) uniforms.uFlux.value = features.flux;
      if (uniforms.uCentroid) uniforms.uCentroid.value = features.centroid;
      if (uniforms.uPitch) uniforms.uPitch.value = features.pitch;
      if (uniforms.uAbsolutePitch) uniforms.uAbsolutePitch.value = features.absolutePitch;
      if (uniforms.uDominantHz) uniforms.uDominantHz.value = features.dominantHz ?? 110;
      if (uniforms.uPeakHz1) uniforms.uPeakHz1.value = obj.structurePeakHz1;
      if (uniforms.uPeakHz2) uniforms.uPeakHz2.value = obj.structurePeakHz2;
      if (uniforms.uPeakStrength1) uniforms.uPeakStrength1.value = features.peakStrength1 ?? 0.5;
      if (uniforms.uPeakStrength2) uniforms.uPeakStrength2.value = obj.structurePeakStrength2;
      if (uniforms.uSpread) uniforms.uSpread.value = features.spread;
      if (uniforms.uTonality) uniforms.uTonality.value = features.tonality;
      if (uniforms.uJourney) uniforms.uJourney.value = obj.journey;
      if (uniforms.uHue) uniforms.uHue.value = obj.hue * Math.PI * 2;
      if (uniforms.uTrance) uniforms.uTrance.value = obj.trance;
      if (uniforms.uCalm) uniforms.uCalm.value = dynamics.calm;
      if (uniforms.uEnergy) uniforms.uEnergy.value = dynamics.energy;
      if (uniforms.uCosmic) uniforms.uCosmic.value = obj.cosmic;
      if (uniforms.uLight) uniforms.uLight.value = obj.light;
      if (uniforms.uOpacity) uniforms.uOpacity.value = obj.opacity;
      if (uniforms.uSectionIntensity) uniforms.uSectionIntensity.value = trackJourney.intensity;
      if (uniforms.uSectionNovelty) uniforms.uSectionNovelty.value = trackJourney.novelty;

      if (obj.style === 'chladni') {
        const structuralFeatures = getPlateFrequencyFeatures(features, trackJourney, obj.profile);
        const resonance = obj.director.update(structuralFeatures, delta, obj.trance);
        obj.resonanceState = resonance;
        uniforms.uFamilyA.value = resonance.familyA;
        uniforms.uFamilyB.value = resonance.familyB;
        uniforms.uFamilyC.value = resonance.familyC;
        uniforms.uFamilyD.value = resonance.familyD;
        uniforms.uModeAX.value = resonance.modeAX;
        uniforms.uModeAY.value = resonance.modeAY;
        uniforms.uModeBX.value = resonance.modeBX;
        uniforms.uModeBY.value = resonance.modeBY;
        uniforms.uModeCX.value = resonance.modeCX;
        uniforms.uModeCY.value = resonance.modeCY;
        uniforms.uModeDX.value = resonance.modeDX;
        uniforms.uModeDY.value = resonance.modeDY;
        uniforms.uRotationA.value = resonance.rotationA;
        uniforms.uRotationB.value = resonance.rotationB;
        uniforms.uRotationC.value = resonance.rotationC;
        uniforms.uRotationD.value = resonance.rotationD;
        uniforms.uSeedA.value = resonance.seedA;
        uniforms.uSeedB.value = resonance.seedB;
        uniforms.uSeedC.value = resonance.seedC;
        uniforms.uSeedD.value = resonance.seedD;
        uniforms.uFamilyMix.value = resonance.mix;
        uniforms.uModeWeights.value.set(
          resonance.weightA,
          resonance.weightB,
          resonance.weightC,
          resonance.weightD,
        );
        if (uniforms.uModeInstability) uniforms.uModeInstability.value = resonance.instability;
        if (uniforms.uFrequencyMotion) {
          uniforms.uFrequencyMotion.value = resonance.frequencyMotion;
        }
        if (obj.sand) {
          uniforms.uSandTexture.value = obj.sand.update(
            this.renderer,
            resonance,
            structuralFeatures,
            delta,
            this.aspect,
            obj.blueprint?.palettePhase ?? 0,
            obj.trance,
          );
          uniforms.uSandReady.value = 1;
          uniforms.uSandTexel?.value.set(1 / obj.sand.width, 1 / obj.sand.height);
        }
      }

    }

    this.renderer.render(this.scene, this.camera);
  }
}
