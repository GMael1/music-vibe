import * as THREE from 'three';
import { globalMixer } from '../audio/Mixer';
import { FeatureExtractor } from '../audio/FeatureExtractor';
import { getPsychedelicMaterial } from './Psychedelic';
import { getFireworksMaterial, updateFireworksGeometry } from './Fireworks';
import { getChladniMaterial } from './Chladni';
import { ResonanceDirector } from './ResonanceDirector';

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
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
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
    this.lastTime = performance.now() / 1000;
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
      this.setPosition(obj.mesh, obj.position);
      if (obj.uniforms.uAspect) obj.uniforms.uAspect.value = this.aspect;
      if (obj.uniforms.uPixelRatio) obj.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  resize() {
    if (this.isExporting) return;
    const parent = this.canvas.parentElement;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.applySize(parent.clientWidth, parent.clientHeight, pixelRatio);
  }

  setExportResolution(width, height) {
    this.isExporting = true;
    this.applySize(width, height, 1);
  }

  restorePreviewResolution() {
    this.isExporting = false;
    this.resize();
  }

  updateTracks(tracks, mode, liveStyle) {
    const idleTrack = {
      id: '__ambient',
      visualStyle: mode === 'live' ? liveStyle : 'psychedelic',
      position: 'background',
      opacity: 0.7,
      blendMode: 'normal',
      reactivity: 1,
      hue: 0,
    };
    const activeTracks = mode === 'live'
      ? (globalMixer.tracks.has('live') ? [{
          id: 'live',
          visualStyle: liveStyle,
          position: 'background',
          opacity: 1,
          blendMode: 'normal',
          reactivity: 1.15,
          hue: 0,
        }] : [idleTrack])
      : (tracks.length > 0 ? tracks : [idleTrack]);

    for (const [id, obj] of this.objects.entries()) {
      const active = activeTracks.find(track => track.id === id);
      if (!active || active.visualStyle !== obj.style) {
        this.scene.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        obj.mesh.material.dispose();
        this.objects.delete(id);
      }
    }

    activeTracks.forEach((track, index) => {
      let obj = this.objects.get(track.id);
      if (!obj) {
        obj = this.createVisualizer(track.visualStyle);
        obj.extractor = new FeatureExtractor(globalMixer.getTrackProfile(track.id));
        obj.director = new ResonanceDirector(track.name ?? track.id);
        obj.visualTime = 0;
        obj.journey = 0;
        this.scene.add(obj.mesh);
        this.objects.set(track.id, obj);
      }

      obj.position = track.position;
      obj.reactivity = track.reactivity ?? 1;
      obj.hue = track.hue ?? 0;
      obj.opacity = track.opacity ?? 1;
      obj.mesh.renderOrder = index;
      obj.mesh.material.blending = track.blendMode === 'additive'
        ? THREE.AdditiveBlending
        : (obj.style === 'fireworks' ? THREE.AdditiveBlending : THREE.NormalBlending);
      obj.mesh.material.needsUpdate = true;
      this.setPosition(obj.mesh, track.position);
      if (obj.uniforms.uAspect) obj.uniforms.uAspect.value = this.aspect;
    });
  }

  setPosition(mesh, position = 'center') {
    const paddingX = 0.12;
    const paddingY = 0.12;
    const quadWidth = this.aspect - paddingX * 1.5;
    const quadHeight = 1 - paddingY * 1.5;

    switch (position) {
      case 'top-left':
        mesh.scale.set(quadWidth, quadHeight, 1);
        mesh.position.set(-this.aspect / 2, 0.5, 0);
        break;
      case 'top-right':
        mesh.scale.set(quadWidth, quadHeight, 1);
        mesh.position.set(this.aspect / 2, 0.5, 0);
        break;
      case 'bottom-left':
        mesh.scale.set(quadWidth, quadHeight, 1);
        mesh.position.set(-this.aspect / 2, -0.5, 0);
        break;
      case 'bottom-right':
        mesh.scale.set(quadWidth, quadHeight, 1);
        mesh.position.set(this.aspect / 2, -0.5, 0);
        break;
      case 'background':
        mesh.scale.set(this.aspect * 2.02, 2.02, 1);
        mesh.position.set(0, 0, 0);
        break;
      case 'center':
      default:
        mesh.scale.set(Math.min(this.aspect * 1.55, 1.75), 1.55, 1);
        mesh.position.set(0, 0, 0);
        break;
    }
  }

  createVisualizer(style) {
    let data;
    if (style === 'chladni') data = getChladniMaterial();
    else if (style === 'fireworks') data = getFireworksMaterial();
    else data = getPsychedelicMaterial();

    const mesh = data.isPoints
      ? new THREE.Points(data.geometry, data.material)
      : new THREE.Mesh(data.geometry, data.material);
    if (data.isPoints) mesh.frustumCulled = false;
    return { mesh, uniforms: data.uniforms, style, position: 'center' };
  }

  start() {
    if (this.rafId) return;
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
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
    }
    this.objects.clear();
    this.renderer.dispose();
  }

  render() {
    const time = performance.now() / 1000;
    const delta = Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;

    for (const [id, obj] of this.objects.entries()) {
      const analyser = globalMixer.getTrackAnalyser(id);
      const features = analyser
        ? obj.extractor.update(analyser, delta, obj.reactivity)
        : getIdleFeatures(time);
      const uniforms = obj.uniforms;

      const movementEnergy = features.level * 0.35
        + features.spectralLow * 0.2
        + features.spectralMid * 0.28
        + features.spectralHigh * 0.17;
      obj.visualTime += delta * (0.12 + movementEnergy * 1.65 + features.flux * 0.8);
      obj.journey += delta * ((features.centroid + features.pitch) * 0.5 - 0.28) * 0.07
        + features.onset * 0.012;

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
      if (uniforms.uBeat) uniforms.uBeat.value = features.beat;
      if (uniforms.uOnset) uniforms.uOnset.value = features.onset;
      if (uniforms.uFlux) uniforms.uFlux.value = features.flux;
      if (uniforms.uCentroid) uniforms.uCentroid.value = features.centroid;
      if (uniforms.uPitch) uniforms.uPitch.value = features.pitch;
      if (uniforms.uAbsolutePitch) uniforms.uAbsolutePitch.value = features.absolutePitch;
      if (uniforms.uSpread) uniforms.uSpread.value = features.spread;
      if (uniforms.uTonality) uniforms.uTonality.value = features.tonality;
      if (uniforms.uJourney) uniforms.uJourney.value = obj.journey;
      if (uniforms.uHue) uniforms.uHue.value = obj.hue * Math.PI * 2;
      if (uniforms.uOpacity) uniforms.uOpacity.value = obj.opacity;

      if (obj.style === 'chladni') {
        const resonance = obj.director.update(features, delta);
        uniforms.uFamilyA.value = resonance.familyA;
        uniforms.uFamilyB.value = resonance.familyB;
        uniforms.uModeAX.value = resonance.modeAX;
        uniforms.uModeAY.value = resonance.modeAY;
        uniforms.uModeBX.value = resonance.modeBX;
        uniforms.uModeBY.value = resonance.modeBY;
        uniforms.uRotationA.value = resonance.rotationA;
        uniforms.uRotationB.value = resonance.rotationB;
        uniforms.uSeedA.value = resonance.seedA;
        uniforms.uSeedB.value = resonance.seedB;
        uniforms.uFamilyMix.value = resonance.mix;
      }

      if (obj.style === 'fireworks') {
        updateFireworksGeometry(obj.mesh.geometry, features, delta);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
