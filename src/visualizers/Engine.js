import * as THREE from 'three';
import { globalMixer } from '../audio/Mixer';
import { getPsychedelicMaterial } from './Psychedelic';
import { getFireworksMaterial, updateFireworksGeometry } from './Fireworks';
import { getChladniMaterial } from './Chladni';

export class VisualizerEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    
    this.clock = new THREE.Clock();
    
    // trackId -> { mesh, uniforms, style }
    this.objects = new Map(); 
    
    // Temporary array for frequency data to avoid reallocation
    this.freqData = new Uint8Array(1024);
    
    this.rafId = null;
    this.aspect = 1;
  }

  resize(format = 'horizontal') {
    const parent = this.canvas.parentElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.renderer.setSize(width, height, false);
    
    const aspect = width / height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.aspect = aspect;
    
    // Re-position everything
    for (const [id, obj] of this.objects.entries()) {
      // Find track position from somewhere, or just assume center for now if we can't find it
      // In practice, updateTracks is called frequently enough to fix it
    }
  }

  updateTracks(tracks, mode, liveStyle) {
    const activeTracks = mode === 'live' && globalMixer.tracks.has('live') 
      ? [{ id: 'live', visualStyle: liveStyle, position: 'background' }] 
      : (mode === 'multi' ? tracks : []);
    
    // Remove old/changed tracks
    for (const [id, obj] of this.objects.entries()) {
      const active = activeTracks.find(t => t.id === id);
      if (!active || active.visualStyle !== obj.style) {
        this.scene.remove(obj.mesh);
        // dispose geometry/material to prevent memory leaks
        obj.mesh.geometry.dispose();
        if (obj.mesh.material) obj.mesh.material.dispose();
        this.objects.delete(id);
      }
    }
    
    // Add or update position
    activeTracks.forEach(track => {
      let obj = this.objects.get(track.id);
      if (!obj) {
         obj = this.createVisualizer(track.visualStyle);
         this.scene.add(obj.mesh);
         this.objects.set(track.id, obj);
      }
      obj.reactivity = track.reactivity !== undefined ? track.reactivity : 1.0;
      obj.hue = track.hue !== undefined ? track.hue : 0.0;
      this.setPosition(obj.mesh, track.position);
    });
  }

  setPosition(mesh, positionStr) {
    const aspect = this.aspect;
    const paddingX = 0.2;
    const paddingY = 0.2;
    
    // Default size for quadrants
    const quadW = aspect - paddingX;
    const quadH = 1 - paddingY;
    
    switch (positionStr) {
      case 'center':
        mesh.scale.set(aspect * 1.5, 1.5, 1);
        mesh.position.set(0, 0, 0);
        break;
      case 'top-left':
        mesh.scale.set(quadW, quadH, 1);
        mesh.position.set(-aspect + paddingX + quadW/2, 1 - paddingY - quadH/2, 0);
        break;
      case 'top-right':
        mesh.scale.set(quadW, quadH, 1);
        mesh.position.set(aspect - paddingX - quadW/2, 1 - paddingY - quadH/2, 0);
        break;
      case 'bottom-left':
        mesh.scale.set(quadW, quadH, 1);
        mesh.position.set(-aspect + paddingX + quadW/2, -1 + paddingY + quadH/2, 0);
        break;
      case 'bottom-right':
        mesh.scale.set(quadW, quadH, 1);
        mesh.position.set(aspect - paddingX - quadW/2, -1 + paddingY + quadH/2, 0);
        break;
      case 'background':
        mesh.scale.set(aspect * 2, 2, 1);
        mesh.position.set(0, 0, -0.5); // put behind others
        break;
    }
  }

  createVisualizer(style) {
    let geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
    let material;
    let uniforms = {};
    
    if (style === 'psychedelic') {
       const matData = getPsychedelicMaterial();
       material = matData.material;
       uniforms = matData.uniforms;
    } else if (style === 'fireworks') {
       const matData = getFireworksMaterial();
       material = matData.material;
       uniforms = matData.uniforms;
       geometry = matData.geometry;
       const mesh = matData.isPoints ? new THREE.Points(geometry, material) : new THREE.Mesh(geometry, material);
       return { mesh, uniforms, style };
    } else if (style === 'chladni') {
       const matData = getChladniMaterial();
       material = matData.material;
       uniforms = matData.uniforms;
       geometry = matData.geometry || geometry;
       return { mesh: new THREE.Mesh(geometry, material), uniforms, style };
    } else {
       // Fallback solid color
       material = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
    }
    
    return { mesh: new THREE.Mesh(geometry, material), uniforms, style };
  }

  start() {
    if (this.rafId) return;
    this.lastTime = this.clock.getElapsedTime();
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  render() {
    const time = this.clock.getElapsedTime();
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    for (const [id, obj] of this.objects.entries()) {
      globalMixer.getTrackFrequencyData(id, this.freqData);
      
      // Calculate average low and high frequencies
      let lowAvg = 0;
      for(let i=0; i<10; i++) lowAvg += this.freqData[i];
      lowAvg /= 10;
      
      let highAvg = 0;
      for(let i=100; i<150; i++) highAvg += this.freqData[i];
      highAvg /= 50;
      
      const reactivity = obj.reactivity !== undefined ? obj.reactivity : 1.0;
      const hue = obj.hue !== undefined ? obj.hue : 0.0;
      const normalizedLow = (lowAvg / 255.0) * reactivity;
      const normalizedHigh = (highAvg / 255.0) * reactivity;

      if (obj.uniforms) {
         if (obj.uniforms.uTime) obj.uniforms.uTime.value = time;
         if (obj.uniforms.uFreq) obj.uniforms.uFreq.value = normalizedLow;
         if (obj.uniforms.uFreqHigh) obj.uniforms.uFreqHigh.value = normalizedHigh;
         if (obj.uniforms.uHue) obj.uniforms.uHue.value = hue * Math.PI * 2.0;
      }
      
      if (obj.style === 'fireworks') {
         updateFireworksGeometry(obj.mesh.geometry, id, delta);
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}
