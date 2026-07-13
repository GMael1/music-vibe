import * as THREE from 'three';
import { globalMixer } from '../audio/Mixer';

const NUM_PARTICLES = 300; // Much fewer particles

export function getFireworksMaterial() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(NUM_PARTICLES * 3);
  const colors = new Float32Array(NUM_PARTICLES * 3);
  const lifetimes = new Float32Array(NUM_PARTICLES); 
  const shapeTypes = new Float32Array(NUM_PARTICLES);
  const baseSizes = new Float32Array(NUM_PARTICLES);

  for (let i = 0; i < NUM_PARTICLES; i++) {
    positions[i*3] = 9999; // hidden
    lifetimes[i] = 0; 
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  geometry.setAttribute('shapeType', new THREE.BufferAttribute(shapeTypes, 1));
  geometry.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1));
  
  geometry.userData = { nextIndex: 0, lastFreq: 0 };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFreq: { value: 0 },
      uHue: { value: 0 }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float lifetime;
      attribute float shapeType;
      attribute float baseSize;
      varying vec3 vColor;
      varying float vLifetime;
      varying float vShapeType;
      void main() {
        vColor = color;
        vLifetime = lifetime;
        vShapeType = shapeType;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Pop in and out: sin curve from 0 to PI over lifetime 1.0 -> 0.0
        float size = sin(lifetime * 3.1415) * baseSize;
        
        gl_PointSize = size;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uHue;
      varying vec3 vColor;
      varying float vLifetime;
      varying float vShapeType;
      
      vec3 hueShift(vec3 color, float hue) {
          const vec3 k = vec3(0.57735, 0.57735, 0.57735);
          float cosAngle = cos(hue);
          return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
      }
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        
        float alpha = 0.0;
        
        if (vShapeType < 0.5) {
            // Circle
            if (dist > 0.5) discard;
            alpha = smoothstep(0.5, 0.3, dist);
        } else if (vShapeType < 1.5) {
            // Diamond / Star
            float d = abs(coord.x) + abs(coord.y);
            if (d > 0.5) discard;
            alpha = smoothstep(0.5, 0.2, d);
        } else {
            // Ring
            if (dist > 0.5 || dist < 0.3) discard;
            alpha = smoothstep(0.5, 0.4, dist) * smoothstep(0.3, 0.4, dist);
            alpha *= 2.5;
        }
        
        alpha *= pow(vLifetime, 1.2); 
        
        vec3 color = hueShift(vColor, uHue);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return { material, uniforms: material.uniforms, geometry, isPoints: true };
}

const freqData = new Uint8Array(2048);

export function updateFireworksGeometry(geometry, trackId, delta) {
  const track = globalMixer.tracks.get(trackId);
  if (!track || !track.analyser) return;
  
  track.analyser.getByteFrequencyData(freqData);
  
  let lowSum = 0;
  for(let i=0; i<10; i++) lowSum += freqData[i];
  const lowAvg = lowSum / 10;
  
  let highSum = 0;
  for(let i=100; i<150; i++) highSum += freqData[i];
  const highAvg = highSum / 50;
  
  let midSum = 0;
  for(let i=20; i<80; i++) midSum += freqData[i];
  const midAvg = midSum / 60;
  
  const reactivity = track.reactivity !== undefined ? track.reactivity : 1.0;
  const highIntensity = (highAvg / 255.0) * reactivity;
  
  const data = geometry.userData;
  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;
  const lifetimes = geometry.attributes.lifetime.array;
  const shapeTypes = geometry.attributes.shapeType.array;
  const baseSizes = geometry.attributes.baseSize.array;
  
  const time = performance.now() * 0.001;
  
  // Detection for punchy beats
  const isBeat = lowAvg > 160 && (lowAvg - data.lastFreq) > 15;
  data.lastFreq = lowAvg;
  
  // Mid frequency peak detection for vocals/piano
  if (data.lastMidFreq === undefined) data.lastMidFreq = 0;
  const isMidPeak = midAvg > 100 && (midAvg - data.lastMidFreq) > 10;
  data.lastMidFreq = midAvg;
  
  // Decide how many to spawn. One by one randomly, maybe a few on a heavy beat
  let spawnCount = 0;
  if (isBeat) {
      spawnCount = 1 + Math.floor(Math.random() * 2); // 1 to 2 big pops
  } else if (isMidPeak) {
      spawnCount = 1; // 1 medium pop for piano/vocals
  } else if (highIntensity > 0.4 && Math.random() < (highIntensity * 0.5)) {
      spawnCount = 1; // 1 small pop for hi-hats
  }
  
  if (spawnCount > 0) {
      for (let i=0; i<spawnCount; i++) {
         let idx = data.nextIndex;
         
         // Spawn anywhere in local space [-0.5, 0.5]
         positions[idx*3] = (Math.random() - 0.5);
         positions[idx*3+1] = (Math.random() - 0.5);
         positions[idx*3+2] = (Math.random() - 0.5) * 0.1;
         
         // Color mapping based on time and type of pop
         const hue = isBeat ? (time * 0.1) % 1.0 : (time * 0.2 + 0.5) % 1.0;
         const colorBase = new THREE.Color().setHSL(hue, 0.9, 0.6);
         colors[idx*3] = colorBase.r;
         colors[idx*3+1] = colorBase.g;
         colors[idx*3+2] = colorBase.b;
         
         lifetimes[idx] = 1.0;
         
         if (isBeat) {
            baseSizes[idx] = 100.0 + Math.random() * 80.0;
            shapeTypes[idx] = Math.random() > 0.5 ? 1 : 2; // Diamond or Ring
         } else if (isMidPeak) {
            baseSizes[idx] = 50.0 + Math.random() * 40.0;
            shapeTypes[idx] = 0; // Circle
         } else {
            baseSizes[idx] = 20.0 + Math.random() * 20.0;
            shapeTypes[idx] = 0; // Circle
         }
         
         data.nextIndex = (data.nextIndex + 1) % NUM_PARTICLES;
      }
  }
  
  const dt = Math.min(delta, 0.1);
  
  for (let i = 0; i < NUM_PARTICLES; i++) {
     if (lifetimes[i] > 0) {
        lifetimes[i] -= dt * 1.5; // Quick pop! Lasts ~0.66 seconds
        if (lifetimes[i] <= 0) {
           positions[i*3] = 9999; 
        }
     }
  }
  
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.attributes.lifetime.needsUpdate = true;
  geometry.attributes.shapeType.needsUpdate = true;
  geometry.attributes.baseSize.needsUpdate = true;
}
